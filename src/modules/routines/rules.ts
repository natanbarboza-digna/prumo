// Pure routine rules: no database access, so both the routines and the PDI
// services can import them without importing each other.

import type { RoutineLogStatus, Weekday } from "@/generated/prisma/enums";
import { eachDay, weekdayOf } from "@/lib/dates";

export type Schedule = { weekdays: Weekday[]; startDate: string; endDate: string | null };

export type Adherence = {
  scheduled: number;
  done: number;
  skipped: number;
  missed: number;
  /** Done days as a whole percentage of the scheduled days (0 when none). */
  rate: number;
};

export type RoutineState = "UPCOMING" | "ACTIVE" | "ENDED";

export type Period = { from: string; to: string };

/** How far back adherence and history look, counting today. */
export const ADHERENCE_DAYS = 30;
export const HISTORY_DAYS = 14;

export function isScheduledOn(routine: Schedule, date: string): boolean {
  // "YYYY-MM-DD" strings compare correctly as plain text.
  return (
    routine.startDate <= date &&
    (routine.endDate === null || date <= routine.endDate) &&
    routine.weekdays.includes(weekdayOf(date))
  );
}

export function routineStateOn(
  routine: Pick<Schedule, "startDate" | "endDate">,
  today: string,
): RoutineState {
  if (routine.startDate > today) return "UPCOMING";
  if (routine.endDate !== null && routine.endDate < today) return "ENDED";
  return "ACTIVE";
}

/**
 * Adherence over the scheduled days of a period. Days after today never count,
 * and today only counts once logged, since it is not over yet. Skipped days
 * count as not done. Logs on days that are no longer scheduled are ignored.
 */
export function computeAdherence(
  routine: Schedule,
  logs: readonly { date: string; status: RoutineLogStatus }[],
  period: Period,
  today: string,
): Adherence {
  const statusByDate = new Map(logs.map((log) => [log.date, log.status]));
  const last = period.to < today ? period.to : today;
  let scheduled = 0;
  let done = 0;
  let skipped = 0;

  for (const date of eachDay(period.from, last)) {
    if (!isScheduledOn(routine, date)) continue;
    const status = statusByDate.get(date);
    if (date === today && status === undefined) continue;
    scheduled++;
    if (status === "DONE") done++;
    if (status === "SKIPPED") skipped++;
  }

  return withRate({ scheduled, done, skipped, missed: scheduled - done - skipped });
}

/**
 * The days a routine counts as evidence for a PDI action: the overlap of the
 * routine and the cycle, up to today. Null when they do not overlap yet.
 */
export function evidencePeriod(
  routine: Pick<Schedule, "startDate" | "endDate">,
  cycle: { startDate: string; endDate: string },
  today: string,
): Period | null {
  const from = latest(routine.startDate, cycle.startDate);
  const ends = [cycle.endDate, today];
  if (routine.endDate !== null) ends.push(routine.endDate);
  const to = ends.reduce((earliest, date) => (date < earliest ? date : earliest));
  return from <= to ? { from, to } : null;
}

/** Sums several routines; the rate is weighted by each one's scheduled days. */
export function combineAdherence(items: readonly Adherence[]): Adherence {
  const sum = (key: "scheduled" | "done" | "skipped" | "missed") =>
    items.reduce((total, item) => total + item[key], 0);
  return withRate({
    scheduled: sum("scheduled"),
    done: sum("done"),
    skipped: sum("skipped"),
    missed: sum("missed"),
  });
}

function withRate(counts: Omit<Adherence, "rate">): Adherence {
  const rate = counts.scheduled === 0 ? 0 : Math.round((counts.done / counts.scheduled) * 100);
  return { ...counts, rate };
}

function latest(a: string, b: string): string {
  return a > b ? a : b;
}
