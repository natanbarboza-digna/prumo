// Pure routine rules: no database access, so both the routines and the PDI
// services can import them without importing each other.

import type { RoutineLogStatus, Weekday } from "@/generated/prisma/enums";
import { addDays, eachDay, mondayOf, weekdayOf } from "@/lib/dates";

export type Schedule = {
  weekdays: Weekday[];
  startDate: string;
  endDate: string | null;
  /**
   * Weekly goal (plan 017): N days per week, any days. Null or absent for a
   * fixed-days routine. A weekly-goal routine has all 7 days in `weekdays`, so
   * isScheduledOn accepts any day of its period.
   */
  timesPerWeek?: number | null;
};

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
/** Monday first, the order the app shows weeks in. */
const WEEK_ORDER: readonly Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

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
  if (routine.timesPerWeek) return weeklyGoalAdherence(routine, logs, period, today);
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

// ---------------------------------------------------------------------------
// Monthly calendar (plan 016)
// ---------------------------------------------------------------------------

/** OUTSIDE: a day of the previous or next month, shown to complete the weeks. */
/** OPEN: a day of a weekly-goal routine with no log; no day of the week was required. */
export type CalendarDayState =
  "OPEN" | "DONE" | "SKIPPED" | "MISSED" | "PENDING" | "NOT_SCHEDULED" | "FUTURE" | "OUTSIDE";

export type CalendarDay = { date: string; state: CalendarDayState; isToday: boolean };

export type MonthCalendar = {
  /** "YYYY-MM". */
  month: string;
  /** Monday-to-Sunday weeks covering the whole month. */
  weeks: CalendarDay[][];
  /** The month's scheduled days up to today. */
  adherence: Adherence;
  /**
   * Weekly-goal routines only (plan 017): the progress of each week row, null
   * for a week outside the routine's period. Null for fixed-days routines.
   */
  weekGoals: (WeekGoal | null)[] | null;
};

export type WeekProgress = { done: number; target: number };
/** `current`: the week is not over yet, so a shortfall is not a miss. */
export type WeekGoal = WeekProgress & { current: boolean };

export type MonthRange = { from: string; to: string };

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const monthOf = (date: string) => date.slice(0, 7);

/** "2026-12" + 1 → "2027-01". */
export function addMonths(month: string, count: number): string {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const index = year * 12 + (monthNumber - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function lastDayOf(month: string): string {
  return addDays(`${addMonths(month, 1)}-01`, -1);
}

export function monthCalendar(
  routine: Schedule,
  logs: readonly { date: string; status: RoutineLogStatus }[],
  month: string,
  today: string,
): MonthCalendar {
  const first = `${month}-01`;
  const last = lastDayOf(month);
  const statusByDate = new Map(logs.map((log) => [log.date, log.status]));

  // Back to the Monday on or before the 1st, forward to the Sunday on or after the last day.
  const start = addDays(first, -WEEK_ORDER.indexOf(weekdayOf(first)));
  const end = addDays(last, 6 - WEEK_ORDER.indexOf(weekdayOf(last)));

  const days = eachDay(start, end).map((date): CalendarDay => {
    const isToday = date === today;
    if (monthOf(date) !== month) return { date, state: "OUTSIDE", isToday };
    if (!isScheduledOn(routine, date)) return { date, state: "NOT_SCHEDULED", isToday };
    if (date > today) return { date, state: "FUTURE", isToday };
    const status = statusByDate.get(date);
    if (status === "DONE") return { date, state: "DONE", isToday };
    if (status === "SKIPPED") return { date, state: "SKIPPED", isToday };
    if (routine.timesPerWeek) return { date, state: "OPEN", isToday };
    return { date, state: isToday ? "PENDING" : "MISSED", isToday };
  });

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));

  const weekGoals = routine.timesPerWeek
    ? weeks.map((week) => {
        const monday = week[0]?.date ?? start;
        const progress = weekProgress(routine, logs, monday);
        if (progress.target === 0) return null;
        return { ...progress, current: addDays(monday, 6) >= today };
      })
    : null;

  return {
    month,
    weeks,
    adherence: computeAdherence(routine, logs, { from: first, to: last }, today),
    weekGoals,
  };
}

// ---------------------------------------------------------------------------
// Weekly goal (plan 017)
// ---------------------------------------------------------------------------

/** Days of [from, to] inside the routine's own period. */
function activeDays(routine: Schedule, from: string, to: string): string[] {
  return eachDay(from, to).filter((date) => isScheduledOn(routine, date));
}

/**
 * Days done and the goal in the week of `date`. The goal is prorated when the
 * routine covers only part of the week (it starts or ends mid-week).
 */
export function weekProgress(
  routine: Schedule,
  logs: readonly { date: string; status: RoutineLogStatus }[],
  date: string,
): WeekProgress {
  const monday = mondayOf(date);
  const days = activeDays(routine, monday, addDays(monday, 6));
  const doneDates = new Set(logs.filter((log) => log.status === "DONE").map((log) => log.date));
  return {
    done: days.filter((day) => doneDates.has(day)).length,
    target: Math.min(routine.timesPerWeek ?? 0, days.length),
  };
}

/**
 * Adherence of a weekly goal in "goal days" (plan 017), so it adds up with
 * fixed-days routines: each week's scheduled days are its goal (prorated to the
 * days of the week inside the routine and the period), done days count up to
 * the goal, and a week that is not over yet only counts what was done.
 */
function weeklyGoalAdherence(
  routine: Schedule,
  logs: readonly { date: string; status: RoutineLogStatus }[],
  period: Period,
  today: string,
): Adherence {
  const goal = routine.timesPerWeek ?? 0;
  const doneDates = new Set(logs.filter((log) => log.status === "DONE").map((log) => log.date));
  let scheduled = 0;
  let done = 0;

  for (let monday = mondayOf(period.from); monday <= period.to; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6);
    const from = latest(monday, period.from);
    const to = sunday < period.to ? sunday : period.to;
    const days = activeDays(routine, from, to);
    if (days.length === 0) continue;
    const target = Math.min(goal, days.length);
    const doneInWeek = Math.min(
      target,
      days.filter((day) => doneDates.has(day) && day <= today).length,
    );
    // The week is not over: a shortfall is not a miss yet.
    const closed = sunday < today;
    scheduled += closed ? target : doneInWeek;
    done += doneInWeek;
  }

  return withRate({ scheduled, done, skipped: 0, missed: scheduled - done });
}

/** The months the calendar can show: from the start month to today (or to the end month). */
export function monthRange(
  routine: Pick<Schedule, "startDate" | "endDate">,
  today: string,
): MonthRange {
  const from = monthOf(routine.startDate);
  if (routine.startDate > today) return { from, to: from };
  const lastDay = routine.endDate !== null && routine.endDate < today ? routine.endDate : today;
  return { from, to: monthOf(lastDay) };
}

/** The `?mes=` value when it is a valid month inside the range; otherwise the last month. */
export function parseMonth(value: string | undefined, range: MonthRange): string {
  if (value === undefined || !MONTH_PATTERN.test(value)) return range.to;
  // "YYYY-MM" strings compare in calendar order.
  return value >= range.from && value <= range.to ? value : range.to;
}

// ---------------------------------------------------------------------------
// Streak (plan 019)
// ---------------------------------------------------------------------------

/**
 * `current`: the run that is still going (null for a routine that already
 * ended); `best`: the longest run in the whole history. In days for fixed-days
 * routines, in weeks for a weekly goal.
 */
export type RoutineStreak = { unit: "DAYS" | "WEEKS"; current: number | null; best: number };

/**
 * Fixed days: scheduled days done in a row; a skipped day or a scheduled day
 * that passed without a log breaks the run, a day not scheduled does not count,
 * and today without a log does not break it yet. Weekly goal: weeks in a row
 * with the goal met; a closed week below the goal breaks the run, the current
 * week only adds once met.
 */
export function routineStreak(
  routine: Schedule,
  logs: readonly { date: string; status: RoutineLogStatus }[],
  today: string,
): RoutineStreak {
  const ended = routine.endDate !== null && routine.endDate < today;
  const last = ended && routine.endDate !== null ? routine.endDate : today;
  let run = 0;
  let best = 0;
  const add = () => {
    run++;
    best = Math.max(best, run);
  };

  if (routine.timesPerWeek) {
    for (let monday = mondayOf(routine.startDate); monday <= last; monday = addDays(monday, 7)) {
      const { done, target } = weekProgress(routine, logs, monday);
      if (target === 0) continue;
      if (done >= target) add();
      // A week that is not over yet does not break the run.
      else if (addDays(monday, 6) < today) run = 0;
    }
    return { unit: "WEEKS", current: ended ? null : run, best };
  }

  const statusByDate = new Map(logs.map((log) => [log.date, log.status]));
  for (const date of eachDay(routine.startDate, last)) {
    if (!isScheduledOn(routine, date)) continue;
    const status = statusByDate.get(date);
    if (status === "DONE") add();
    // Today is not over: no log yet is not a miss.
    else if (!(date === today && status === undefined)) run = 0;
  }
  return { unit: "DAYS", current: ended ? null : run, best };
}

// ---------------------------------------------------------------------------
// Weekly adherence chart (plan 029)
// ---------------------------------------------------------------------------

/** How many weeks the chart shows, the current one included. */
export const CHART_WEEKS = 12;

/**
 * One week of the chart. `adherence` is null when the routine has no scheduled
 * day in the whole week (before it starts, after it ends): no bar, not 0%.
 */
export type WeekAdherence = {
  monday: string;
  sunday: string;
  /** The week of today: it only counts up to today. */
  current: boolean;
  adherence: Adherence | null;
};

/** The weeks of the chart, oldest first, ending with the current week. */
function chartWeeks(today: string, weeks: number) {
  const currentMonday = mondayOf(today);
  return Array.from({ length: weeks }, (_, index) => {
    const monday = addDays(currentMonday, -7 * (weeks - 1 - index));
    return { monday, sunday: addDays(monday, 6), current: monday === currentMonday };
  });
}

/** Adherence of each of the last weeks, with the same rules as computeAdherence. */
export function weeklyAdherence(
  routine: Schedule,
  logs: readonly { date: string; status: RoutineLogStatus }[],
  today: string,
  weeks: number = CHART_WEEKS,
): WeekAdherence[] {
  return chartWeeks(today, weeks).map((week) => {
    const hasDays = eachDay(week.monday, week.sunday).some((date) => isScheduledOn(routine, date));
    return {
      ...week,
      adherence: hasDays
        ? computeAdherence(routine, logs, { from: week.monday, to: week.sunday }, today)
        : null,
    };
  });
}

/** Several routines summed week by week (the dashboard); null where all of them were null. */
export function combineWeeklyAdherence(
  lists: readonly (readonly WeekAdherence[])[],
  today: string,
  weeks: number = CHART_WEEKS,
): WeekAdherence[] {
  return chartWeeks(today, weeks).map((week, index) => {
    const items = lists.flatMap((list) => {
      const adherence = list[index]?.adherence;
      return adherence ? [adherence] : [];
    });
    return { ...week, adherence: items.length === 0 ? null : combineAdherence(items) };
  });
}
