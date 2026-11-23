import { notFound } from "next/navigation";

import { BookNotFoundError, getBook } from "@/modules/books/service";

/** Loads a book for a page, turning "not found" into the segment's 404 page. */
export async function loadBook(id: string) {
  try {
    return await getBook(id);
  } catch (error) {
    if (error instanceof BookNotFoundError) notFound();
    throw error;
  }
}
