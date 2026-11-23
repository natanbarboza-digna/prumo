"use server";
// Every exported function in a "use server" file becomes a Server Action: the
// browser calls it like an endpoint, so inputs are untrusted and validated here.

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { formatDateForDisplay } from "@/lib/dates";
import { requireSession } from "@/modules/auth/session";
import { positionInputValue } from "@/modules/books/labels";
import { type ProgressUnit, unitOf } from "@/modules/books/rules";
import {
  type BookFieldErrors,
  type BookFormValues,
  type BookLogFormValues,
  type BookQuoteFormValues,
  type BookRatingFormValues,
  bookActionSchema,
  bookInputSchema,
  bookLogSchema,
  bookQuoteSchema,
  bookRatingSchema,
} from "@/modules/books/schemas";
import {
  BookDateInFutureError,
  BookFormatLockedError,
  BookLogDateError,
  BookLogNotFoundError,
  BookLogPositionError,
  BookNotFoundError,
  BookNotReadingError,
  BookQuoteNotFoundError,
  BookRatingNotAllowedError,
  BookTotalTooSmallError,
  InvalidBookActionError,
  changeBookStatus,
  createBook,
  createQuote,
  deleteBook,
  deleteBookLog,
  deleteQuote,
  getBook,
  logReading,
  rateBook,
  updateBook,
  updateQuote,
} from "@/modules/books/service";
import { GoalNotFoundError } from "@/modules/goals/service";

export type BookFormState = {
  errors?: BookFieldErrors;
  formError?: string;
  values?: BookFormValues;
};

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readBookForm(formData: FormData): BookFormValues {
  return {
    title: readText(formData, "title"),
    authors: readText(formData, "authors"),
    format: readText(formData, "format") as BookFormValues["format"],
    pages: readText(formData, "pages"),
    genre: readText(formData, "genre"),
    recommendedBy: readText(formData, "recommendedBy"),
    notes: readText(formData, "notes"),
    reason: readText(formData, "reason") as BookFormValues["reason"],
    dueDate: readText(formData, "dueDate"),
    goalId: readText(formData, "goalId"),
    startedOn: readText(formData, "startedOn"),
    finishedOn: readText(formData, "finishedOn"),
    durationMinutes: readText(formData, "durationMinutes"),
  };
}

/** The errors the service can raise about one field of the form. */
function fieldError(error: unknown): BookFieldErrors | null {
  if (error instanceof GoalNotFoundError) {
    return { goalId: ["Este objetivo não existe mais."] };
  }
  if (error instanceof BookDateInFutureError) {
    return { [error.field]: ["A data não pode estar no futuro."] };
  }
  if (error instanceof BookFormatLockedError) {
    return { format: ["Este livro tem registros de leitura; o formato não pode mudar."] };
  }
  if (error instanceof BookTotalTooSmallError) {
    const message = ["O total não pode ser menor que a leitura já registrada."];
    return { pages: message, durationMinutes: message };
  }
  return null;
}

/** Books show up on their own pages, on goal pages, in the deadlines and on the dashboard. */
function revalidateBookScreens() {
  revalidatePath("/books", "layout");
  revalidatePath("/goals", "layout");
  revalidatePath("/deadlines");
  revalidatePath("/");
}

export async function createBookAction(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  await requireSession();
  const values = readBookForm(formData);
  const parsed = bookInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  let bookId: string;
  try {
    bookId = (await createBook(parsed.data)).id;
  } catch (error) {
    const errors = fieldError(error);
    if (errors) return { errors, values };
    throw error;
  }
  revalidateBookScreens();
  redirect(`/books/${bookId}`);
}

export async function updateBookAction(
  id: string,
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  await requireSession();
  const values = readBookForm(formData);
  const parsed = bookInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await updateBook(id, parsed.data);
  } catch (error) {
    const errors = fieldError(error);
    if (errors) return { errors, values };
    if (error instanceof BookNotFoundError) {
      return { formError: "Este livro não existe mais.", values };
    }
    throw error;
  }
  revalidateBookScreens();
  redirect(`/books/${id}`);
}

/** The status buttons on the book page ("Começar a ler", "Marcar como lido"...). */
export async function changeBookStatusAction(id: string, action: string): Promise<void> {
  await requireSession();
  const parsed = bookActionSchema.safeParse(action);
  if (!parsed.success) return;
  try {
    await changeBookStatus(id, parsed.data);
  } catch (error) {
    // Deleted or changed in another tab: refreshing shows what is there now.
    if (!(error instanceof BookNotFoundError || error instanceof InvalidBookActionError)) {
      throw error;
    }
  }
  revalidateBookScreens();
  refresh();
}

export async function deleteBookAction(id: string): Promise<void> {
  await requireSession();
  try {
    await deleteBook(id);
  } catch (error) {
    // Already gone: the outcome the user asked for, so carry on to the list.
    if (!(error instanceof BookNotFoundError)) throw error;
  }
  revalidateBookScreens();
  redirect("/books");
}

// ---------------------------------------------------------------------------
// Reading progress, rating and quotes (plan 036)
// ---------------------------------------------------------------------------

export type BookLogFormState = {
  errors?: Partial<Record<keyof BookLogFormValues, string[]>>;
  formError?: string;
  values?: BookLogFormValues;
};

function positionRange(unit: ProgressUnit, min: number, max: number | null): string {
  const show = (value: number) => positionInputValue(unit, value);
  return max === null ? `Informe ${show(min)} ou mais.` : `Informe de ${show(min)} a ${show(max)}.`;
}

/** "Registrar" on the book page: where the reading stopped on a day. */
export async function logReadingAction(
  bookId: string,
  _previous: BookLogFormState,
  formData: FormData,
): Promise<BookLogFormState> {
  await requireSession();
  const values = { date: readText(formData, "date"), position: readText(formData, "position") };
  let unit: ProgressUnit;
  try {
    unit = unitOf((await getBook(bookId)).format);
  } catch (error) {
    if (error instanceof BookNotFoundError) return { formError: "Este livro não existe mais." };
    throw error;
  }
  const parsed = bookLogSchema(unit).safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await logReading(bookId, parsed.data);
  } catch (error) {
    if (error instanceof BookNotReadingError) {
      return {
        formError: "Só dá para registrar a leitura de um livro que você está lendo.",
        values,
      };
    }
    if (error instanceof BookLogDateError) {
      const start = error.startedOn ? ` (${formatDateForDisplay(error.startedOn)})` : "";
      return {
        errors: { date: [`Use uma data entre o início da leitura${start} e hoje.`] },
        values,
      };
    }
    if (error instanceof BookLogPositionError) {
      return { errors: { position: [positionRange(unit, error.min, error.max)] }, values };
    }
    throw error;
  }
  revalidateBookScreens();
  refresh();
  // A fresh form for the next day's log.
  return {};
}

export async function deleteBookLogAction(id: string): Promise<void> {
  await requireSession();
  try {
    await deleteBookLog(id);
  } catch (error) {
    if (!(error instanceof BookLogNotFoundError)) throw error;
  }
  revalidateBookScreens();
  refresh();
}

export type BookRatingFormState = {
  errors?: Partial<Record<keyof BookRatingFormValues, string[]>>;
  formError?: string;
  values?: BookRatingFormValues;
  saved?: boolean;
};

export async function rateBookAction(
  bookId: string,
  _previous: BookRatingFormState,
  formData: FormData,
): Promise<BookRatingFormState> {
  await requireSession();
  const values = { rating: readText(formData, "rating"), review: readText(formData, "review") };
  const parsed = bookRatingSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await rateBook(bookId, parsed.data);
  } catch (error) {
    if (error instanceof BookRatingNotAllowedError) {
      return {
        formError: "A nota é só para livro lido; a resenha, para lido ou abandonado.",
        values,
      };
    }
    if (error instanceof BookNotFoundError) return { formError: "Este livro não existe mais." };
    throw error;
  }
  revalidateBookScreens();
  refresh();
  return { values, saved: true };
}

export type BookQuoteFormState = {
  errors?: Partial<Record<keyof BookQuoteFormValues, string[]>>;
  formError?: string;
  values?: BookQuoteFormValues;
};

function readQuoteForm(formData: FormData): BookQuoteFormValues {
  return { text: readText(formData, "text"), location: readText(formData, "location") };
}

export async function createQuoteAction(
  bookId: string,
  _previous: BookQuoteFormState,
  formData: FormData,
): Promise<BookQuoteFormState> {
  await requireSession();
  const values = readQuoteForm(formData);
  const parsed = bookQuoteSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    await createQuote(bookId, parsed.data);
  } catch (error) {
    if (error instanceof BookNotFoundError) return { formError: "Este livro não existe mais." };
    throw error;
  }
  revalidateBookScreens();
  refresh();
  return {};
}

export async function updateQuoteAction(
  quoteId: string,
  bookId: string,
  _previous: BookQuoteFormState,
  formData: FormData,
): Promise<BookQuoteFormState> {
  await requireSession();
  const values = readQuoteForm(formData);
  const parsed = bookQuoteSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    await updateQuote(quoteId, parsed.data);
  } catch (error) {
    if (error instanceof BookQuoteNotFoundError) {
      return { formError: "Este trecho não existe mais.", values };
    }
    throw error;
  }
  revalidateBookScreens();
  redirect(`/books/${bookId}#trechos`);
}

export async function deleteQuoteAction(id: string): Promise<void> {
  await requireSession();
  try {
    await deleteQuote(id);
  } catch (error) {
    if (!(error instanceof BookQuoteNotFoundError)) throw error;
  }
  revalidateBookScreens();
  refresh();
}
