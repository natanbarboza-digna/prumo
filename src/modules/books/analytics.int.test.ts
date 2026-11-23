import { describe, expect, it } from "vitest";

import type { BookInput } from "@/modules/books/schemas";
import {
  changeBookStatus,
  createBook,
  getReadingGoal,
  getReadingYear,
  logReading,
  readingYears,
  setReadingGoal,
} from "@/modules/books/service";
import { getDashboard } from "@/modules/dashboard/service";

const today = "2026-11-24";

function bookInput(overrides: Partial<BookInput> = {}): BookInput {
  return {
    title: "Livro",
    authors: "Autor",
    format: "PHYSICAL",
    pages: 300,
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

async function readBook(title: string, startedOn: string, finishedOn: string) {
  const book = await createBook(bookInput({ title }), today);
  await changeBookStatus(book.id, "START", startedOn);
  await changeBookStatus(book.id, "FINISH", finishedOn);
  return book;
}

describe("reading goal (plan 037)", () => {
  it("sets one goal per year and changes it", async () => {
    expect(await getReadingGoal(2026)).toBeNull();

    await setReadingGoal({ year: 2026, books: 12 });
    await setReadingGoal({ year: 2026, books: 15 });
    await setReadingGoal({ year: 2025, books: 10 });

    expect(await getReadingGoal(2026)).toEqual({ year: 2026, books: 15 });
    expect(await getReadingGoal(2025)).toEqual({ year: 2025, books: 10 });
  });
});

describe("reading years and data", () => {
  it("lists the years with finished books, logs or a goal, plus the current one", async () => {
    await readBook("Antigo", "2024-03-01", "2024-03-10");
    await setReadingGoal({ year: 2025, books: 5 });

    expect(await readingYears(today)).toEqual([2026, 2025, 2024]);
  });

  it("reads every book and log for the analytics", async () => {
    await readBook("Lido", "2026-02-01", "2026-02-10");
    const reading = await createBook(bookInput({ title: "Lendo" }), today);
    await changeBookStatus(reading.id, "START", "2026-11-01");
    await logReading(reading.id, { date: "2026-11-20", position: 40 }, today);

    const data = await getReadingYear();

    expect(data.books.map((book) => [book.title, book.status, book.finishedOn]).sort()).toEqual([
      ["Lendo", "READING", null],
      ["Lido", "READ", "2026-02-10"],
    ]);
    expect(data.logs).toEqual([{ bookId: reading.id, date: "2026-11-20", position: 40 }]);
  });
});

describe("reading on the dashboard", () => {
  it("shows the year's goal and up to three books being read, with their percentage", async () => {
    await setReadingGoal({ year: 2026, books: 12 });
    await readBook("Lido este ano", "2026-05-01", "2026-05-20");
    await readBook("Lido no ano passado", "2025-05-01", "2025-05-20");
    for (const [index, title] of ["Um", "Dois", "Três", "Quatro"].entries()) {
      const book = await createBook(bookInput({ title }), today);
      await changeBookStatus(book.id, "START", `2026-11-0${index + 1}`);
      if (title === "Um") await logReading(book.id, { date: "2026-11-10", position: 75 }, today);
    }

    const { reading } = await getDashboard(today, 600);

    expect(reading.goal).toMatchObject({ target: 12, read: 1 });
    expect(reading.books).toHaveLength(3);
    // Most recently started first.
    expect(reading.books.map((book) => book.title)).toEqual(["Quatro", "Três", "Dois"]);
    expect(reading.visible).toBe(true);
  });

  it("has no reading block without books nor a goal", async () => {
    const { reading } = await getDashboard(today, 600);

    expect(reading).toEqual({ visible: false, goal: null, books: [] });
  });
});
