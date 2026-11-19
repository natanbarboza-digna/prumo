import { z } from "zod";

// enums.ts holds only plain constants (no database client), so this file is
// safe to import from Client Components such as the routine form.
import { RoutineLogStatus, Weekday } from "@/generated/prisma/enums";
import {
  optionalText,
  optionalUuid,
  optionalDateOnly,
  requiredDateOnly,
  requiredText,
} from "@/lib/form-fields";

/** Monday first, the order the app shows and stores weekdays in. */
export const weekdayOrder: readonly Weekday[] = Object.values(Weekday);

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const weekdaysField = z
  // A single checked checkbox arrives as a string, several as a list.
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]))
  // "At least one day" is checked below, only for fixed-days routines.
  .pipe(z.array(z.enum(Weekday, { error: "Escolha dias da semana válidos." })))
  .transform((days) => weekdayOrder.filter((day) => days.includes(day)));

/** How a routine repeats (plan 017): on fixed weekdays, or N times per week on any days. */
export const ROUTINE_FREQUENCIES = ["DAYS", "WEEKLY"] as const;

// Text in (a form value), one of the two kinds out; empty means fixed days.
const frequencyField = z
  .string()
  .optional()
  .transform((value) => value || "DAYS")
  .pipe(z.enum(ROUTINE_FREQUENCIES, { error: "Escolha como a rotina se repete." }));

const timesPerWeekField = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => (value === undefined || value === "" ? null : Number(value)))
  .refine((value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 6), {
    error: "Escolha de 1 a 6 vezes por semana.",
  });

// The checks below only need these fields, so their errors show up together
// with the others instead of after they are fixed (see the date check).
const FREQUENCY_KEYS = new Set(["frequency", "weekdays", "timesPerWeek"]);
const frequencyFieldsValid = (payload: { issues: readonly { path?: PropertyKey[] }[] }) =>
  !payload.issues.some((issue) => FREQUENCY_KEYS.has(String(issue.path?.[0])));

const periodFields = z.object({
  startDate: requiredDateOnly("Informe a data de início."),
  endDate: optionalDateOnly(),
});

export const routineInputSchema = z
  .object({
    title: requiredText(120),
    description: optionalText(2000),
    frequency: frequencyField,
    weekdays: weekdaysField,
    timesPerWeek: timesPerWeekField,
    timeOfDay: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null))
      // The pattern also caps the length, so "meio-dia" gets the format message.
      .refine((value) => value === null || TIME_OF_DAY_PATTERN.test(value), {
        error: "Informe um horário no formato HH:MM.",
      }),
    ...periodFields.shape,
    goalId: optionalUuid("Escolha um objetivo válido."),
  })
  .refine((routine) => routine.endDate === null || routine.endDate >= routine.startDate, {
    error: "O fim não pode ser antes do início.",
    path: ["endDate"],
    // By default an object-level check only runs when every field is valid.
    // This one only needs the two dates, so the error shows up together with
    // the others instead of after they are fixed.
    when: (payload) => periodFields.safeParse(payload.value).success,
  })
  .refine((routine) => routine.frequency !== "DAYS" || routine.weekdays.length > 0, {
    error: "Escolha pelo menos um dia da semana.",
    path: ["weekdays"],
    when: frequencyFieldsValid,
  })
  .refine((routine) => routine.frequency !== "WEEKLY" || routine.timesPerWeek !== null, {
    error: "Escolha quantas vezes por semana.",
    path: ["timesPerWeek"],
    when: frequencyFieldsValid,
  })
  // A weekly goal stores all seven days, so "is the routine on this day?"
  // accepts any day; a fixed-days routine has no goal.
  .transform(({ frequency, ...routine }) =>
    frequency === "WEEKLY"
      ? { ...routine, weekdays: [...weekdayOrder] }
      : { ...routine, timesPerWeek: null },
  );

/**
 * The PDI action a new routine comes from. Kept apart from the routine fields
 * because only creation reads it: editing never changes the link.
 */
export const routineLinkSchema = z.object({
  pdiActionId: optionalUuid("Ação de PDI inválida."),
});

export const routineLogInputSchema = z.object({
  status: z.enum(RoutineLogStatus, { error: "Escolha feito ou pulado." }),
  note: optionalText(500),
});

export type RoutineFormValues = z.input<typeof routineInputSchema>;
export type RoutineInput = z.output<typeof routineInputSchema>;
export type RoutineFieldErrors = Partial<Record<keyof RoutineFormValues, string[]>>;

export type RoutineLogInput = z.output<typeof routineLogInputSchema>;

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Reads the routine form. Used in the browser and in the Server Action alike:
 * Object.fromEntries would keep only one of the checked weekday boxes.
 */
export function readRoutineForm(formData: FormData): RoutineFormValues {
  return {
    title: readText(formData, "title"),
    description: readText(formData, "description"),
    frequency: readText(formData, "frequency") || "DAYS",
    weekdays: formData.getAll("weekdays").filter((value) => typeof value === "string"),
    timesPerWeek: readText(formData, "timesPerWeek"),
    timeOfDay: readText(formData, "timeOfDay"),
    startDate: readText(formData, "startDate"),
    endDate: readText(formData, "endDate"),
    goalId: readText(formData, "goalId"),
  };
}
