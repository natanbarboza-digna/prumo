import { z } from "zod";

import { requiredText } from "@/lib/form-fields";

export const categoryInputSchema = z.object({
  name: requiredText(60, "Informe um nome."),
  // An unchecked box sends nothing; a checked one sends "on" (or the edit
  // form's default value, true).
  allowsRoutine: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .optional()
    .transform((value) => value === "on" || value === "true" || value === true),
});

export type CategoryFormValues = z.input<typeof categoryInputSchema>;
export type CategoryInput = z.output<typeof categoryInputSchema>;
export type CategoryFieldErrors = Partial<Record<keyof CategoryFormValues, string[]>>;
