import { z } from "zod";

// enums.ts holds only plain constants (no database client), so this file is
// safe to import from the book form, a Client Component.
import { BookFormat, BookReason } from "@/generated/prisma/enums";
import {
  optionalDateOnly,
  optionalText,
  optionalUuid,
  requiredDateOnly,
  requiredText,
} from "@/lib/form-fields";
import { BOOK_FILTERS, type ProgressUnit, isRequired } from "@/modules/books/rules";

export const MAX_BOOK_PAGES = 10_000;

/** Optional whole number of pages; blank becomes null. */
const pagesField = optionalText(6)
  .refine((value) => value === null || /^\d+$/.test(value), {
    error: "Informe um número inteiro de páginas.",
  })
  .transform((value) => (value === null ? null : Number(value)))
  .refine((value) => value === null || (value >= 1 && value <= MAX_BOOK_PAGES), {
    error: `Informe de 1 a ${MAX_BOOK_PAGES.toLocaleString("pt-BR")} páginas.`,
  });

/** "HH:MM" with any number of hours (audiobooks pass 24 h), as minutes. */
export function parseDuration(value: string): number | null {
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const DURATION_ERROR = "Use o formato HH:MM.";

/** Optional audiobook length (plan 036); blank becomes null. */
const durationField = optionalText(6)
  .refine((value) => value === null || parseDuration(value) !== null, { error: DURATION_ERROR })
  .transform((value) => (value === null ? null : parseDuration(value)))
  .refine((value) => value === null || value > 0, { error: "Informe uma duração maior que zero." });

/**
 * The book form (plan 035), the same in the browser and in the Server Action.
 * The status is not here: it changes through the buttons on the book page.
 */
export const bookInputSchema = z
  .object({
    title: requiredText(200),
    authors: requiredText(200, "Informe o autor."),
    format: z.enum(BookFormat, { error: "Escolha um formato válido." }).default("PHYSICAL"),
    pages: pagesField,
    genre: optionalText(60),
    recommendedBy: optionalText(120),
    notes: optionalText(2000),
    reason: z.enum(BookReason, { error: "Escolha um motivo válido." }).default("PERSONAL"),
    dueDate: optionalDateOnly(),
    goalId: optionalUuid("Escolha um objetivo válido."),
    startedOn: optionalDateOnly(),
    finishedOn: optionalDateOnly(),
    durationMinutes: durationField,
  })
  .refine((book) => book.dueDate === null || isRequired(book.reason), {
    error: "Prazo só para livros de trabalho ou de PDI.",
    path: ["dueDate"],
  })
  .refine(
    (book) =>
      book.startedOn === null || book.finishedOn === null || book.finishedOn >= book.startedOn,
    { error: "O término não pode ser antes do início.", path: ["finishedOn"] },
  );

export type BookFormValues = z.input<typeof bookInputSchema>;
export type BookInput = z.output<typeof bookInputSchema>;
export type BookFieldErrors = Partial<Record<keyof BookFormValues, string[]>>;

/** `?situacao=` from the URL; anything missing or unknown is the shelf. */
export const bookFilterSchema = z.enum(BOOK_FILTERS).catch("SHELF");

export const bookActionSchema = z.enum(["START", "FINISH", "ABANDON", "REQUEUE", "REREAD"]);

// ---------------------------------------------------------------------------
// Reading progress (plan 036)
// ---------------------------------------------------------------------------

/** Where the reading stopped: a page, a percentage (up to 100) or "HH:MM" listened. */
function positionField(unit: ProgressUnit) {
  const required = z.string({ error: "Informe onde parou." }).trim().min(1, "Informe onde parou.");
  if (unit === "MINUTE") {
    return required
      .refine((value) => parseDuration(value) !== null, { error: DURATION_ERROR })
      .transform((value) => parseDuration(value) ?? 0)
      .refine((value) => value > 0, { error: "Informe um tempo maior que zero." });
  }
  const max = unit === "PERCENT" ? 100 : MAX_BOOK_PAGES;
  return required
    .refine((value) => /^\d+$/.test(value), { error: "Informe um número inteiro." })
    .transform(Number)
    .refine((value) => value >= 1 && value <= max, { error: `Informe de 1 a ${max}.` });
}

/** One day of reading, in the book's unit. */
export function bookLogSchema(unit: ProgressUnit) {
  return z.object({ date: requiredDateOnly(), position: positionField(unit) });
}

export type BookLogFormValues = { date: string; position: string };
export type BookLogInput = { date: string; position: number };

export const bookRatingSchema = z.object({
  rating: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 5), {
      error: "Escolha uma nota de 1 a 5.",
    }),
  review: optionalText(5000),
});

export type BookRatingFormValues = z.input<typeof bookRatingSchema>;
export type BookRatingInput = z.output<typeof bookRatingSchema>;

export const bookQuoteSchema = z.object({
  text: requiredText(2000, "Escreva o trecho."),
  location: optionalText(20),
});

export type BookQuoteFormValues = z.input<typeof bookQuoteSchema>;
export type BookQuoteInput = z.output<typeof bookQuoteSchema>;

// ---------------------------------------------------------------------------
// Annual goal and analytics (plan 037)
// ---------------------------------------------------------------------------

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/** A whole number from a form field, between `min` and `max`. */
function wholeNumber(min: number, max: number, message: string) {
  return z
    .string({ error: message })
    .trim()
    .refine((value) => /^\d+$/.test(value), { error: message })
    .transform(Number)
    .refine((value) => value >= min && value <= max, { error: message });
}

export const readingGoalSchema = z.object({
  year: wholeNumber(MIN_YEAR, MAX_YEAR, "Informe um ano válido."),
  books: wholeNumber(1, 365, "Informe de 1 a 365 livros."),
});

export type ReadingGoalFormValues = z.input<typeof readingGoalSchema>;
export type ReadingGoalInput = z.output<typeof readingGoalSchema>;

/** `?ano=` of the analytics page; anything missing or invalid is the current year. */
export function analyticsYear(value: unknown, today: string): number {
  const year = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : NaN;
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : Number(today.slice(0, 4));
}
