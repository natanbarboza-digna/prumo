import { describe, expect, it } from "vitest";
import { z } from "zod";

import { bookFilterSchema, bookInputSchema } from "@/modules/books/schemas";

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
