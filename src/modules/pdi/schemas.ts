import { z } from "zod";

// enums.ts holds only plain constants (no database client), so this file is
// safe to import from Client Components such as the PDI forms.
import { PdiActionStatus } from "@/generated/prisma/enums";
import {
  optionalDateOnly,
  optionalText,
  optionalUuid,
  requiredDateOnly,
  requiredText,
  requiredUuid,
} from "@/lib/form-fields";

const periodFields = z.object({
  startDate: requiredDateOnly("Informe a data de início."),
  endDate: requiredDateOnly("Informe a data de fim."),
});

export const cycleInputSchema = z
  .object({
    title: requiredText(120),
    ...periodFields.shape,
    // CLOSED is not a form choice: closing has its own button and makes the
    // cycle read-only.
    status: z
      .enum(["PLANNED", "ACTIVE"], { error: "Escolha planejado ou ativo." })
      .default("PLANNED"),
    managerName: optionalText(120),
    careerObjective: optionalText(5000),
    selfAssessment: optionalText(10000),
    managerFeedback: optionalText(10000),
    finalRating: optionalText(60),
  })
  .refine((cycle) => cycle.endDate >= cycle.startDate, {
    error: "O fim não pode ser antes do início.",
    path: ["endDate"],
    // Runs as soon as both dates are valid, even if another field is not.
    when: (payload) => periodFields.safeParse(payload.value).success,
  });

export const areaInputSchema = z.object({
  name: requiredText(120, "Informe um nome."),
  description: optionalText(2000),
  expectedOutcome: optionalText(2000),
});

export const actionInputSchema = z.object({
  areaId: requiredUuid("Escolha uma área."),
  categoryId: requiredUuid("Escolha uma categoria."),
  title: requiredText(160),
  description: optionalText(5000),
  expectedResult: optionalText(2000),
  dueDate: optionalDateOnly(),
  status: z.enum(PdiActionStatus, { error: "Escolha um status válido." }).default("NOT_STARTED"),
  evidence: optionalText(5000),
  managerComment: optionalText(5000),
  goalId: optionalUuid("Escolha um objetivo válido."),
});

export const checkInInputSchema = z.object({
  date: requiredDateOnly("Informe a data."),
  summary: requiredText(5000, "Informe um resumo."),
  nextSteps: optionalText(5000),
  managerNotes: optionalText(5000),
});

export type CycleFormValues = z.input<typeof cycleInputSchema>;
export type CycleInput = z.output<typeof cycleInputSchema>;
export type CycleFieldErrors = Partial<Record<keyof CycleFormValues, string[]>>;

export type AreaFormValues = z.input<typeof areaInputSchema>;
export type AreaInput = z.output<typeof areaInputSchema>;
export type AreaFieldErrors = Partial<Record<keyof AreaFormValues, string[]>>;

export type ActionFormValues = z.input<typeof actionInputSchema>;
export type ActionInput = z.output<typeof actionInputSchema>;
export type ActionFieldErrors = Partial<Record<keyof ActionFormValues, string[]>>;

export type CheckInFormValues = z.input<typeof checkInInputSchema>;
export type CheckInInput = z.output<typeof checkInInputSchema>;
export type CheckInFieldErrors = Partial<Record<keyof CheckInFormValues, string[]>>;
