import { z } from "zod";

// enums.ts holds only plain constants (no database client), so this file is
// safe to import from Client Components such as the goal form.
import { GoalStatus } from "@/generated/prisma/enums";
import { optionalDateOnly, optionalText, requiredText } from "@/lib/form-fields";

/**
 * Single source of truth for goal input: the form validates with it in the
 * browser and the Server Action validates again on the server.
 */
export const goalInputSchema = z.object({
  title: requiredText(120),
  description: optionalText(2000),
  status: z.enum(GoalStatus, { error: "Escolha um status válido." }).default("NOT_STARTED"),
  targetDate: optionalDateOnly(),
});

/** The `?status=` filter of the goal list: unknown values fall back to "no filter". */
export const goalStatusFilterSchema = z.enum(GoalStatus).optional().catch(undefined);

/** What the form sends (strings, possibly missing). */
export type GoalFormValues = z.input<typeof goalInputSchema>;

/** What the service receives after validation. */
export type GoalInput = z.output<typeof goalInputSchema>;

export type GoalFieldErrors = Partial<Record<keyof GoalFormValues, string[]>>;
