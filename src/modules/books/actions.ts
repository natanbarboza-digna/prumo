"use server";
// Every exported function in a "use server" file becomes a Server Action: the
// browser calls it like an endpoint, so inputs are untrusted and validated here.

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/modules/auth/session";
import {
  type BookFieldErrors,
  type BookFormValues,
  bookActionSchema,
  bookInputSchema,
} from "@/modules/books/schemas";
import {
  BookDateInFutureError,
  BookNotFoundError,
  InvalidBookActionError,
  changeBookStatus,
  createBook,
  deleteBook,
  updateBook,
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
