import { z } from "zod";

import { optionalText, requiredText } from "@/lib/form-fields";
import { isValidTimeOfDay } from "@/lib/time-of-day";

// enums.ts holds only plain constants, so this file is safe in Client Components.
import { TimeEntryKind } from "@/generated/prisma/enums";

const time = (emptyMessage: string) =>
  z
    .string({ error: emptyMessage })
    .trim()
    .min(1, { error: emptyMessage })
    // Empty is already reported above: do not add a second message for it.
    .refine((value) => value === "" || isValidTimeOfDay(value), {
      error: "Use o formato HH:MM, por exemplo 08:15.",
    });

const optionalTime = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || isValidTimeOfDay(value), {
    error: "Use o formato HH:MM, por exemplo 18:30.",
  });

/** "Começar o dia" (plan 031): the start, the block size and, for a past day, the end. */
export const startDaySchema = z
  .object({
    startTime: time("Informe a hora de entrada."),
    slotMinutes: z
      .enum(["15", "30", "60"], { error: "Escolha 15, 30 ou 60 minutos." })
      .transform(Number),
    endTime: optionalTime,
  })
  .refine((day) => day.endTime === null || day.endTime > day.startTime, {
    error: "A saída precisa ser depois da entrada.",
    path: ["endTime"],
  });

/** Correcting the start and end of a day ("HH:MM" strings compare in time order). */
export const dayTimesSchema = z
  .object({ startTime: time("Informe a hora de entrada."), endTime: optionalTime })
  .refine((day) => day.endTime === null || day.endTime > day.startTime, {
    error: "A saída precisa ser depois da entrada.",
    path: ["endTime"],
  });

/** "Encerrar o dia". */
export const endDaySchema = z.object({ endTime: time("Informe a hora de saída.") });

/**
 * One block (or half block): work needs a text and a category; a break only
 * an optional note. The project is typed by name and created when new.
 */
export const entrySchema = z
  .object({
    kind: z.enum(TimeEntryKind),
    description: optionalText(300),
    categoryId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
    projectName: optionalText(80),
  })
  .superRefine((entry, context) => {
    if (entry.kind !== "WORK") return;
    if (entry.description === null) {
      context.addIssue({
        code: "custom",
        path: ["description"],
        message: "Descreva o que foi feito.",
      });
    }
    if (entry.categoryId === null) {
      context.addIssue({ code: "custom", path: ["categoryId"], message: "Escolha uma categoria." });
    }
  })
  // A break has no category or project, whatever the form sent.
  .transform((entry) =>
    entry.kind === "BREAK" ? { ...entry, categoryId: null, projectName: null } : entry,
  );

export const timeCategorySchema = z.object({ name: requiredText(60, "Informe um nome.") });
export const timeProjectSchema = z.object({ name: requiredText(80, "Informe um nome.") });

export type StartDayValues = z.input<typeof startDaySchema>;
export type StartDayInput = z.output<typeof startDaySchema>;
export type DayTimesValues = z.input<typeof dayTimesSchema>;
export type DayTimesInput = z.output<typeof dayTimesSchema>;
export type EndDayValues = z.input<typeof endDaySchema>;
export type EntryValues = z.input<typeof entrySchema>;
export type EntryInput = z.output<typeof entrySchema>;
export type TimeCategoryValues = z.input<typeof timeCategorySchema>;
export type TimeProjectValues = z.input<typeof timeProjectSchema>;
