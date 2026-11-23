// The time history import (plan 033): reads the pasted text (parse.ts), checks
// it against the database (days already tracked, categories, projects) and
// writes everything in one transaction. Any problem means nothing is written.

import { db } from "@/lib/db";
import { formatDateForDisplay, parseDateOnly, todayInAppTimeZone } from "@/lib/dates";
import { isUuid } from "@/lib/form-fields";
import { normalizeActivity } from "@/modules/time/analytics";
import { type ParsedDay, parseTimeHistory } from "@/modules/time/import/parse";
import { type WordRule, parseRules } from "@/modules/time/import/rules";

export type TimeImportInput = {
  text: string;
  year: number;
  slotMinutes: number;
  defaultCategoryId: string;
  /** "palavra = Categoria", one per line. */
  categoryRules: string;
  /** "palavra = Projeto", one per line. */
  projectRules: string;
};

/** Where a problem is: the pasted text, one of the rule fields, or the form itself. */
export type TimeImportIssue = {
  source: "text" | "categoryRules" | "projectRules" | "form";
  line: number | null;
  message: string;
};

export type TimeImportPreview = {
  days: ParsedDay[];
  counts: { days: number; work: number; breaks: number };
  /** Projects that the import will create. */
  newProjects: string[];
};

export type PreviewResult =
  { ok: true; preview: TimeImportPreview } | { ok: false; issues: TimeImportIssue[] };

type Named = { id: string; name: string; archived: boolean };

const sameName = (a: string, b: string) => normalizeActivity(a) === normalizeActivity(b);

/** Reads and checks everything without writing (the "Conferir" step). */
export async function previewTimeImport(
  input: TimeImportInput,
  now: Date = new Date(),
): Promise<PreviewResult> {
  const checked = await check(input, now);
  if (!checked.ok) return checked;
  return { ok: true, preview: checked.preview };
}

/** Checks again from scratch and writes all days, entries and new projects at once. */
export async function importTimeHistory(
  input: TimeImportInput,
  now: Date = new Date(),
): Promise<{ ok: true; dates: string[] } | { ok: false; issues: TimeImportIssue[] }> {
  const checked = await check(input, now);
  if (!checked.ok) return checked;
  const { preview, categoryIds, projectIds } = checked;

  await db.$transaction(async (tx) => {
    const projects = new Map(projectIds);
    for (const name of preview.newProjects) {
      projects.set(normalizeActivity(name), (await tx.timeProject.create({ data: { name } })).id);
    }
    for (const day of preview.days) {
      await tx.timeDay.create({
        data: {
          date: parseDateOnly(day.date),
          startMinute: day.startMinute,
          endMinute: day.endMinute,
          slotMinutes: input.slotMinutes,
          entries: {
            create: day.entries.map((entry) => ({
              startMinute: entry.startMinute,
              minutes: entry.minutes,
              kind: entry.kind,
              description: entry.description,
              categoryId:
                entry.categoryName === null
                  ? null
                  : (categoryIds.get(normalizeActivity(entry.categoryName)) ?? null),
              projectId:
                entry.projectName === null
                  ? null
                  : (projects.get(normalizeActivity(entry.projectName)) ?? null),
            })),
          },
        },
      });
    }
  });
  return { ok: true, dates: preview.days.map((day) => day.date) };
}

async function check(input: TimeImportInput, now: Date) {
  const issues: TimeImportIssue[] = [];
  const [categories, projects] = await Promise.all([
    db.timeCategory.findMany({ select: { id: true, name: true, archived: true } }),
    db.timeProject.findMany({ select: { id: true, name: true, archived: true } }),
  ]);

  const fallback = isUuid(input.defaultCategoryId)
    ? categories.find((category) => category.id === input.defaultCategoryId)
    : undefined;
  if (!fallback) {
    return fail([{ source: "form", line: null, message: "Escolha a categoria padrão." }]);
  }
  if (fallback.archived) {
    return fail([{ source: "form", line: null, message: "A categoria padrão está arquivada." }]);
  }

  // Rule names are matched against the registered ones regardless of case and
  // accents, and replaced by the registered spelling.
  const categoryRules = resolveRules(input.categoryRules, "categoryRules", issues, (name, line) => {
    const found = categories.find((category) => sameName(category.name, name));
    if (!found) return refuse(issues, "categoryRules", line, `A categoria “${name}” não existe.`);
    if (found.archived) {
      return refuse(issues, "categoryRules", line, `A categoria “${found.name}” está arquivada.`);
    }
    return found.name;
  });
  const projectRules = resolveRules(input.projectRules, "projectRules", issues, (name, line) => {
    const found = projects.find((project) => sameName(project.name, name));
    if (found?.archived) {
      return refuse(issues, "projectRules", line, `O projeto “${found.name}” está arquivado.`);
    }
    return found?.name ?? name;
  });

  const parsed = parseTimeHistory(input.text, {
    year: input.year,
    slotMinutes: input.slotMinutes,
    today: todayInAppTimeZone(now),
    defaultCategory: fallback.name,
    categoryRules,
    projectRules,
  });
  issues.push(...parsed.issues.map((issue) => ({ source: "text" as const, ...issue })));

  if (parsed.days.length > 0) {
    const tracked = await db.timeDay.findMany({
      where: { date: { in: parsed.days.map((day) => parseDateOnly(day.date)) } },
      select: { date: true },
    });
    const trackedDates = new Set(tracked.map((row) => row.date.toISOString().slice(0, 10)));
    for (const day of parsed.days) {
      if (trackedDates.has(day.date)) {
        issues.push({
          source: "text",
          line: day.line,
          message: `O dia ${formatDateForDisplay(day.date)} já tem registro no Prumo.`,
        });
      }
    }
  }
  if (parsed.days.length === 0 && issues.length === 0) {
    issues.push({ source: "text", line: null, message: "Nenhum dia encontrado no texto." });
  }
  if (issues.length > 0) return fail(issues);

  const entries = parsed.days.flatMap((day) => day.entries);
  const used = new Set(entries.flatMap((entry) => (entry.projectName ? [entry.projectName] : [])));
  const newProjects = [...used]
    .filter((name) => !projects.some((project) => sameName(project.name, name)))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    ok: true as const,
    preview: {
      days: parsed.days,
      counts: {
        days: parsed.days.length,
        work: entries.filter((entry) => entry.kind === "WORK").length,
        breaks: entries.filter((entry) => entry.kind === "BREAK").length,
      },
      newProjects,
    },
    categoryIds: idsByName(categories),
    projectIds: idsByName(projects),
  };
}

function idsByName(rows: Named[]): Map<string, string> {
  return new Map(rows.map((row) => [normalizeActivity(row.name), row.id]));
}

/** Parses a rule field; `resolve` returns the name to use, or null after reporting why not. */
function resolveRules(
  text: string,
  source: "categoryRules" | "projectRules",
  issues: TimeImportIssue[],
  resolve: (name: string, line: number) => string | null,
): WordRule[] {
  const { rules, issues: ruleIssues } = parseRules(text);
  issues.push(...ruleIssues.map((issue) => ({ source, ...issue })));
  return rules.flatMap((rule) => {
    const name = resolve(rule.name, rule.line);
    return name === null ? [] : [{ ...rule, name }];
  });
}

function refuse(
  issues: TimeImportIssue[],
  source: TimeImportIssue["source"],
  line: number,
  message: string,
): null {
  issues.push({ source, line, message });
  return null;
}

function fail(issues: TimeImportIssue[]) {
  return { ok: false as const, issues };
}
