import { describe, expect, it } from "vitest";
import { z } from "zod";

import { endDaySchema, entrySchema, startDaySchema } from "@/modules/time/schemas";

function errorsOf(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return z.flattenError(result.error).fieldErrors as Record<string, string[] | undefined>;
}

const CATEGORY = "0190a3e4-0000-7000-8000-000000000000";

describe("time schemas (plan 031)", () => {
  it("starts a day with a time, a block size of 15, 30 or 60 and an optional end", () => {
    expect(startDaySchema.parse({ startTime: "08:15", slotMinutes: "30", endTime: "" })).toEqual({
      startTime: "08:15",
      slotMinutes: 30,
      endTime: null,
    });
    expect(errorsOf(startDaySchema, { startTime: "8h", slotMinutes: "45" })).toMatchObject({
      startTime: [expect.stringContaining("HH:MM")],
      slotMinutes: [expect.stringContaining("15, 30 ou 60")],
    });
    expect(
      errorsOf(startDaySchema, { startTime: "18:00", slotMinutes: "30", endTime: "08:00" }),
    ).toMatchObject({ endTime: ["A saída precisa ser depois da entrada."] });
  });

  it("needs the end time to end the day", () => {
    expect(errorsOf(endDaySchema, { endTime: "" })).toMatchObject({
      endTime: ["Informe a hora de saída."],
    });
  });

  it("needs a text and a category for work, and nothing for a break", () => {
    expect(
      entrySchema.parse({
        kind: "WORK",
        description: " Relatórios ",
        categoryId: CATEGORY,
        projectName: "",
      }),
    ).toEqual({ kind: "WORK", description: "Relatórios", categoryId: CATEGORY, projectName: null });
    expect(errorsOf(entrySchema, { kind: "WORK", description: "", categoryId: "" })).toMatchObject({
      description: ["Descreva o que foi feito."],
      categoryId: ["Escolha uma categoria."],
    });
    expect(
      entrySchema.parse({
        kind: "BREAK",
        description: "",
        categoryId: CATEGORY,
        projectName: "Digna",
      }),
    ).toEqual({ kind: "BREAK", description: null, categoryId: null, projectName: null });
  });
});
