// Book library (plan 035): registration, status changes and the lists other
// modules read (a goal's books, the open deadlines).

import type { Prisma } from "@/generated/prisma/client";
import type { BookFormat, BookReason, BookStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatDateOnly, parseDateOnly, todayInAppTimeZone } from "@/lib/dates";
import { isUuid } from "@/lib/form-fields";
import { isRecordNotFound } from "@/lib/prisma-errors";
import { type BookAction, applyBookAction, datesForStatus } from "@/modules/books/rules";
import type { BookInput } from "@/modules/books/schemas";
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
  /** ISO string, so the pure rules can order by it. */
  createdAt: string;
};

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

const include = { goal: { select: { id: true, title: true } } } satisfies Prisma.BookInclude;
type BookRow = Prisma.BookGetPayload<{ include: typeof include }>;

const toDate = (value: string | null) => (value === null ? null : parseDateOnly(value));
const fromDate = (value: Date | null) => (value === null ? null : formatDateOnly(value));

function toBook(row: BookRow): Book {
  return {
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
    createdAt: row.createdAt.toISOString(),
  };
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

export async function getBook(id: string): Promise<Book> {
  if (!isUuid(id)) throw new BookNotFoundError(id);
  const row = await db.book.findUnique({ where: { id }, include });
  if (!row) throw new BookNotFoundError(id);
  return toBook(row);
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
