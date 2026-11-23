import { describe, expect, it } from "vitest";

import {
  type BookSummary,
  applyBookAction,
  bookActions,
  bookProgress,
  currentLogs,
  finishForecast,
  groupBooks,
  isRequired,
  logAmounts,
  positionBounds,
  readingPace,
  shelfGroupOf,
  totalOf,
  unitOf,
} from "@/modules/books/rules";

const today = "2026-11-24";

function book(overrides: Partial<BookSummary> = {}): BookSummary {
  return {
    id: overrides.title ?? "1",
    title: "Livro",
    status: "TO_READ",
    reason: "PERSONAL",
    dueDate: null,
    startedOn: null,
    finishedOn: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("isRequired (plan 035)", () => {
  it("is true for work and PDI books, false for personal and recommended ones", () => {
    expect(isRequired("WORK")).toBe(true);
    expect(isRequired("PDI")).toBe(true);
    expect(isRequired("PERSONAL")).toBe(false);
    expect(isRequired("RECOMMENDATION")).toBe(false);
  });
});

describe("shelfGroupOf", () => {
  it("splits the queue into 'preciso ler' and 'quero ler' by the reason", () => {
    expect(shelfGroupOf(book({ reason: "WORK" }))).toBe("REQUIRED");
    expect(shelfGroupOf(book({ reason: "RECOMMENDATION" }))).toBe("WANTED");
    expect(shelfGroupOf(book({ status: "READING", reason: "PDI" }))).toBe("READING");
    expect(shelfGroupOf(book({ status: "READ" }))).toBe("READ");
    expect(shelfGroupOf(book({ status: "ABANDONED" }))).toBe("ABANDONED");
  });
});

describe("bookActions", () => {
  it("offers the buttons each status allows", () => {
    expect(bookActions("TO_READ")).toEqual(["START"]);
    expect(bookActions("READING")).toEqual(["FINISH", "ABANDON", "REQUEUE"]);
    expect(bookActions("READ")).toEqual(["REREAD"]);
    expect(bookActions("ABANDONED")).toEqual(["REQUEUE"]);
  });
});

describe("applyBookAction", () => {
  it("starting fills the start with today, keeping one already there", () => {
    expect(applyBookAction(book(), "START", today)).toEqual({
      status: "READING",
      startedOn: today,
      finishedOn: null,
    });
    expect(applyBookAction(book({ startedOn: "2026-11-10" }), "START", today)).toMatchObject({
      startedOn: "2026-11-10",
    });
  });

  it("finishing and abandoning fill the end with today", () => {
    const reading = book({ status: "READING", startedOn: "2026-11-10" });
    expect(applyBookAction(reading, "FINISH", today)).toEqual({
      status: "READ",
      startedOn: "2026-11-10",
      finishedOn: today,
    });
    expect(applyBookAction(reading, "ABANDON", today)).toMatchObject({
      status: "ABANDONED",
      finishedOn: today,
    });
  });

  it("going back to the queue clears both dates; reading again restarts today", () => {
    const abandoned = book({
      status: "ABANDONED",
      startedOn: "2026-10-01",
      finishedOn: "2026-10-20",
    });
    expect(applyBookAction(abandoned, "REQUEUE", today)).toEqual({
      status: "TO_READ",
      startedOn: null,
      finishedOn: null,
    });
    const read = book({ status: "READ", startedOn: "2026-10-01", finishedOn: "2026-10-20" });
    expect(applyBookAction(read, "REREAD", today)).toEqual({
      status: "READING",
      startedOn: today,
      finishedOn: null,
    });
  });

  it("gives null for an action the status does not allow", () => {
    expect(applyBookAction(book(), "FINISH", today)).toBeNull();
    expect(applyBookAction(book({ status: "READ" }), "ABANDON", today)).toBeNull();
  });
});

describe("groupBooks", () => {
  const books = [
    book({ title: "Querido novo", createdAt: "2026-11-20T10:00:00.000Z" }),
    book({ title: "Querido antigo", createdAt: "2026-11-02T10:00:00.000Z" }),
    book({ title: "Obrigatório sem prazo", reason: "WORK" }),
    book({ title: "Obrigatório tarde", reason: "PDI", dueDate: "2026-12-20" }),
    book({ title: "Obrigatório cedo", reason: "WORK", dueDate: "2026-12-01" }),
    book({ title: "Lendo antigo", status: "READING", startedOn: "2026-10-01" }),
    book({ title: "Lendo novo", status: "READING", startedOn: "2026-11-15" }),
    book({ title: "Lido B", status: "READ", finishedOn: "2026-11-10" }),
    book({ title: "Lido A", status: "READ", finishedOn: "2026-11-10" }),
    book({ title: "Lido antigo", status: "READ", finishedOn: "2026-09-10" }),
    book({ title: "Largado", status: "ABANDONED", finishedOn: "2026-08-01" }),
  ];
  const titles = (groups: ReturnType<typeof groupBooks>) =>
    groups.map((group) => [group.group, group.books.map((item) => item.title)]);

  it("shows reading, required and wanted books on the shelf, each in its order", () => {
    expect(titles(groupBooks(books, "SHELF"))).toEqual([
      ["READING", ["Lendo novo", "Lendo antigo"]],
      ["REQUIRED", ["Obrigatório cedo", "Obrigatório tarde", "Obrigatório sem prazo"]],
      ["WANTED", ["Querido novo", "Querido antigo"]],
    ]);
  });

  it("keeps a single group for each filter, with ties by title", () => {
    expect(titles(groupBooks(books, "READ"))).toEqual([
      ["READ", ["Lido A", "Lido B", "Lido antigo"]],
    ]);
    expect(titles(groupBooks(books, "ABANDONED"))).toEqual([["ABANDONED", ["Largado"]]]);
  });

  it("shows every group for all, leaving empty ones out", () => {
    expect(groupBooks(books, "ALL").map((group) => group.group)).toEqual([
      "READING",
      "REQUIRED",
      "WANTED",
      "READ",
      "ABANDONED",
    ]);
    expect(groupBooks([book({ status: "READ" })], "SHELF")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Reading progress (plan 036)
// ---------------------------------------------------------------------------

describe("unitOf and totalOf", () => {
  it("measures each format in its own unit, with its total", () => {
    expect(unitOf("PHYSICAL")).toBe("PAGE");
    expect(unitOf("EBOOK")).toBe("PERCENT");
    expect(unitOf("AUDIOBOOK")).toBe("MINUTE");
    expect(totalOf({ format: "PHYSICAL", pages: 456, durationMinutes: null })).toBe(456);
    expect(totalOf({ format: "PHYSICAL", pages: null, durationMinutes: 600 })).toBeNull();
    expect(totalOf({ format: "EBOOK", pages: 300, durationMinutes: null })).toBe(100);
    expect(totalOf({ format: "AUDIOBOOK", pages: 300, durationMinutes: 600 })).toBe(600);
  });
});

const log = (date: string, position: number) => ({ id: date, date, position });

describe("currentLogs and logAmounts", () => {
  it("keeps the logs of the current reading, oldest first", () => {
    const logs = [log("2026-11-20", 80), log("2026-09-01", 300), log("2026-11-18", 40)];
    expect(currentLogs(logs, "2026-11-15").map((item) => item.date)).toEqual([
      "2026-11-18",
      "2026-11-20",
    ]);
    expect(currentLogs(logs, null)).toHaveLength(3);
  });

  it("gives what each day added to the one before", () => {
    expect(
      logAmounts([log("2026-11-18", 40), log("2026-11-20", 72)]).map((item) => item.amount),
    ).toEqual([40, 32]);
  });
});

describe("positionBounds", () => {
  const logs = [log("2026-11-18", 40), log("2026-11-22", 100)];

  it("keeps a log between the one before and the one after, up to the total", () => {
    expect(positionBounds(logs, "2026-11-20", 456)).toEqual({ min: 40, max: 100 });
    expect(positionBounds(logs, "2026-11-23", 456)).toEqual({ min: 100, max: 456 });
    expect(positionBounds(logs, "2026-11-17", null)).toEqual({ min: 1, max: 40 });
    expect(positionBounds([], "2026-11-17", null)).toEqual({ min: 1, max: null });
  });

  it("ignores the log of the same day, which the new one replaces", () => {
    expect(positionBounds(logs, "2026-11-22", 456)).toEqual({ min: 40, max: 456 });
  });
});

describe("readingPace", () => {
  it("averages the last 14 days", () => {
    // 70 pages from the 10th (before the window) to the 24th: 140 in 14 days.
    const logs = [log("2026-11-05", 60), log("2026-11-10", 70), log("2026-11-24", 210)];
    expect(readingPace(logs, "2026-11-01", today)).toBe(10);
  });

  it("counts from the start when the reading is shorter than 14 days", () => {
    expect(readingPace([log("2026-11-23", 50)], "2026-11-20", today)).toBe(10);
  });

  it("is zero without logs", () => {
    expect(readingPace([], "2026-11-20", today)).toBe(0);
  });
});

describe("finishForecast", () => {
  it("adds the days left at the pace, rounded up", () => {
    expect(finishForecast({ position: 100, total: 456, pace: 18 }, today)).toBe("2026-12-14");
  });

  it("has no forecast without a total, without a pace or when the book is done", () => {
    expect(finishForecast({ position: 100, total: null, pace: 18 }, today)).toBeNull();
    expect(finishForecast({ position: 100, total: 456, pace: 0 }, today)).toBeNull();
    expect(finishForecast({ position: 456, total: 456, pace: 10 }, today)).toBeNull();
  });
});

describe("bookProgress", () => {
  const book = { format: "PHYSICAL" as const, pages: 456, durationMinutes: null };

  it("gives the position, the total and the percentage of the current reading", () => {
    expect(
      bookProgress({ ...book, status: "READING", startedOn: "2026-11-01" }, [
        log("2026-11-20", 114),
      ]),
    ).toEqual({
      unit: "PAGE",
      position: 114,
      total: 456,
      percent: 25,
    });
  });

  it("is complete for a read book, and without a percentage when there is no total", () => {
    expect(bookProgress({ ...book, status: "READ", startedOn: "2026-11-01" }, [])).toMatchObject({
      percent: 100,
    });
    expect(
      bookProgress({ ...book, pages: null, status: "READING", startedOn: null }, [
        log("2026-11-20", 30),
      ]),
    ).toMatchObject({ position: 30, total: null, percent: null });
  });
});
