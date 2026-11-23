import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import type { BookInput } from "@/modules/books/schemas";
import {
  BookFormatLockedError,
  BookLogDateError,
  BookLogNotFoundError,
  BookLogPositionError,
  BookNotReadingError,
  BookQuoteNotFoundError,
  BookRatingNotAllowedError,
  BookTotalTooSmallError,
  changeBookStatus,
  createBook,
  createQuote,
  deleteBook,
  deleteBookLog,
  deleteQuote,
  getBook,
  listBooks,
  logReading,
  rateBook,
  updateBook,
  updateQuote,
} from "@/modules/books/service";

const today = "2026-11-24";

function bookInput(overrides: Partial<BookInput> = {}): BookInput {
  return {
    title: "Refatoração",
    authors: "Martin Fowler",
    format: "PHYSICAL",
    pages: 400,
    genre: null,
    recommendedBy: null,
    notes: null,
    reason: "PERSONAL",
    dueDate: null,
    goalId: null,
    startedOn: null,
    finishedOn: null,
    durationMinutes: null,
    ...overrides,
  };
}

/** A book being read since `startedOn`. */
async function reading(overrides: Partial<BookInput> = {}, startedOn = "2026-11-10") {
  const book = await createBook(bookInput(overrides), today);
  await changeBookStatus(book.id, "START", startedOn);
  return book;
}

describe("reading logs (plan 036)", () => {
  it("logs where the reading stopped, one per day, with the progress and the pace", async () => {
    const book = await reading();

    await logReading(book.id, { date: "2026-11-12", position: 40 }, today);
    await logReading(book.id, { date: "2026-11-20", position: 100 }, today);
    // The same day again replaces the log.
    await logReading(book.id, { date: "2026-11-20", position: 110 }, today);

    const detail = await getBook(book.id);
    expect(detail.logs.map((log) => [log.date, log.position])).toEqual([
      ["2026-11-12", 40],
      ["2026-11-20", 110],
    ]);
    expect(detail.progress).toEqual({ unit: "PAGE", position: 110, total: 400, percent: 28 });
    expect((await listBooks())[0]?.progress.percent).toBe(28);
  });

  it("refuses a book not being read, a date outside the reading and a position out of bounds", async () => {
    const queued = await createBook(bookInput({ title: "Na fila" }), today);
    await expect(logReading(queued.id, { date: today, position: 10 }, today)).rejects.toThrow(
      BookNotReadingError,
    );

    const book = await reading();
    await expect(logReading(book.id, { date: "2026-11-09", position: 10 }, today)).rejects.toThrow(
      BookLogDateError,
    );
    await expect(logReading(book.id, { date: "2026-11-25", position: 10 }, today)).rejects.toThrow(
      BookLogDateError,
    );

    await logReading(book.id, { date: "2026-11-15", position: 80 }, today);
    await expect(logReading(book.id, { date: today, position: 60 }, today)).rejects.toThrow(
      BookLogPositionError,
    );
    await expect(logReading(book.id, { date: today, position: 401 }, today)).rejects.toThrow(
      BookLogPositionError,
    );
    await expect(logReading(book.id, { date: "2026-11-12", position: 90 }, today)).rejects.toThrow(
      BookLogPositionError,
    );
  });

  it("deletes a log, and reading again starts a new count", async () => {
    const book = await reading();
    await logReading(book.id, { date: "2026-11-12", position: 400 }, today);
    await changeBookStatus(book.id, "FINISH", "2026-11-15");
    await changeBookStatus(book.id, "REREAD", "2026-11-20");
    const log = await logReading(book.id, { date: today, position: 30 }, today);

    let detail = await getBook(book.id);
    expect(detail.logs).toHaveLength(2);
    expect(detail.progress.position).toBe(30);

    await deleteBookLog(log.id);
    detail = await getBook(book.id);
    expect(detail.progress.position).toBe(0);
    await expect(deleteBookLog(log.id)).rejects.toThrow(BookLogNotFoundError);
  });
});

describe("format and total after logs", () => {
  it("refuses a new format or a total below the furthest position", async () => {
    const book = await reading();
    await logReading(book.id, { date: "2026-11-12", position: 250 }, today);

    await expect(
      updateBook(book.id, bookInput({ format: "EBOOK", startedOn: "2026-11-10" }), today),
    ).rejects.toThrow(BookFormatLockedError);
    await expect(
      updateBook(book.id, bookInput({ pages: 200, startedOn: "2026-11-10" }), today),
    ).rejects.toThrow(BookTotalTooSmallError);
    await expect(
      updateBook(book.id, bookInput({ pages: 300, startedOn: "2026-11-10" }), today),
    ).resolves.toMatchObject({ pages: 300 });
  });

  it("measures an audiobook in minutes against its length", async () => {
    const book = await reading({ format: "AUDIOBOOK", pages: null, durationMinutes: 600 });
    await logReading(book.id, { date: today, position: 200 }, today);

    expect((await getBook(book.id)).progress).toEqual({
      unit: "MINUTE",
      position: 200,
      total: 600,
      percent: 33,
    });
  });
});

describe("rating, review and quotes", () => {
  it("rates only a read book; reviews a read or abandoned one", async () => {
    const book = await reading();
    await expect(rateBook(book.id, { rating: 4, review: null })).rejects.toThrow(
      BookRatingNotAllowedError,
    );
    await expect(rateBook(book.id, { rating: null, review: "Ainda lendo" })).rejects.toThrow(
      BookRatingNotAllowedError,
    );

    await changeBookStatus(book.id, "FINISH", today);
    await expect(rateBook(book.id, { rating: 4, review: "Muito bom." })).resolves.toMatchObject({
      rating: 4,
      review: "Muito bom.",
      status: "READ",
    });

    const abandoned = await reading({ title: "Largado" });
    await changeBookStatus(abandoned.id, "ABANDON", today);
    await expect(rateBook(abandoned.id, { rating: 2, review: null })).rejects.toThrow(
      BookRatingNotAllowedError,
    );
    await expect(
      rateBook(abandoned.id, { rating: null, review: "Lento demais." }),
    ).resolves.toMatchObject({ review: "Lento demais." });
  });

  it("creates, edits and deletes quotes, newest first", async () => {
    const book = await createBook(bookInput(), today);
    const first = await createQuote(book.id, { text: "Primeiro", location: "p. 10" });
    await createQuote(book.id, { text: "Segundo", location: null });
    await updateQuote(first.id, { text: "Primeiro, revisto", location: "p. 11" });

    expect((await getBook(book.id)).quotes.map((quote) => [quote.text, quote.location])).toEqual([
      ["Segundo", null],
      ["Primeiro, revisto", "p. 11"],
    ]);

    await deleteQuote(first.id);
    await expect(deleteQuote(first.id)).rejects.toThrow(BookQuoteNotFoundError);
    await expect(updateQuote(first.id, { text: "x", location: null })).rejects.toThrow(
      BookQuoteNotFoundError,
    );
  });

  it("deleting the book takes its logs and quotes", async () => {
    const book = await reading();
    await logReading(book.id, { date: today, position: 10 }, today);
    await createQuote(book.id, { text: "Trecho", location: null });

    await deleteBook(book.id);

    await expect(db.bookLog.count()).resolves.toBe(0);
    await expect(db.bookQuote.count()).resolves.toBe(0);
  });
});
