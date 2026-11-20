import { z } from "zod";

// enums.ts holds only plain constants (no database client), so this file is
// safe to import from Client Components such as the track forms.
import { TrackStepStatus } from "@/generated/prisma/enums";
import {
  optionalDateOnly,
  optionalHttpUrl,
  optionalText,
  optionalUuid,
  requiredText,
} from "@/lib/form-fields";

export const trackInputSchema = z.object({
  title: requiredText(120),
  description: optionalText(2000),
  goalId: optionalUuid("Escolha um objetivo válido."),
});

export const trackStepInputSchema = z.object({
  title: requiredText(160),
  status: z.enum(TrackStepStatus, { error: "Escolha um status válido." }).default("NOT_STARTED"),
  dueDate: optionalDateOnly(),
  resourceUrl: optionalHttpUrl(2000),
  notes: optionalText(5000),
});

export type TrackFormValues = z.input<typeof trackInputSchema>;
export type TrackInput = z.output<typeof trackInputSchema>;
export type TrackFieldErrors = Partial<Record<keyof TrackFormValues, string[]>>;

export type TrackStepFormValues = z.input<typeof trackStepInputSchema>;
export type TrackStepInput = z.output<typeof trackStepInputSchema>;
export type TrackStepFieldErrors = Partial<Record<keyof TrackStepFormValues, string[]>>;

/** The track list's filter (plan 024): situation of the active tracks, archived, or all. */
export const TRACK_FILTERS = [
  "ACTIVE",
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
  "ARCHIVED",
  "ALL",
] as const;

export type TrackFilter = (typeof TRACK_FILTERS)[number];

/** `?situacao=` from the URL; anything missing or unknown is the default list. */
export const trackFilterSchema = z.enum(TRACK_FILTERS).catch("ACTIVE");
