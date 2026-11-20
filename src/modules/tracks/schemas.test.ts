import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  trackFilterSchema,
  trackInputSchema,
  trackStepInputSchema,
} from "@/modules/tracks/schemas";

function errorsOf(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return z.flattenError(result.error).fieldErrors as Record<string, string[] | undefined>;
}

const GOAL_ID = "0190a3e4-0000-7000-8000-000000000000";

describe("trackInputSchema", () => {
  it("accepts the minimum input", () => {
    expect(trackInputSchema.parse({ title: "Frontend moderno" })).toEqual({
      title: "Frontend moderno",
      description: null,
      goalId: null,
    });
  });

  it("trims values and keeps a valid goal id", () => {
    expect(
      trackInputSchema.parse({ title: "  React  ", description: "  hooks  ", goalId: GOAL_ID }),
    ).toEqual({ title: "React", description: "hooks", goalId: GOAL_ID });
  });

  it("turns an empty goal id into null", () => {
    expect(trackInputSchema.parse({ title: "X", goalId: "" }).goalId).toBeNull();
  });

  it("rejects a goal id that is not a UUID", () => {
    expect(errorsOf(trackInputSchema, { title: "X", goalId: "abc" }).goalId).toEqual([
      "Escolha um objetivo válido.",
    ]);
  });

  it("rejects a blank or too long title", () => {
    expect(errorsOf(trackInputSchema, { title: " " }).title).toEqual(["Informe um título."]);
    expect(errorsOf(trackInputSchema, { title: "a".repeat(121) }).title).toEqual([
      "Use no máximo 120 caracteres.",
    ]);
  });

  it("rejects a description longer than 2000 characters", () => {
    expect(
      errorsOf(trackInputSchema, { title: "X", description: "a".repeat(2001) }).description,
    ).toEqual(["Use no máximo 2000 caracteres."]);
  });
});

describe("trackStepInputSchema", () => {
  it("accepts the minimum input and fills defaults", () => {
    expect(trackStepInputSchema.parse({ title: "Ler a documentação" })).toEqual({
      title: "Ler a documentação",
      status: "NOT_STARTED",
      dueDate: null,
      resourceUrl: null,
      notes: null,
    });
  });

  it("keeps valid optional fields", () => {
    expect(
      trackStepInputSchema.parse({
        title: "Curso",
        status: "IN_PROGRESS",
        dueDate: "2026-12-01",
        resourceUrl: " https://nextjs.org/docs ",
        notes: "Capítulos 1 a 3",
      }),
    ).toEqual({
      title: "Curso",
      status: "IN_PROGRESS",
      dueDate: "2026-12-01",
      resourceUrl: "https://nextjs.org/docs",
      notes: "Capítulos 1 a 3",
    });
  });

  it.each(["https://example.com/a?b=c", "http://localhost:3000"])("accepts the URL %j", (url) => {
    expect(trackStepInputSchema.parse({ title: "X", resourceUrl: url }).resourceUrl).toBe(url);
  });

  it.each(["javascript:alert(1)", "ftp://example.com/file", "example.com", "texto solto"])(
    "rejects the URL %j",
    (url) => {
      expect(errorsOf(trackStepInputSchema, { title: "X", resourceUrl: url }).resourceUrl).toEqual([
        "Informe um link começando com http:// ou https://.",
      ]);
    },
  );

  it("rejects a URL longer than 2000 characters", () => {
    const url = `https://example.com/${"a".repeat(2000)}`;
    expect(errorsOf(trackStepInputSchema, { title: "X", resourceUrl: url }).resourceUrl).toEqual([
      "Use no máximo 2000 caracteres.",
    ]);
  });

  it("rejects a title longer than 160 characters", () => {
    expect(errorsOf(trackStepInputSchema, { title: "a".repeat(161) }).title).toEqual([
      "Use no máximo 160 caracteres.",
    ]);
  });

  it("rejects an invalid due date, status or long notes", () => {
    const errors = errorsOf(trackStepInputSchema, {
      title: "X",
      dueDate: "2026-02-30",
      status: "SKIPPED",
      notes: "a".repeat(5001),
    });
    expect(errors.dueDate).toEqual(["Informe uma data válida."]);
    expect(errors.status).toEqual(["Escolha um status válido."]);
    expect(errors.notes).toEqual(["Use no máximo 5000 caracteres."]);
  });
});

describe("trackFilterSchema (plan 024)", () => {
  it("reads the filter from the URL, falling back to the active tracks", () => {
    expect(trackFilterSchema.parse("ARCHIVED")).toBe("ARCHIVED");
    expect(trackFilterSchema.parse("IN_PROGRESS")).toBe("IN_PROGRESS");
    expect(trackFilterSchema.parse(undefined)).toBe("ACTIVE");
    expect(trackFilterSchema.parse("qualquer")).toBe("ACTIVE");
    expect(trackFilterSchema.parse(["DONE", "ALL"])).toBe("ACTIVE");
  });
});
