import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  actionInputSchema,
  areaInputSchema,
  checkInInputSchema,
  cycleInputSchema,
} from "@/modules/pdi/schemas";

const UUID = "0190a3e4-0000-7000-8000-000000000001";

function fieldErrors(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return z.flattenError(result.error).fieldErrors as Record<string, string[] | undefined>;
}

const cycle = { title: "PDI 2026", startDate: "2026-01-01", endDate: "2026-12-31" };

describe("cycleInputSchema", () => {
  it("accepts the minimum input, defaulting to PLANNED and nulls", () => {
    expect(cycleInputSchema.parse({ ...cycle, managerName: " ", finalRating: "" })).toEqual({
      ...cycle,
      status: "PLANNED",
      managerName: null,
      careerObjective: null,
      selfAssessment: null,
      managerFeedback: null,
      finalRating: null,
    });
  });

  it("requires the title and both dates", () => {
    const errors = fieldErrors(cycleInputSchema, { title: "", startDate: "", endDate: "" });

    expect(errors.title).toEqual(["Informe um título."]);
    expect(errors.startDate).toEqual(["Informe a data de início."]);
    expect(errors.endDate).toEqual(["Informe a data de fim."]);
  });

  it("rejects an end before the start, on the endDate field", () => {
    expect(fieldErrors(cycleInputSchema, { ...cycle, endDate: "2025-12-31" }).endDate).toEqual([
      "O fim não pode ser antes do início.",
    ]);
  });

  it("only accepts PLANNED or ACTIVE from the form (closing has its own button)", () => {
    expect(cycleInputSchema.parse({ ...cycle, status: "ACTIVE" }).status).toBe("ACTIVE");
    expect(fieldErrors(cycleInputSchema, { ...cycle, status: "CLOSED" }).status).toEqual([
      "Escolha planejado ou ativo.",
    ]);
  });

  it("limits the final rating to 60 characters", () => {
    expect(
      fieldErrors(cycleInputSchema, { ...cycle, finalRating: "a".repeat(61) }).finalRating,
    ).toEqual(["Use no máximo 60 caracteres."]);
  });
});

describe("areaInputSchema", () => {
  it("requires a name and turns blank fields into null", () => {
    expect(areaInputSchema.parse({ name: "Comunicação", description: "" })).toEqual({
      name: "Comunicação",
      description: null,
      expectedOutcome: null,
    });
    expect(fieldErrors(areaInputSchema, { name: "" }).name).toEqual(["Informe um nome."]);
  });
});

describe("actionInputSchema", () => {
  const action = { areaId: UUID, categoryId: UUID, title: "Curso de oratória" };

  it("accepts the minimum input and fills defaults", () => {
    expect(actionInputSchema.parse(action)).toEqual({
      ...action,
      description: null,
      expectedResult: null,
      dueDate: null,
      status: "NOT_STARTED",
      evidence: null,
      managerComment: null,
      goalId: null,
    });
  });

  it("requires an area, a category and a title", () => {
    const errors = fieldErrors(actionInputSchema, { areaId: "", categoryId: "", title: "" });

    expect(errors.areaId).toEqual(["Escolha uma área."]);
    expect(errors.categoryId).toEqual(["Escolha uma categoria."]);
    expect(errors.title).toEqual(["Informe um título."]);
  });

  it("accepts every status, including CANCELLED", () => {
    expect(actionInputSchema.parse({ ...action, status: "CANCELLED" }).status).toBe("CANCELLED");
    expect(fieldErrors(actionInputSchema, { ...action, status: "LATE" }).status).toEqual([
      "Escolha um status válido.",
    ]);
  });

  it("validates the due date", () => {
    expect(fieldErrors(actionInputSchema, { ...action, dueDate: "2026-02-30" }).dueDate).toEqual([
      "Informe uma data válida.",
    ]);
  });
});

describe("checkInInputSchema", () => {
  it("requires the date and the summary", () => {
    const errors = fieldErrors(checkInInputSchema, { date: "", summary: " " });

    expect(errors.date).toEqual(["Informe a data."]);
    expect(errors.summary).toEqual(["Informe um resumo."]);
  });

  it("turns blank optional fields into null", () => {
    expect(checkInInputSchema.parse({ date: "2026-03-01", summary: "Alinhamento" })).toEqual({
      date: "2026-03-01",
      summary: "Alinhamento",
      nextSteps: null,
      managerNotes: null,
    });
  });
});
