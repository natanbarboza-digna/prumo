import { describe, expect, it } from "vitest";

import type { BookInput } from "@/modules/books/schemas";
import {
  BookDateInFutureError,
  BookNotFoundError,
  InvalidBookActionError,
  changeBookStatus,
  createBook,
  deleteBook,
  getBook,
  listBooks,
  listOpenBooksWithDueDate,
  updateBook,
} from "@/modules/books/service";
import { createGoal, deleteGoal } from "@/modules/goals/service";
import { GoalNotFoundError } from "@/modules/goals/service";

const today = "2026-11-24";

function bookInput(overrides: Partial<BookInput> = {}): BookInput {
  return {
    title: "Duna",
    authors: "Frank Herbert",
    format: "PHYSICAL",
    pages: 600,
    genre: "Ficção científica",
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

async function goal(title = "Ler mais") {
  return createGoal({ title, description: null, status: "IN_PROGRESS", targetDate: null });
}

describe("books (plan 035)", () => {
  it("creates a book in the queue with its goal, and reads it back", async () => {
    const linked = await goal();

    const created = await createBook(
      bookInput({ goalId: linked.id, startedOn: "2026-11-01" }),
      today,
    );

    const book = await getBook(created.id);
    expect(book).toMatchObject({
      title: "Duna",
      authors: "Frank Herbert",
      pages: 600,
      status: "TO_READ",
      reason: "PERSONAL",
      goal: { id: linked.id, title: "Ler mais" },
      // A book in the queue keeps no dates.
      startedOn: null,
      finishedOn: null,
      durationMinutes: null,
    });
  });

  it("refuses an unknown goal and dates in the future", async () => {
    await expect(
      createBook(bookInput({ goalId: "0190d4e2-0000-7000-8000-000000000000" }), today),
    ).rejects.toThrow(GoalNotFoundError);

    const book = await createBook(bookInput(), today);
    await changeBookStatus(book.id, "START", today);
    await expect(
      updateBook(book.id, bookInput({ startedOn: "2026-11-25" }), today),
    ).rejects.toThrow(BookDateInFutureError);
  });

  it("edits the book, keeping the dates its status allows", async () => {
    const book = await createBook(bookInput(), today);
    await changeBookStatus(book.id, "START", today);

    const edited = await updateBook(
      book.id,
      bookInput({
        title: "Duna (edição nova)",
        reason: "WORK",
        dueDate: "2026-12-31",
        startedOn: "2026-11-10",
        finishedOn: "2026-11-20",
      }),
      today,
    );

    expect(edited).toMatchObject({
      title: "Duna (edição nova)",
      reason: "WORK",
      dueDate: "2026-12-31",
      status: "READING",
      startedOn: "2026-11-10",
      // Still reading: no end date.
      finishedOn: null,
      durationMinutes: null,
    });
  });

  it("changes the status with its dates and refuses an action the status does not allow", async () => {
    const book = await createBook(bookInput(), today);

    expect(await changeBookStatus(book.id, "START", "2026-11-10")).toMatchObject({
      status: "READING",
      startedOn: "2026-11-10",
    });
    expect(await changeBookStatus(book.id, "FINISH", today)).toMatchObject({
      status: "READ",
      startedOn: "2026-11-10",
      finishedOn: today,
    });
    await expect(changeBookStatus(book.id, "ABANDON", today)).rejects.toThrow(
      InvalidBookActionError,
    );
  });

  it("deletes a book, and a deleted goal only clears the link", async () => {
    const linked = await goal();
    const kept = await createBook(bookInput({ goalId: linked.id }), today);
    const gone = await createBook(bookInput({ title: "Outro" }), today);

    await deleteGoal(linked.id);
    await deleteBook(gone.id);

    expect((await getBook(kept.id)).goal).toBeNull();
    await expect(getBook(gone.id)).rejects.toThrow(BookNotFoundError);
    await expect(deleteBook(gone.id)).rejects.toThrow(BookNotFoundError);
    await expect(getBook("não-é-uuid")).rejects.toThrow(BookNotFoundError);
  });

  it("lists every book, or a goal's books", async () => {
    const linked = await goal();
    await createBook(bookInput({ title: "Do objetivo", goalId: linked.id }), today);
    await createBook(bookInput({ title: "Solto" }), today);

    expect((await listBooks()).map((book) => book.title).sort()).toEqual(["Do objetivo", "Solto"]);
    expect((await listBooks({ goalId: linked.id })).map((book) => book.title)).toEqual([
      "Do objetivo",
    ]);
  });

  it("lists required books with a due date that are in the queue or being read", async () => {
    const queued = await createBook(
      bookInput({ title: "Na fila", reason: "WORK", dueDate: "2026-12-01" }),
      today,
    );
    const reading = await createBook(
      bookInput({ title: "Lendo", reason: "PDI", dueDate: "2026-11-20" }),
      today,
    );
    await changeBookStatus(reading.id, "START", today);
    const read = await createBook(
      bookInput({ title: "Lido", reason: "WORK", dueDate: "2026-11-01" }),
      today,
    );
    await changeBookStatus(read.id, "START", today);
    await changeBookStatus(read.id, "FINISH", today);
    await createBook(bookInput({ title: "Sem prazo", reason: "WORK" }), today);

    expect(await listOpenBooksWithDueDate()).toEqual([
      { id: reading.id, title: "Lendo", dueDate: "2026-11-20" },
      { id: queued.id, title: "Na fila", dueDate: "2026-12-01" },
    ]);
  });
});
