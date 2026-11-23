import type { BookFormat, BookReason, BookStatus } from "@/generated/prisma/enums";
import { formatDateForDisplay } from "@/lib/dates";
import { durationText } from "@/modules/time/labels";
import {
  type BookAction,
  type BookProgress,
  type ProgressUnit,
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

// ---------------------------------------------------------------------------
// Reading progress (plan 036)
// ---------------------------------------------------------------------------

/** The log form's field, by unit. */
export const positionLabels: Record<ProgressUnit, string> = {
  PAGE: "Página",
  PERCENT: "Porcentagem",
  MINUTE: "Tempo ouvido (HH:MM)",
};

const hours = (minutes: number) => (minutes === 0 ? "0min" : durationText(minutes));

/** "Página 72", "45%" or "3h20". */
export function positionText(unit: ProgressUnit, position: number): string {
  if (unit === "PAGE") return `Página ${position}`;
  return unit === "PERCENT" ? `${position}%` : hours(position);
}

/** The position as the form field takes it: "72", "45" or "03:20". */
export function positionInputValue(unit: ProgressUnit, position: number): string {
  if (unit !== "MINUTE") return String(position);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(position / 60))}:${pad(position % 60)}`;
}

/** "Página 120 de 456 (26%)", "45% lido" or "3h20 de 10h (33%)". */
export function progressText({ unit, position, total, percent }: BookProgress): string {
  if (position === 0) return "Nenhuma leitura registrada";
  const share = percent === null ? "" : ` (${percent}%)`;
  if (unit === "PERCENT") return `${position}% lido`;
  if (unit === "PAGE")
    return total === null ? `Página ${position}` : `Página ${position} de ${total}${share}`;
  return total === null
    ? `${hours(position)} ouvidos`
    : `${hours(position)} de ${hours(total)}${share}`;
}

/** "+32 páginas", "+5%" or "+40min": what a day added. */
export function amountText(unit: ProgressUnit, amount: number): string {
  if (unit === "PAGE") return `+${amount} ${amount === 1 ? "página" : "páginas"}`;
  return unit === "PERCENT" ? `+${amount}%` : `+${hours(amount)}`;
}

/** "Ritmo: 18 páginas por dia", "Ritmo: 2,3% por dia" or "Ritmo: 25min por dia". */
export function paceText(unit: ProgressUnit, pace: number): string {
  if (unit === "PAGE") {
    const pages = Math.round(pace);
    return `Ritmo: ${pages} ${pages === 1 ? "página" : "páginas"} por dia`;
  }
  if (unit === "PERCENT") {
    return `Ritmo: ${pace.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% por dia`;
  }
  return `Ritmo: ${hours(Math.round(pace))} por dia`;
}
