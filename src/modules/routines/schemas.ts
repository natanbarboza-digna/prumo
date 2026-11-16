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
  .pipe(
    z
      .array(z.enum(Weekday, { error: "Escolha dias da semana válidos." }))
      .min(1, "Escolha pelo menos um dia da semana."),
  )
  .transform((days) => weekdayOrder.filter((day) => days.includes(day)));

const periodFields = z.object({
  startDate: requiredDateOnly("Informe a data de início."),
  endDate: optionalDateOnly(),
});

export const routineInputSchema = z
  .object({
    title: requiredText(120),
    description: optionalText(2000),
    weekdays: weekdaysField,
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
    weekdays: formData.getAll("weekdays").filter((value) => typeof value === "string"),
    timeOfDay: readText(formData, "timeOfDay"),
    startDate: readText(formData, "startDate"),
    endDate: readText(formData, "endDate"),
    goalId: readText(formData, "goalId"),
  };
}
