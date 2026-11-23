// Book library (plan 035): registration, status changes and the lists other
// modules read (a goal's books, the open deadlines). Plan 036 adds the reading
// logs, the rating and review, and the quotes.

import type { Prisma } from "@/generated/prisma/client";
import type { BookFormat, BookReason, BookStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatDateOnly, parseDateOnly, todayInAppTimeZone } from "@/lib/dates";
import { isUuid } from "@/lib/form-fields";
import { isRecordNotFound } from "@/lib/prisma-errors";
import {
  type BookAction,
  type BookProgress,
  type ReadingLog,
  applyBookAction,
  bookProgress,
  currentLogs,
  datesForStatus,
  positionBounds,
  totalOf,
} from "@/modules/books/rules";
import type {
  BookInput,
  BookLogInput,
  BookQuoteInput,
  BookRatingInput,
} from "@/modules/books/schemas";
import { GoalNotFoundError } from "@/modules/goals/service";

export type Book = {
  id: string;
  title: string;
  authors: string;
  format: BookFormat;
  pages: number | null;
  genre: string | null;
  recommendedBy: string | null;
  notes: string | null;
  status: BookStatus;
  reason: BookReason;
  /** "YYYY-MM-DD" dates. */
  dueDate: string | null;
  startedOn: string | null;
  finishedOn: string | null;
  goal: { id: string; title: string } | null;
  /** Audiobook length, in minutes (plan 036). */
  durationMinutes: number | null;
  rating: number | null;
  review: string | null;
  /** Where the current reading is (plan 036). */
  progress: BookProgress;
  /** ISO string, so the pure rules can order by it. */
  createdAt: string;
};

export type BookQuote = { id: string; text: string; location: string | null };

/** The book page: every log (oldest first, old readings included) and the quotes (newest first). */
export type BookDetail = Book & { logs: ReadingLog[]; quotes: BookQuote[] };

/** A required book still to finish, with a due date (for the deadlines). */
export type OpenBook = { id: string; title: string; dueDate: string };

export class BookNotFoundError extends Error {
  constructor(id: string) {
    super(`Book not found: ${id}`);
    this.name = "BookNotFoundError";
  }
}

export class InvalidBookActionError extends Error {
  constructor(action: BookAction, status: BookStatus) {
    super(`Cannot ${action} a book that is ${status}`);
    this.name = "InvalidBookActionError";
  }
}

/** A start or end date after today. */
export class BookDateInFutureError extends Error {
  constructor(readonly field: "startedOn" | "finishedOn") {
    super(`Book ${field} is in the future`);
    this.name = "BookDateInFutureError";
  }
}

/** Only for a book being read. */
export class BookNotReadingError extends Error {
  constructor(id: string) {
    super(`Book is not being read: ${id}`);
    this.name = "BookNotReadingError";
  }
}

/** A log before the reading started or after today. */
export class BookLogDateError extends Error {
  constructor(readonly startedOn: string | null) {
    super("Reading log date outside the reading");
    this.name = "BookLogDateError";
  }
}

/** A position before the previous day's log, after the next one or past the total. */
export class BookLogPositionError extends Error {
  constructor(
    readonly min: number,
    readonly max: number | null,
  ) {
    super(`Reading log position out of bounds (${min} to ${max ?? "∞"})`);
    this.name = "BookLogPositionError";
  }
}

export class BookLogNotFoundError extends Error {
  constructor(id: string) {
    super(`Reading log not found: ${id}`);
    this.name = "BookLogNotFoundError";
  }
}

/** Pages, percentages and minutes do not convert: a book with logs keeps its format. */
export class BookFormatLockedError extends Error {
  constructor(id: string) {
    super(`Book has reading logs, its format cannot change: ${id}`);
    this.name = "BookFormatLockedError";
  }
}

/** A total below the furthest position already logged. */
export class BookTotalTooSmallError extends Error {
  constructor(readonly furthest: number) {
    super(`Book total below its furthest log (${furthest})`);
    this.name = "BookTotalTooSmallError";
  }
}

/** A rating for a book not read, or a review for one neither read nor abandoned. */
export class BookRatingNotAllowedError extends Error {
  constructor(id: string) {
    super(`Book cannot be rated or reviewed now: ${id}`);
    this.name = "BookRatingNotAllowedError";
  }
}

export class BookQuoteNotFoundError extends Error {
  constructor(id: string) {
    super(`Book quote not found: ${id}`);
    this.name = "BookQuoteNotFoundError";
  }
}

const include = {
  goal: { select: { id: true, title: true } },
  logs: { select: { id: true, date: true, position: true }, orderBy: { date: "asc" } },
} satisfies Prisma.BookInclude;
type BookRow = Prisma.BookGetPayload<{ include: typeof include }>;

const toDate = (value: string | null) => (value === null ? null : parseDateOnly(value));
const fromDate = (value: Date | null) => (value === null ? null : formatDateOnly(value));

function toLogs(row: BookRow): ReadingLog[] {
  return row.logs.map((log) => ({
    id: log.id,
    date: formatDateOnly(log.date),
    position: log.position,
  }));
}

function toBook(row: BookRow): Book {
  const book = {
    id: row.id,
    title: row.title,
    authors: row.authors,
    format: row.format,
    pages: row.pages,
    genre: row.genre,
    recommendedBy: row.recommendedBy,
    notes: row.notes,
    status: row.status,
    reason: row.reason,
    dueDate: fromDate(row.dueDate),
    startedOn: fromDate(row.startedOn),
    finishedOn: fromDate(row.finishedOn),
    goal: row.goal,
    durationMinutes: row.durationMinutes,
    rating: row.rating,
    review: row.review,
    createdAt: row.createdAt.toISOString(),
  };
  return { ...book, progress: bookProgress(book, toLogs(row)) };
}

/** Every book, or a goal's books; the list groups and orders them (rules.ts). */
export async function listBooks(options: { goalId?: string } = {}): Promise<Book[]> {
  const rows = await db.book.findMany({
    where: options.goalId ? { goalId: options.goalId } : {},
    include,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toBook);
}

export async function getBook(id: string): Promise<BookDetail> {
  if (!isUuid(id)) throw new BookNotFoundError(id);
  const row = await db.book.findUnique({
    where: { id },
    include: {
      ...include,
      quotes: { select: { id: true, text: true, location: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) throw new BookNotFoundError(id);
  return { ...toBook(row), logs: toLogs(row), quotes: row.quotes };
}

/** A new book always starts in the queue, without dates. */
export async function createBook(
  input: BookInput,
  today: string = todayInAppTimeZone(),
): Promise<Book> {
  await assertGoalExists(input.goalId);
  const row = await db.book.create({
    data: toData(input, "TO_READ", today),
    include,
  });
  return toBook(row);
}

/** Edits the book; the status stays and keeps only the dates it allows. */
export async function updateBook(
  id: string,
  input: BookInput,
  today: string = todayInAppTimeZone(),
): Promise<Book> {
  const current = await getBook(id);
  await assertGoalExists(input.goalId);
  if (current.logs.length > 0) {
    if (input.format !== current.format) throw new BookFormatLockedError(id);
    const total = totalOf(input);
    const furthest = Math.max(...current.logs.map((log) => log.position));
    if (total !== null && total < furthest) throw new BookTotalTooSmallError(furthest);
  }
  try {
    const row = await db.book.update({
      where: { id },
      data: toData(input, current.status, today),
      include,
    });
    return toBook(row);
  } catch (error) {
    if (isRecordNotFound(error)) throw new BookNotFoundError(id);
    throw error;
  }
}

/** One of the status buttons (rules.ts says which and what dates they set). */
export async function changeBookStatus(
  id: string,
  action: BookAction,
  today: string = todayInAppTimeZone(),
): Promise<Book> {
  const current = await getBook(id);
  const change = applyBookAction(current, action, today);
  if (change === null) throw new InvalidBookActionError(action, current.status);
  const row = await db.book.update({
    where: { id },
    data: {
      status: change.status,
      startedOn: toDate(change.startedOn),
      finishedOn: toDate(change.finishedOn),
    },
    include,
  });
  return toBook(row);
}

export async function deleteBook(id: string): Promise<void> {
  if (!isUuid(id)) throw new BookNotFoundError(id);
  try {
    await db.book.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFound(error)) throw new BookNotFoundError(id);
    throw error;
  }
}

/** Required books (work or PDI) in the queue or being read that have a due date, soonest first. */
export async function listOpenBooksWithDueDate(): Promise<OpenBook[]> {
  const rows = await db.book.findMany({
    where: {
      reason: { in: ["WORK", "PDI"] },
      status: { in: ["TO_READ", "READING"] },
      dueDate: { not: null },
    },
    select: { id: true, title: true, dueDate: true },
    orderBy: [{ dueDate: "asc" }, { title: "asc" }],
  });
  return rows.flatMap((row) =>
    row.dueDate === null
      ? []
      : [{ id: row.id, title: row.title, dueDate: formatDateOnly(row.dueDate) }],
  );
}

function toData(input: BookInput, status: BookStatus, today: string) {
  const dates = datesForStatus(status, input);
  // "YYYY-MM-DD" strings compare in calendar order.
  if (dates.startedOn !== null && dates.startedOn > today) {
    throw new BookDateInFutureError("startedOn");
  }
  if (dates.finishedOn !== null && dates.finishedOn > today) {
    throw new BookDateInFutureError("finishedOn");
  }
  return {
    title: input.title,
    authors: input.authors,
    format: input.format,
    pages: input.pages,
    genre: input.genre,
    recommendedBy: input.recommendedBy,
    notes: input.notes,
    reason: input.reason,
    dueDate: toDate(input.dueDate),
    goalId: input.goalId,
    durationMinutes: input.durationMinutes,
    status,
    startedOn: toDate(dates.startedOn),
    finishedOn: toDate(dates.finishedOn),
  };
}

async function assertGoalExists(goalId: string | null): Promise<void> {
  if (goalId === null) return;
  const count = await db.goal.count({ where: { id: goalId } });
  if (count === 0) throw new GoalNotFoundError(goalId);
}

// ---------------------------------------------------------------------------
// Reading logs (plan 036)
// ---------------------------------------------------------------------------

/**
 * Logs where the reading stopped on `date`, replacing that day's log. Only for
 * a book being read, from its start to today, between the logs of the days
 * around it and not past the total.
 */
export async function logReading(
  bookId: string,
  input: BookLogInput,
  today: string = todayInAppTimeZone(),
): Promise<ReadingLog> {
  const book = await getBook(bookId);
  if (book.status !== "READING") throw new BookNotReadingError(bookId);
  // "YYYY-MM-DD" strings compare in calendar order.
  if (input.date > today || (book.startedOn !== null && input.date < book.startedOn)) {
    throw new BookLogDateError(book.startedOn);
  }
  const { min, max } = positionBounds(
    currentLogs(book.logs, book.startedOn),
    input.date,
    totalOf(book),
  );
  if (input.position < min || (max !== null && input.position > max)) {
    throw new BookLogPositionError(min, max);
  }
  const date = parseDateOnly(input.date);
  const row = await db.bookLog.upsert({
    where: { bookId_date: { bookId, date } },
    create: { bookId, date, position: input.position },
    update: { position: input.position },
  });
  return { id: row.id, date: input.date, position: row.position };
}

/** Returns the book's id, so the action can refresh its page. */
export async function deleteBookLog(id: string): Promise<string> {
  if (!isUuid(id)) throw new BookLogNotFoundError(id);
  try {
    return (await db.bookLog.delete({ where: { id }, select: { bookId: true } })).bookId;
  } catch (error) {
    if (isRecordNotFound(error)) throw new BookLogNotFoundError(id);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Rating, review and quotes (plan 036)
// ---------------------------------------------------------------------------

/** A rating only for a read book; a review for a read or abandoned one. The status stays. */
export async function rateBook(id: string, input: BookRatingInput): Promise<Book> {
  const book = await getBook(id);
  const rated = input.rating !== null && book.status !== "READ";
  const reviewed = input.review !== null && book.status !== "READ" && book.status !== "ABANDONED";
  if (rated || reviewed) throw new BookRatingNotAllowedError(id);
  const row = await db.book.update({
    where: { id },
    data: { rating: input.rating, review: input.review },
    include,
  });
  return toBook(row);
}

export async function createQuote(bookId: string, input: BookQuoteInput): Promise<BookQuote> {
  await getBook(bookId);
  return db.bookQuote.create({
    data: { bookId, text: input.text, location: input.location },
    select: { id: true, text: true, location: true },
  });
}

export async function updateQuote(id: string, input: BookQuoteInput): Promise<BookQuote> {
  if (!isUuid(id)) throw new BookQuoteNotFoundError(id);
  try {
    return await db.bookQuote.update({
      where: { id },
      data: { text: input.text, location: input.location },
      select: { id: true, text: true, location: true },
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new BookQuoteNotFoundError(id);
    throw error;
  }
}

export async function deleteQuote(id: string): Promise<void> {
  if (!isUuid(id)) throw new BookQuoteNotFoundError(id);
  try {
    await db.bookQuote.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFound(error)) throw new BookQuoteNotFoundError(id);
    throw error;
  }
}
