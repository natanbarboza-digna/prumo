// Reads the time history pasted from the .md (plan 033):
//
//   **16/11**
//   08:15 - cheguei
//   08:30 - olhei a caixa de e-mail, chamados
//   12:30 - almoço
//   18:30 - fim do expediente
//
// A line's time is the start; it lasts until the next line of the day. The
// first and last lines may be the arrival and the end; break words make
// breaks. Each stretch is cut along the day's blocks and must fill whole
// blocks or halves. Pure: the database checks come in the service.

import type { TimeEntryKind } from "@/generated/prisma/enums";
import { isValidDateOnly } from "@/lib/dates";
import { normalizeActivity } from "@/modules/time/analytics";
import { type WordRule, matchRule } from "@/modules/time/import/rules";
import { daySlots, fitsSlot } from "@/modules/time/rules";

export type ParseOptions = {
  /** The dates of the .md have no year. */
  year: number;
  slotMinutes: number;
  today: string;
  /** The category of work no rule matches. */
  defaultCategory: string;
  categoryRules: WordRule[];
  projectRules: WordRule[];
};

export type ParsedEntry = {
  /** Line of the pasted text, for the preview. */
  line: number;
  startMinute: number;
  minutes: number;
  kind: TimeEntryKind;
  description: string;
  /** Null for a break. */
  categoryName: string | null;
  projectName: string | null;
};

export type ParsedDay = {
  line: number;
  date: string;
  startMinute: number;
  endMinute: number;
  entries: ParsedEntry[];
};

export type ParseIssue = { line: number; message: string };

export const MAX_DESCRIPTION = 300;

const DATE_LINE = /^\s*\*{0,2}\s*(\d{1,2})\/(\d{1,2})\s*\*{0,2}\s*$/;
const ENTRY_LINE = /^\s*(\d{1,2}):(\d{2})\s*(?:-|–|—|:)\s*(.*)$/;

const ARRIVAL = /^(cheguei|chegada|entrada|inicio)\b/;
const END = /^(fim do expediente|fim|saida|saindo)\b/;
const BREAK = /^(almoco|pausa|intervalo|cafe)\b/;

type Item = { line: number; minute: number; text: string };
type RawDay = { line: number; date: string; label: string; items: Item[]; broken: boolean };

const pad = (value: number) => String(value).padStart(2, "0");

export function parseTimeHistory(
  text: string,
  options: ParseOptions,
): { days: ParsedDay[]; issues: ParseIssue[] } {
  const issues: ParseIssue[] = [];
  const raw: RawDay[] = [];
  const seen = new Set<string>();
  // The day lines belong to; null before the first date or after an invalid one.
  let current: RawDay | null = null;
  let skipping = false;

  text.split(/\r?\n/).forEach((content, index) => {
    const line = index + 1;
    if (content.trim() === "") return;

    const date = DATE_LINE.exec(content);
    if (date) {
      const day = Number(date[1]);
      const month = Number(date[2]);
      const iso = `${options.year}-${pad(month)}-${pad(day)}`;
      const label = `${pad(day)}/${pad(month)}`;
      current = null;
      skipping = true;
      if (!isValidDateOnly(iso)) issues.push({ line, message: "Data inválida." });
      else if (seen.has(iso)) issues.push({ line, message: `A data ${label} já apareceu antes.` });
      else if (iso > options.today) issues.push({ line, message: "Dia no futuro." });
      else {
        current = { line, date: iso, label, items: [], broken: false };
        raw.push(current);
        skipping = false;
      }
      seen.add(iso);
      return;
    }

    const entry = ENTRY_LINE.exec(content);
    if (!entry) {
      issues.push({ line, message: 'Linha não reconhecida. Use "DD/MM" ou "HH:MM - texto".' });
      return;
    }
    if (current === null) {
      // Lines under an invalid date were already reported through the date.
      if (!skipping) issues.push({ line, message: "Registro antes da primeira data." });
      return;
    }
    const day: RawDay = current;
    const hours = Number(entry[1]);
    const minutes = Number(entry[2]);
    const description = (entry[3] ?? "").trim();
    if (hours > 23 || minutes > 59) {
      issues.push({ line, message: "Horário inválido." });
      day.broken = true;
      return;
    }
    const minute = hours * 60 + minutes;
    const previous = day.items.at(-1);
    if (previous && minute <= previous.minute) {
      issues.push({ line, message: "Horário fora de ordem no dia." });
      day.broken = true;
      return;
    }
    if (description === "") {
      issues.push({ line, message: "Falta o texto depois do horário." });
      day.broken = true;
      return;
    }
    if (description.length > MAX_DESCRIPTION) {
      issues.push({ line, message: `O texto passa de ${MAX_DESCRIPTION} caracteres.` });
      day.broken = true;
      return;
    }
    day.items.push({ line, minute, text: description });
  });

  const days = raw
    .filter((day) => !day.broken && day.items.length > 0)
    .flatMap((day) => {
      const parsed = buildDay(day, options, issues);
      return parsed ? [parsed] : [];
    });
  issues.sort((a, b) => a.line - b.line);
  return { days, issues };
}

/** Markers, stretches and the cut along the blocks; null when a stretch does not fit. */
function buildDay(day: RawDay, options: ParseOptions, issues: ParseIssue[]): ParsedDay | null {
  const items = [...day.items];
  const first = items[0]!;
  const last = items.at(-1)!;
  const arrival = items.length > 1 && ARRIVAL.test(normalizeActivity(first.text));
  const ending = items.length > 1 && END.test(normalizeActivity(last.text));

  const startMinute = first.minute;
  const endMinute = ending ? last.minute : last.minute + options.slotMinutes;
  // Each line lasts until the next one (the end marker included).
  const stretches = items
    .map((item, index) => ({ item, until: items[index + 1]?.minute ?? endMinute }))
    .filter(({ item }) => !(arrival && item === first) && !(ending && item === last));

  const slots = daySlots(
    { startMinute, endMinute, slotMinutes: options.slotMinutes },
    { now: null },
  );
  const entries: ParsedEntry[] = [];
  let fits = true;
  for (const { item, until } of stretches) {
    const pieces = slots
      .filter((slot) => slot.start < until && slot.end > item.minute)
      .map((slot) => ({
        slot,
        startMinute: Math.max(slot.start, item.minute),
        minutes: Math.min(slot.end, until) - Math.max(slot.start, item.minute),
      }));
    if (pieces.length === 0 || pieces.some((piece) => !fitsSlot(piece.slot, piece))) {
      issues.push({
        line: item.line,
        message: `O trecho não fecha com os blocos de ${options.slotMinutes} minutos.`,
      });
      fits = false;
      continue;
    }
    const isBreak = BREAK.test(normalizeActivity(item.text));
    for (const piece of pieces) {
      entries.push({
        line: item.line,
        startMinute: piece.startMinute,
        minutes: piece.minutes,
        kind: isBreak ? "BREAK" : "WORK",
        description: item.text,
        categoryName: isBreak
          ? null
          : (matchRule(options.categoryRules, item.text) ?? options.defaultCategory),
        projectName: isBreak ? null : matchRule(options.projectRules, item.text),
      });
    }
  }
  return fits ? { line: day.line, date: day.date, startMinute, endMinute, entries } : null;
}
