import { z } from "zod";

// enums.ts holds only plain constants (no database client), so this file is
// safe to import from the book form, a Client Component.
import { BookFormat, BookReason } from "@/generated/prisma/enums";
import { optionalDateOnly, optionalText, optionalUuid, requiredText } from "@/lib/form-fields";
import { BOOK_FILTERS, isRequired } from "@/modules/books/rules";

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
