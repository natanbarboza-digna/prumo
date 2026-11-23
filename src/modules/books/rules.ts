// Pure book rules (plan 035): no database access, so they are tested alone and
// can be imported by Client Components.

import type { BookFormat, BookReason, BookStatus } from "@/generated/prisma/enums";
import { addDays, daysBetween } from "@/lib/dates";

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

// ---------------------------------------------------------------------------
// Reading progress (plan 036)
// ---------------------------------------------------------------------------

/** What a log's position means: a page, a percentage or minutes listened. */
export type ProgressUnit = "PAGE" | "PERCENT" | "MINUTE";

const unitOfFormat: Record<BookFormat, ProgressUnit> = {
  PHYSICAL: "PAGE",
  EBOOK: "PERCENT",
  AUDIOBOOK: "MINUTE",
};

export function unitOf(format: BookFormat): ProgressUnit {
  return unitOfFormat[format];
}

/** The book's total in its unit; null when it was not filled in. */
export function totalOf(book: {
  format: BookFormat;
  pages: number | null;
  durationMinutes: number | null;
}): number | null {
  if (book.format === "EBOOK") return 100;
  return book.format === "AUDIOBOOK" ? book.durationMinutes : book.pages;
}

/** One day of reading: `date` is "YYYY-MM-DD"; `position`, where it stopped. */
export type ReadingLog = { id: string; date: string; position: number };

/** The logs of the current reading (from its start on), oldest first. */
export function currentLogs<Log extends ReadingLog>(
  logs: readonly Log[],
  startedOn: string | null,
): Log[] {
  return logs
    .filter((log) => startedOn === null || log.date >= startedOn)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Each log with what the day added to the one before (the first counts from zero). */
export function logAmounts<Log extends ReadingLog>(
  logs: readonly Log[],
): (Log & { amount: number })[] {
  return logs.map((log, index) => ({
    ...log,
    amount: log.position - (index === 0 ? 0 : logs[index - 1]!.position),
  }));
}

/**
 * Where a log on `date` may stop: not before the log of an earlier day, not
 * after the log of a later day nor past the total (null: no upper limit). A log
 * of the same day is replaced, so it does not count.
 */
export function positionBounds(
  logs: readonly ReadingLog[],
  date: string,
  total: number | null,
): { min: number; max: number | null } {
  const before = logs.filter((log) => log.date < date).map((log) => log.position);
  const after = logs.filter((log) => log.date > date).map((log) => log.position);
  const caps = [...after, ...(total === null ? [] : [total])];
  return {
    min: Math.max(1, ...before),
    max: caps.length === 0 ? null : Math.min(...caps),
  };
}

/** Days the reading pace looks back on. */
export const PACE_DAYS = 14;

/**
 * Units per day over the last 14 days (or since the start, when the reading is
 * shorter): what the position moved in that time, divided by its days.
 */
export function readingPace(
  logs: readonly ReadingLog[],
  startedOn: string | null,
  today: string,
): number {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.filter((log) => log.date <= today).at(-1);
  if (!latest) return 0;
  const windowStart = addDays(today, -(PACE_DAYS - 1));
  const from = startedOn !== null && startedOn > windowStart ? startedOn : windowStart;
  const base = sorted.filter((log) => log.date < from).at(-1)?.position ?? 0;
  return (latest.position - base) / (daysBetween(from, today) + 1);
}

/** The day the book should end at the pace, or null when it cannot be told. */
export function finishForecast(
  progress: { position: number; total: number | null; pace: number },
  today: string,
): string | null {
  const { position, total, pace } = progress;
  if (total === null || pace <= 0 || position >= total) return null;
  return addDays(today, Math.ceil((total - position) / pace));
}

export type BookProgress = {
  unit: ProgressUnit;
  position: number;
  total: number | null;
  /** Null without a total. */
  percent: number | null;
};

/** Where the current reading is; a read book is complete. */
export function bookProgress(
  book: {
    format: BookFormat;
    pages: number | null;
    durationMinutes: number | null;
    status: BookStatus;
    startedOn: string | null;
  },
  logs: readonly ReadingLog[],
): BookProgress {
  const unit = unitOf(book.format);
  const total = totalOf(book);
  const position = currentLogs(logs, book.startedOn).at(-1)?.position ?? 0;
  if (book.status === "READ") {
    return { unit, position: total ?? position, total, percent: 100 };
  }
  return {
    unit,
    position,
    total,
    percent: total === null ? null : Math.min(100, Math.round((position / total) * 100)),
  };
}
