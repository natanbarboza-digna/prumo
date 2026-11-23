import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  bookFilterSchema,
  bookInputSchema,
  bookLogSchema,
  bookQuoteSchema,
  bookRatingSchema,
} from "@/modules/books/schemas";

function fieldErrors(input: unknown) {
  const result = bookInputSchema.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return z.flattenError(result.error).fieldErrors;
}

describe("bookInputSchema (plan 035)", () => {
  it("accepts the minimum input and fills the defaults", () => {
    expect(bookInputSchema.parse({ title: " Duna ", authors: "Frank Herbert" })).toEqual({
      title: "Duna",
      authors: "Frank Herbert",
      format: "PHYSICAL",
      pages: null,
      genre: null,
      recommendedBy: null,
      notes: null,
      reason: "PERSONAL",
      dueDate: null,
      goalId: null,
      startedOn: null,
      finishedOn: null,
      durationMinutes: null,
    });
  });

  it("reads the pages as a whole number from 1 to 10,000", () => {
    expect(bookInputSchema.parse({ title: "A", authors: "B", pages: "320" }).pages).toBe(320);
    expect(fieldErrors({ title: "A", authors: "B", pages: "0" }).pages).toBeDefined();
    expect(fieldErrors({ title: "A", authors: "B", pages: "10001" }).pages).toBeDefined();
    expect(fieldErrors({ title: "A", authors: "B", pages: "12,5" }).pages).toBeDefined();
  });

  it("requires the title and the authors, within their limits", () => {
    const errors = fieldErrors({ title: "", authors: "" });
    expect(errors.title).toEqual(["Informe um título."]);
    expect(errors.authors).toEqual(["Informe o autor."]);
    expect(fieldErrors({ title: "a".repeat(201), authors: "B" }).title).toBeDefined();
    expect(fieldErrors({ title: "A", authors: "B", genre: "g".repeat(61) }).genre).toBeDefined();
  });

  it("takes a due date only for a work or PDI book", () => {
    expect(
      bookInputSchema.parse({ title: "A", authors: "B", reason: "PDI", dueDate: "2026-12-01" })
        .dueDate,
    ).toBe("2026-12-01");
    expect(
      fieldErrors({ title: "A", authors: "B", reason: "PERSONAL", dueDate: "2026-12-01" }).dueDate,
    ).toEqual(["Prazo só para livros de trabalho ou de PDI."]);
  });

  it("refuses an end before the start", () => {
    expect(
      fieldErrors({ title: "A", authors: "B", startedOn: "2026-11-10", finishedOn: "2026-11-09" })
        .finishedOn,
    ).toEqual(["O término não pode ser antes do início."]);
  });
});

describe("bookFilterSchema", () => {
  it("accepts a known filter and falls back to the shelf", () => {
    expect(bookFilterSchema.parse("READ")).toBe("READ");
    expect(bookFilterSchema.parse(undefined)).toBe("SHELF");
    expect(bookFilterSchema.parse("LIDOS")).toBe("SHELF");
  });
});

describe("book form: audiobook length (plan 036)", () => {
  it("reads HH:MM as minutes, also past 24 hours", () => {
    const parse = (durationMinutes: string) =>
      bookInputSchema.parse({ title: "A", authors: "B", durationMinutes }).durationMinutes;
    expect(parse("")).toBeNull();
    expect(parse("10:30")).toBe(630);
    expect(parse("31:05")).toBe(1865);
    expect(
      fieldErrors({ title: "A", authors: "B", durationMinutes: "10h" }).durationMinutes,
    ).toEqual(["Use o formato HH:MM."]);
  });
});

describe("bookLogSchema", () => {
  it("reads a page, a percentage up to 100 or the time listened, by the unit", () => {
    expect(bookLogSchema("PAGE").parse({ date: "2026-11-24", position: "72" })).toEqual({
      date: "2026-11-24",
      position: 72,
    });
    expect(
      bookLogSchema("PERCENT").safeParse({ date: "2026-11-24", position: "101" }).success,
    ).toBe(false);
    expect(bookLogSchema("MINUTE").parse({ date: "2026-11-24", position: "3:20" }).position).toBe(
      200,
    );
    expect(bookLogSchema("PAGE").safeParse({ date: "2026-11-24", position: "0" }).success).toBe(
      false,
    );
    expect(bookLogSchema("PAGE").safeParse({ date: "", position: "10" }).success).toBe(false);
  });
});

describe("bookRatingSchema and bookQuoteSchema", () => {
  it("takes a rating from 1 to 5 or none, and a review", () => {
    expect(bookRatingSchema.parse({ rating: "4", review: " Ótimo " })).toEqual({
      rating: 4,
      review: "Ótimo",
    });
    expect(bookRatingSchema.parse({ review: "" })).toEqual({ rating: null, review: null });
    expect(bookRatingSchema.safeParse({ rating: "6" }).success).toBe(false);
  });

  it("requires the quote's text and limits its location", () => {
    expect(bookQuoteSchema.parse({ text: " Trecho ", location: "p. 12" })).toEqual({
      text: "Trecho",
      location: "p. 12",
    });
    expect(bookQuoteSchema.safeParse({ text: "" }).success).toBe(false);
    expect(bookQuoteSchema.safeParse({ text: "a", location: "x".repeat(21) }).success).toBe(false);
  });
});
