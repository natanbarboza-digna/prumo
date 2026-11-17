// Turns spreadsheet cells into the strings the PDI form schemas expect.
// Pure: no file and no database, so it is tested with plain values.

import { formatDateOnly, isValidDateOnly } from "@/lib/dates";

/** What a cell can hold after read-excel-file parses it. */
export type Cell = string | number | boolean | Date | null;

export type Converted<T> = { ok: true; value: T } | { ok: false; message: string };

const DATE_MESSAGE = "Use uma data no formato dd/mm/aaaa.";
const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * An Excel date (read-excel-file gives a Date at midnight UTC) or "dd/mm/aaaa"
 * text, as "YYYY-MM-DD". An empty cell gives "" (the schemas treat it as no date).
 */
export function parseDateCell(cell: Cell): Converted<string> {
  if (cell === null) return { ok: true, value: "" };
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime())
      ? { ok: false, message: DATE_MESSAGE }
      : { ok: true, value: formatDateOnly(cell) };
  }
  if (typeof cell !== "string") return { ok: false, message: DATE_MESSAGE };

  const text = cell.trim();
  if (text === "") return { ok: true, value: "" };
  const match = DMY.exec(text);
  if (!match) return { ok: false, message: DATE_MESSAGE };
  const [, day = "", month = "", year = ""] = match;
  const value = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return isValidDateOnly(value) ? { ok: true, value } : { ok: false, message: DATE_MESSAGE };
}

/** Lowercase, without accents or surrounding spaces: "Não iniciada" and "nao iniciada" match. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * A status label in pt-BR ("Em andamento") as its value ("IN_PROGRESS").
 * An empty cell gives undefined, so the schema's default applies.
 * `accepted` limits the choices (a new cycle cannot be CLOSED).
 */
export function parseLabel<T extends string>(
  cell: Cell,
  labels: Record<T, string>,
  accepted: readonly T[] = Object.keys(labels) as T[],
): Converted<T | undefined> {
  const text = cellText(cell);
  if (text.trim() === "") return { ok: true, value: undefined };
  const found = accepted.find((value) => normalize(labels[value]) === normalize(text));
  if (found !== undefined) return { ok: true, value: found };
  return {
    ok: false,
    message: `Use um destes: ${accepted.map((value) => labels[value]).join(", ")}.`,
  };
}

/** Any cell as text; the schemas trim it and turn "" into "not filled in". */
export function cellText(cell: Cell): string {
  if (cell === null) return "";
  if (cell instanceof Date) return formatDateOnly(cell);
  return String(cell);
}
