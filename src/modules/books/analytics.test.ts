import { describe, expect, it } from "vitest";

import {
  type AnalyticsBook,
  dailyAmounts,
  goalProgress,
  readingAnalytics,
} from "@/modules/books/analytics";

const today = "2026-11-24";

function book(overrides: Partial<AnalyticsBook> = {}): AnalyticsBook {
  return {
    id: overrides.title ?? "1",
    title: "Livro",
    authors: "Autor",
    genre: null,
    format: "PHYSICAL",
    pages: null,
    status: "READ",
    startedOn: null,
    finishedOn: null,
    rating: null,
    ...overrides,
  };
}

describe("goalProgress (plan 037)", () => {
  // November 24 is day 328 of 365: 12 × 328 / 365 = 10.78 books expected.
  it("compares the books read with the share of the goal the days call for", () => {
    expect(goalProgress({ target: 12, read: 9, year: 2026 }, today)).toMatchObject({
      expected: 10.8,
      ahead: -1,
    });
    expect(goalProgress({ target: 12, read: 12, year: 2026 }, today)).toMatchObject({ ahead: 1 });
    expect(goalProgress({ target: 12, read: 10, year: 2026 }, today)).toMatchObject({ ahead: 0 });
  });

  it("counts the leap day in a leap year", () => {
    // February 29, 2028 is day 60 of 366.
    expect(goalProgress({ target: 366, read: 0, year: 2028 }, "2028-02-29").expected).toBe(60);
  });

  it("only tells the result of a past year, and expects nothing yet of a future one", () => {
    expect(goalProgress({ target: 12, read: 13, year: 2025 }, today)).toEqual({
      target: 12,
      read: 13,
      expected: null,
      ahead: null,
      met: true,
    });
    expect(goalProgress({ target: 12, read: 0, year: 2027 }, today)).toMatchObject({
      expected: 0,
      ahead: 0,
    });
  });
});

describe("dailyAmounts", () => {
  it("gives what each log added, in pages or minutes by the format", () => {
    const books = [
      book({ id: "p", format: "PHYSICAL", pages: 300 }),
      book({ id: "e", format: "EBOOK", pages: 200 }),
      book({ id: "x", format: "EBOOK", pages: null }),
      book({ id: "a", format: "AUDIOBOOK" }),
    ];
    const logs = [
      { bookId: "p", date: "2026-11-01", position: 40 },
      { bookId: "p", date: "2026-11-02", position: 70 },
      { bookId: "e", date: "2026-11-02", position: 10 },
      { bookId: "x", date: "2026-11-02", position: 50 },
      { bookId: "a", date: "2026-11-03", position: 90 },
    ];

    expect(dailyAmounts(books, logs)).toEqual([
      { date: "2026-11-01", pages: 40, minutes: 0 },
      { date: "2026-11-02", pages: 50, minutes: 0 },
      { date: "2026-11-03", pages: 0, minutes: 90 },
    ]);
  });

  it("counts from zero when the position goes back (the book was read again)", () => {
    const logs = [
      { bookId: "p", date: "2026-10-01", position: 300 },
      { bookId: "p", date: "2026-11-01", position: 20 },
    ];
    expect(dailyAmounts([book({ id: "p" })], logs).map((day) => day.pages)).toEqual([300, 20]);
  });
});

describe("readingAnalytics", () => {
  const books = [
    book({
      title: "A",
      authors: "José Saramago",
      genre: "Romance",
      startedOn: "2026-01-01",
      finishedOn: "2026-01-10",
      rating: 5,
    }),
    book({
      title: "B",
      authors: "jose saramago ",
      genre: "romance",
      startedOn: "2026-03-05",
      finishedOn: "2026-03-05",
      rating: 4,
    }),
    book({ title: "C", authors: "Clarice Lispector", genre: "Contos", finishedOn: "2026-03-20" }),
    book({ title: "D", status: "ABANDONED", startedOn: "2026-04-01", finishedOn: "2026-04-03" }),
    book({ title: "E", finishedOn: "2025-12-30" }),
    book({ title: "F", status: "READING", startedOn: "2026-11-01" }),
  ];
  const logs = [
    { bookId: "F", date: "2026-11-10", position: 50 },
    { bookId: "F", date: "2026-11-23", position: 80 },
  ];

  it("counts the year's read and abandoned books, pages, hours and the average rating", () => {
    const result = readingAnalytics(books, logs, 2026, today);

    expect(result).toMatchObject({
      read: 3,
      abandoned: 1,
      pages: 80,
      minutes: 0,
      averageRating: 4.5,
    });
    expect(result.byMonth).toEqual([1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("sums the pages of the last 12 weeks, Monday to Sunday", () => {
    const weeks = readingAnalytics(books, logs, 2026, today).weeklyPages;

    expect(weeks).toHaveLength(12);
    expect(weeks[0]?.monday).toBe("2026-09-07");
    expect(weeks.at(-1)).toEqual({ monday: "2026-11-23", pages: 30 });
    expect(weeks.at(-3)).toEqual({ monday: "2026-11-09", pages: 50 });
  });

  it("averages the days per book, counting both ends, without books lacking a start", () => {
    expect(readingAnalytics(books, logs, 2026, today).duration).toEqual({
      average: 5.5,
      fastest: { title: "B", days: 1 },
      slowest: { title: "A", days: 10 },
    });
  });

  it("ranks authors and genres regardless of case, accents and spaces", () => {
    const result = readingAnalytics(books, logs, 2026, today);

    expect(result.topAuthors).toEqual([
      { name: "jose saramago", books: 2 },
      { name: "Clarice Lispector", books: 1 },
    ]);
    expect(result.topGenres).toEqual([
      { name: "romance", books: 2 },
      { name: "Contos", books: 1 },
    ]);
  });

  it("ends a past year's weeks on its last day, and has nothing for a year without reading", () => {
    expect(readingAnalytics(books, logs, 2025, today).weeklyPages.at(-1)?.monday).toBe(
      "2025-12-29",
    );
    expect(readingAnalytics([], [], 2024, today)).toMatchObject({
      read: 0,
      abandoned: 0,
      pages: 0,
      averageRating: null,
      duration: { average: null, fastest: null, slowest: null },
      topAuthors: [],
    });
  });
});
