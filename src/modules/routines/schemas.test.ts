import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  readRoutineForm,
  routineInputSchema,
  linkExistingRoutineSchema,
  routineLinkSchema,
  routineLogInputSchema,
} from "@/modules/routines/schemas";

const valid = {
  title: "Ler 20 páginas",
  description: "",
  weekdays: ["MON", "WED"],
  timeOfDay: "",
  startDate: "2026-11-16",
  endDate: "",
  goalId: "",
};

function fieldErrors(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return z.flattenError(result.error).fieldErrors as Record<string, string[] | undefined>;
}

describe("routineInputSchema", () => {
  it("accepts the minimum input and turns blank optional fields into null", () => {
    expect(routineInputSchema.parse(valid)).toEqual({
      title: "Ler 20 páginas",
      description: null,
      weekdays: ["MON", "WED"],
      timeOfDay: null,
      startDate: "2026-11-16",
      endDate: null,
      goalId: null,
      timesPerWeek: null,
    });
  });

  it("turns a single weekday (one FormData value) into a list", () => {
    expect(routineInputSchema.parse({ ...valid, weekdays: "FRI" }).weekdays).toEqual(["FRI"]);
  });

  it("removes repeated weekdays and keeps them in week order", () => {
    expect(
      routineInputSchema.parse({ ...valid, weekdays: ["SUN", "MON", "SUN", "WED"] }).weekdays,
    ).toEqual(["MON", "WED", "SUN"]);
  });

  it.each([[[]], [undefined]])("requires at least one weekday (%j)", (weekdays) => {
    expect(fieldErrors(routineInputSchema, { ...valid, weekdays }).weekdays).toEqual([
      "Escolha pelo menos um dia da semana.",
    ]);
  });

  it("rejects an unknown weekday", () => {
    expect(
      fieldErrors(routineInputSchema, { ...valid, weekdays: ["MON", "XYZ"] }).weekdays,
    ).toEqual(["Escolha dias da semana válidos."]);
  });

  it.each(["07:30", "00:00", "23:59"])("accepts the time %s", (timeOfDay) => {
    expect(routineInputSchema.parse({ ...valid, timeOfDay }).timeOfDay).toBe(timeOfDay);
  });

  it.each(["7:30", "24:00", "12:60", "meio-dia"])("rejects the time %j", (timeOfDay) => {
    expect(fieldErrors(routineInputSchema, { ...valid, timeOfDay }).timeOfDay).toEqual([
      "Informe um horário no formato HH:MM.",
    ]);
  });

  it("requires the start date", () => {
    expect(fieldErrors(routineInputSchema, { ...valid, startDate: "" }).startDate).toEqual([
      "Informe a data de início.",
    ]);
  });

  it("rejects an invalid start date", () => {
    expect(
      fieldErrors(routineInputSchema, { ...valid, startDate: "2026-02-30" }).startDate,
    ).toEqual(["Informe uma data válida."]);
  });

  it("rejects an end date before the start, on the endDate field", () => {
    const errors = fieldErrors(routineInputSchema, { ...valid, endDate: "2026-11-15" });

    expect(errors.endDate).toEqual(["O fim não pode ser antes do início."]);
    expect(errors.startDate).toBeUndefined();
  });

  it("reports the end date even when another field is also invalid", () => {
    const errors = fieldErrors(routineInputSchema, {
      ...valid,
      title: "",
      endDate: "2026-11-15",
    });

    expect(errors.title).toBeDefined();
    expect(errors.endDate).toEqual(["O fim não pode ser antes do início."]);
  });

  it("accepts an end date equal to the start", () => {
    expect(routineInputSchema.parse({ ...valid, endDate: "2026-11-16" }).endDate).toBe(
      "2026-11-16",
    );
  });

  it("requires a title", () => {
    expect(fieldErrors(routineInputSchema, { ...valid, title: "  " }).title).toEqual([
      "Informe um título.",
    ]);
  });

  it("rejects a malformed goal id", () => {
    expect(fieldErrors(routineInputSchema, { ...valid, goalId: "abc" }).goalId).toEqual([
      "Escolha um objetivo válido.",
    ]);
  });
});

describe("routineLogInputSchema", () => {
  it("accepts a status and turns a blank note into null", () => {
    expect(routineLogInputSchema.parse({ status: "SKIPPED", note: "  " })).toEqual({
      status: "SKIPPED",
      note: null,
    });
  });

  it("rejects an unknown status", () => {
    expect(fieldErrors(routineLogInputSchema, { status: "MAYBE" }).status).toEqual([
      "Escolha feito ou pulado.",
    ]);
  });

  it("accepts a note with up to 500 characters", () => {
    expect(
      routineLogInputSchema.parse({ status: "DONE", note: "a".repeat(500) }).note,
    ).toHaveLength(500);
    expect(
      fieldErrors(routineLogInputSchema, { status: "DONE", note: "a".repeat(501) }).note,
    ).toEqual(["Use no máximo 500 caracteres."]);
  });
});

describe("readRoutineForm", () => {
  it("collects repeated weekday checkboxes into a list", () => {
    const formData = new FormData();
    formData.set("title", "Correr");
    formData.append("weekdays", "TUE");
    formData.append("weekdays", "THU");
    formData.set("startDate", "2026-11-16");

    expect(readRoutineForm(formData)).toEqual({
      title: "Correr",
      description: "",
      frequency: "DAYS",
      weekdays: ["TUE", "THU"],
      timesPerWeek: "",
      timeOfDay: "",
      startDate: "2026-11-16",
      endDate: "",
      goalId: "",
    });
  });
});

describe("routineLinkSchema", () => {
  const actionId = "0190a3e4-0000-7000-8000-000000000000";

  it("accepts a PDI action id", () => {
    expect(routineLinkSchema.parse({ pdiActionId: actionId })).toEqual({ pdiActionId: actionId });
  });

  it("turns a missing or empty id into null", () => {
    expect(routineLinkSchema.parse({})).toEqual({ pdiActionId: null });
    expect(routineLinkSchema.parse({ pdiActionId: "" })).toEqual({ pdiActionId: null });
  });

  it("rejects an id that is not a UUID", () => {
    expect(routineLinkSchema.safeParse({ pdiActionId: "abc" }).success).toBe(false);
  });
});

describe("routineInputSchema with a weekly goal (plan 017)", () => {
  const weekly = { ...valid, weekdays: [], frequency: "WEEKLY", timesPerWeek: "3" };

  it("stores the goal and all seven days, whatever days were sent", () => {
    expect(routineInputSchema.parse({ ...weekly, weekdays: ["MON"] })).toMatchObject({
      timesPerWeek: 3,
      weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    });
  });

  it("ignores a leftover goal on a fixed-days routine", () => {
    expect(
      routineInputSchema.parse({ ...valid, frequency: "DAYS", timesPerWeek: "3" }),
    ).toMatchObject({
      timesPerWeek: null,
      weekdays: ["MON", "WED"],
    });
  });

  it("needs how many times per week, from 1 to 6", () => {
    expect(fieldErrors(routineInputSchema, { ...weekly, timesPerWeek: "" }).timesPerWeek).toEqual([
      "Escolha quantas vezes por semana.",
    ]);
    for (const value of ["0", "7", "2.5", "três"]) {
      expect(
        fieldErrors(routineInputSchema, { ...weekly, timesPerWeek: value }).timesPerWeek,
        value,
      ).toEqual(["Escolha de 1 a 6 vezes por semana."]);
    }
  });

  it("refuses an unknown kind of routine", () => {
    expect(fieldErrors(routineInputSchema, { ...weekly, frequency: "MONTHLY" }).frequency).toEqual([
      "Escolha como a rotina se repete.",
    ]);
  });

  it("reads the kind and the goal from the form", () => {
    const formData = new FormData();
    formData.set("frequency", "WEEKLY");
    formData.set("timesPerWeek", "4");

    expect(readRoutineForm(formData)).toMatchObject({ frequency: "WEEKLY", timesPerWeek: "4" });
  });
});

describe("linkExistingRoutineSchema", () => {
  const routineId = "0190a3e4-0000-7000-8000-000000000000";

  it("accepts a routine id", () => {
    expect(linkExistingRoutineSchema.parse({ routineId })).toEqual({ routineId });
  });

  it("asks for a routine when none is chosen or the id is invalid", () => {
    for (const value of ["", "abc"]) {
      const result = linkExistingRoutineSchema.safeParse({ routineId: value });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Escolha uma rotina.");
    }
  });
});
