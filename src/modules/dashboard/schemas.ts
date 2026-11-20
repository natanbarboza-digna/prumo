import { z } from "zod";

/** `?periodo=` of the deadlines page (plan 028): next 7, 30 or 90 days, or all. */
export const DEADLINE_PERIODS = ["7", "30", "90", "all"] as const;

export type DeadlinePeriod = (typeof DEADLINE_PERIODS)[number];

export const deadlinePeriodSchema = z.enum(DEADLINE_PERIODS).catch("30");

/** Days the period covers from today; null for all of them. */
export function periodDays(period: DeadlinePeriod): number | null {
  return period === "all" ? null : Number(period);
}

/** `?tipo=` of the deadlines page: one kind of item, or all of them. */
export const DEADLINE_KIND_FILTERS = ["ALL", "STEP", "ACTION", "GOAL"] as const;

export type DeadlineKindFilter = (typeof DEADLINE_KIND_FILTERS)[number];

export const deadlineKindFilterSchema = z.enum(DEADLINE_KIND_FILTERS).catch("ALL");
