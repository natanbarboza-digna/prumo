import { describe, expect, it } from "vitest";
import { z } from "zod";

import { goalInputSchema } from "@/modules/goals/schemas";

function fieldErrors(input: unknown) {
  const result = goalInputSchema.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return z.flattenError(result.error).fieldErrors;
}

describe("goalInputSchema", () => {
  it("accepts the minimum input and fills defaults", () => {
    expect(goalInputSchema.parse({ title: "Aprender TypeScript" })).toEqual({
      title: "Aprender TypeScript",
      description: null,
      status: "NOT_STARTED",
      targetDate: null,
    });
  });

  it("trims the title and turns empty optional fields into null", () => {
    expect(
      goalInputSchema.parse({
        title: "  Correr 10 km  ",
        description: "   ",
        status: "IN_PROGRESS",
        targetDate: "",
      }),
    ).toEqual({
      title: "Correr 10 km",
      description: null,
      status: "IN_PROGRESS",
      targetDate: null,
    });
  });

  it("keeps a valid target date as YYYY-MM-DD", () => {
    expect(goalInputSchema.parse({ title: "X", targetDate: "2026-12-31" }).targetDate).toBe(
      "2026-12-31",
    );
  });

  it.each(["", "   "])("rejects a blank title (%j) with a pt-BR message", (title) => {
    expect(fieldErrors({ title }).title).toEqual(["Informe um título."]);
  });

  it("rejects a title longer than 120 characters", () => {
    expect(fieldErrors({ title: "a".repeat(121) }).title).toEqual([
      "Use no máximo 120 caracteres.",
    ]);
  });

  it("rejects a description longer than 2000 characters", () => {
    expect(fieldErrors({ title: "X", description: "a".repeat(2001) }).description).toEqual([
      "Use no máximo 2000 caracteres.",
    ]);
  });

  it("rejects an unknown status", () => {
    expect(fieldErrors({ title: "X", status: "PAUSED" }).status).toEqual([
      "Escolha um status válido.",
    ]);
  });

  it.each(["2026-02-30", "31/12/2026", "amanhã"])("rejects the target date %j", (targetDate) => {
    expect(fieldErrors({ title: "X", targetDate }).targetDate).toEqual([
      "Informe uma data válida.",
    ]);
  });
});
