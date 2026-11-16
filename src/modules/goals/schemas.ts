import { z } from "zod";

// enums.ts holds only plain constants (no database client), so this file is
// safe to import from Client Components such as the goal form.
import { GoalStatus } from "@/generated/prisma/enums";
import { isValidDateOnly } from "@/lib/dates";

/** Turns blank strings (and missing values) into null after trimming. */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

/**
 * Single source of truth for goal input: the form validates with it in the
 * browser and the Server Action validates again on the server.
 */
export const goalInputSchema = z.object({
  title: z.string().trim().min(1, "Informe um título.").max(120, "Use no máximo 120 caracteres."),
  description: z
    .string()
    .trim()
    .max(2000, "Use no máximo 2000 caracteres.")
    .optional()
    .transform((value) => (value ? value : null)),
  status: z.enum(GoalStatus, { error: "Escolha um status válido." }).default("NOT_STARTED"),
  targetDate: optionalText.refine((value) => value === null || isValidDateOnly(value), {
    error: "Informe uma data válida.",
  }),
});

/** The `?status=` filter of the goal list: unknown values fall back to "no filter". */
export const goalStatusFilterSchema = z.enum(GoalStatus).optional().catch(undefined);

/** What the form sends (strings, possibly missing). */
export type GoalFormValues = z.input<typeof goalInputSchema>;

/** What the service receives after validation. */
export type GoalInput = z.output<typeof goalInputSchema>;

export type GoalFieldErrors = Partial<Record<keyof GoalFormValues, string[]>>;
