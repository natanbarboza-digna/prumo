import { describe, expect, it } from "vitest";

import {
  type BookSummary,
  applyBookAction,
  bookActions,
  groupBooks,
  isRequired,
  shelfGroupOf,
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
