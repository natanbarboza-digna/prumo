// Pure book rules (plan 035): no database access, so they are tested alone and
// can be imported by Client Components.

import type { BookReason, BookStatus } from "@/generated/prisma/enums";

/** "Preciso ler": a book for work or for the PDI. The others are "quero ler". */
export function isRequired(reason: BookReason): boolean {
  return reason === "WORK" || reason === "PDI";
}

/** What the rules need from a book. Dates are "YYYY-MM-DD"; `createdAt` an ISO string. */
export type BookSummary = {
  id: string;
  title: string;
  status: BookStatus;
  reason: BookReason;
  dueDate: string | null;
  startedOn: string | null;
  finishedOn: string | null;
  createdAt: string;
};

/** The list's groups, in screen order: the queue splits by the reason. */
export const SHELF_GROUPS = ["READING", "REQUIRED", "WANTED", "READ", "ABANDONED"] as const;
export type ShelfGroup = (typeof SHELF_GROUPS)[number];

export function shelfGroupOf(book: Pick<BookSummary, "status" | "reason">): ShelfGroup {
  if (book.status === "TO_READ") return isRequired(book.reason) ? "REQUIRED" : "WANTED";
  return book.status;
}

/** The list's filter (`?situacao=`): the shelf, each group, or all. */
export const BOOK_FILTERS = ["SHELF", ...SHELF_GROUPS, "ALL"] as const;
export type BookFilter = (typeof BOOK_FILTERS)[number];

const groupsOf: Record<BookFilter, readonly ShelfGroup[]> = {
  SHELF: ["READING", "REQUIRED", "WANTED"],
  READING: ["READING"],
  REQUIRED: ["REQUIRED"],
  WANTED: ["WANTED"],
  READ: ["READ"],
  ABANDONED: ["ABANDONED"],
  ALL: SHELF_GROUPS,
};

export type BookGroup<Book extends BookSummary> = { group: ShelfGroup; books: Book[] };

/** Newest first; a missing value goes last. */
const newestFirst = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : b.localeCompare(a);
/** Soonest first; a missing value goes last. */
const soonestFirst = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b);

const orderOf: Record<ShelfGroup, (a: BookSummary, b: BookSummary) => number> = {
  READING: (a, b) => newestFirst(a.startedOn, b.startedOn),
  REQUIRED: (a, b) => soonestFirst(a.dueDate, b.dueDate),
  WANTED: (a, b) => newestFirst(a.createdAt, b.createdAt),
  READ: (a, b) => newestFirst(a.finishedOn, b.finishedOn),
  ABANDONED: (a, b) => newestFirst(a.finishedOn, b.finishedOn),
};

/** The groups a filter shows, each in its order (ties by title); empty groups are left out. */
export function groupBooks<Book extends BookSummary>(
  books: readonly Book[],
  filter: BookFilter,
): BookGroup<Book>[] {
  return groupsOf[filter].flatMap((group) => {
    const items = books
      .filter((book) => shelfGroupOf(book) === group)
      .sort((a, b) => orderOf[group](a, b) || a.title.localeCompare(b.title, "pt-BR"));
    return items.length === 0 ? [] : [{ group, books: items }];
  });
}

/** The status buttons on the book page. */
export type BookAction = "START" | "FINISH" | "ABANDON" | "REQUEUE" | "REREAD";

const actionsOf: Record<BookStatus, readonly BookAction[]> = {
  TO_READ: ["START"],
  READING: ["FINISH", "ABANDON", "REQUEUE"],
  READ: ["REREAD"],
  ABANDONED: ["REQUEUE"],
};

export function bookActions(status: BookStatus): readonly BookAction[] {
  return actionsOf[status];
}

export type BookStatusChange = {
  status: BookStatus;
  startedOn: string | null;
  finishedOn: string | null;
};

/** The new status and dates after an action, or null when the status does not allow it. */
export function applyBookAction(
  book: Pick<BookSummary, "status" | "startedOn" | "finishedOn">,
  action: BookAction,
  today: string,
): BookStatusChange | null {
  if (!actionsOf[book.status].includes(action)) return null;
  switch (action) {
    case "START":
      return { status: "READING", startedOn: book.startedOn ?? today, finishedOn: null };
    case "FINISH":
      return { status: "READ", startedOn: book.startedOn, finishedOn: today };
    case "ABANDON":
      return { status: "ABANDONED", startedOn: book.startedOn, finishedOn: today };
    case "REQUEUE":
      return { status: "TO_READ", startedOn: null, finishedOn: null };
    case "REREAD":
      return { status: "READING", startedOn: today, finishedOn: null };
  }
}

/** Which dates a status keeps: none in the queue, only the start while reading. */
export function datesForStatus(
  status: BookStatus,
  dates: { startedOn: string | null; finishedOn: string | null },
): { startedOn: string | null; finishedOn: string | null } {
  if (status === "TO_READ") return { startedOn: null, finishedOn: null };
  if (status === "READING") return { startedOn: dates.startedOn, finishedOn: null };
  return dates;
}
