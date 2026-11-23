import type { BookFormat, BookReason, BookStatus } from "@/generated/prisma/enums";
import { formatDateForDisplay } from "@/lib/dates";
import {
  type BookAction,
  type BookFilter,
  type ShelfGroup,
  shelfGroupOf,
} from "@/modules/books/rules";

export const bookReasonLabels: Record<BookReason, string> = {
  PERSONAL: "Vontade própria",
  RECOMMENDATION: "Indicação",
  WORK: "Trabalho",
  PDI: "PDI",
};

export const bookFormatLabels: Record<BookFormat, string> = {
  PHYSICAL: "Físico",
  EBOOK: "E-book",
  AUDIOBOOK: "Audiolivro",
};

/** One book's state, as the list groups it. */
export const shelfGroupLabels: Record<ShelfGroup, string> = {
  READING: "Lendo",
  REQUIRED: "Preciso ler",
  WANTED: "Quero ler",
  READ: "Lido",
  ABANDONED: "Abandonado",
};

/** The list's group headings. */
export const shelfGroupTitles: Record<ShelfGroup, string> = {
  READING: "Lendo",
  REQUIRED: "Preciso ler",
  WANTED: "Quero ler",
  READ: "Lidos",
  ABANDONED: "Abandonados",
};

/** "Preciso ler", "Quero ler", "Lendo", "Lido" or "Abandonado". */
export function bookStateLabel(book: { status: BookStatus; reason: BookReason }): string {
  return shelfGroupLabels[shelfGroupOf(book)];
}

/** The list's filter links, in screen order. */
export const bookFilterLabels: Record<BookFilter, string> = {
  SHELF: "Na estante",
  READING: "Lendo",
  REQUIRED: "Preciso ler",
  WANTED: "Quero ler",
  READ: "Lidos",
  ABANDONED: "Abandonados",
  ALL: "Todos",
};

/** What an empty filtered list says (the shelf invites to add a book instead). */
export const bookFilterEmptyText: Record<Exclude<BookFilter, "SHELF">, string> = {
  READING: "Nenhum livro sendo lido.",
  REQUIRED: "Nenhum livro que você precise ler.",
  WANTED: "Nenhum livro que você queira ler.",
  READ: "Nenhum livro lido.",
  ABANDONED: "Nenhum livro abandonado.",
  ALL: "Você ainda não tem livros cadastrados.",
};

export const bookActionLabels: Record<BookAction, string> = {
  START: "Começar a ler",
  FINISH: "Marcar como lido",
  ABANDON: "Abandonar",
  REQUEUE: "Voltar para a fila",
  REREAD: "Ler de novo",
};

/** "Começou em 10/11/2026", "De 10/11/2026 a 20/11/2026" or "Terminou em 20/11/2026". */
export function bookDatesText(book: {
  startedOn: string | null;
  finishedOn: string | null;
}): string | null {
  const { startedOn, finishedOn } = book;
  if (startedOn && finishedOn) {
    return `De ${formatDateForDisplay(startedOn)} a ${formatDateForDisplay(finishedOn)}`;
  }
  if (startedOn) return `Começou em ${formatDateForDisplay(startedOn)}`;
  if (finishedOn) return `Terminou em ${formatDateForDisplay(finishedOn)}`;
  return null;
}
