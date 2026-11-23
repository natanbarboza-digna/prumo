// Pure dashboard rules: no database access, so they are tested without one.

import type { Weekday } from "@/generated/prisma/enums";
import { addDays, mondayOf, weekdayOf } from "@/lib/dates";
import { type Share, percentages } from "@/modules/time/analytics";

export type DeadlineKind = "STEP" | "ACTION" | "GOAL";

/** Something with a due date: a track step, a PDI action or a goal's target date. */
export type Deadline = {
  kind: DeadlineKind;
  id: string;
  title: string;
  /** "YYYY-MM-DD". */
  date: string;
  href: string;
  /** Where the item lives (track or cycle title), when it matters. */
  source: string | null;
};

/** The items shown, plus how many were left out by the limit. */
export type DeadlineGroup = { items: Deadline[]; hidden: number };

export type DeadlineGroups = { overdue: DeadlineGroup; upcoming: DeadlineGroup };

/** The numbers at the top of the dashboard (plan 034). */
export type DashboardKpis = {
  routinesToday: { done: number; total: number };
  /** The active routines in the last 30 days (`rate` of `scheduled` days). */
  adherence: { scheduled: number; rate: number };
  /** Minutes worked from Monday to today. */
  workedThisWeek: number;
  /** All overdue deadlines, including those the card leaves out. */
  overdue: number;
  /** Done actions of the active cycle (cancelled ones left out); null without one. */
  pdi: { cycleId: string; percent: number } | null;
};

/** "Próximos 14 dias": today and the 13 days after it. */
export const DEADLINE_HORIZON_DAYS = 14;
export const DEADLINE_LIMIT = 5;
/** How many goals and tracks each dashboard card lists. */
export const DASHBOARD_LIST_LIMIT = 5;

/**
 * Overdue items (before today) and upcoming ones (today up to the horizon),
 * each ordered by date then title and cut at the limit. Later items are left out.
 */
export function groupDeadlines(
  items: readonly Deadline[],
  today: string,
  { horizonDays = DEADLINE_HORIZON_DAYS, limit = DEADLINE_LIMIT } = {},
): DeadlineGroups {
  const lastDay = addDays(today, horizonDays - 1);
  const sorted = sortDeadlines(items);
  // "YYYY-MM-DD" strings compare in calendar order.
  const overdue = sorted.filter((item) => item.date < today);
  const upcoming = sorted.filter((item) => item.date >= today && item.date <= lastDay);
  return { overdue: cut(overdue, limit), upcoming: cut(upcoming, limit) };
}

function cut(items: Deadline[], limit: number): DeadlineGroup {
  return { items: items.slice(0, limit), hidden: Math.max(0, items.length - limit) };
}

/** One week of the deadlines page (plan 028), Monday to Sunday. */
export type DeadlineWeek = { monday: string; sunday: string; items: Deadline[] };

export type DeadlinesByWeek = { overdue: Deadline[]; weeks: DeadlineWeek[] };

/**
 * The deadlines page: overdue items first (always, whatever the period), then
 * the rest by week. `periodDays` keeps today up to today + N − 1; null keeps
 * everything. Each list goes by date, then title; empty weeks are left out.
 */
export function groupDeadlinesByWeek(
  items: readonly Deadline[],
  today: string,
  { periodDays }: { periodDays: number | null },
): DeadlinesByWeek {
  const lastDay = periodDays === null ? null : addDays(today, periodDays - 1);
  const sorted = sortDeadlines(items);
  const overdue = sorted.filter((item) => item.date < today);
  const weeks: DeadlineWeek[] = [];
  for (const item of sorted) {
    if (item.date < today || (lastDay !== null && item.date > lastDay)) continue;
    const monday = mondayOf(item.date);
    let week = weeks.at(-1);
    if (week?.monday !== monday) {
      week = { monday, sunday: addDays(monday, 6), items: [] };
      weeks.push(week);
    }
    week.items.push(item);
  }
  return { overdue, weeks };
}

/** By date, then by title in pt-BR order. */
function sortDeadlines(items: readonly Deadline[]): Deadline[] {
  return [...items].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "pt-BR"),
  );
}

// ---------------------------------------------------------------------------
// Time card (plan 034)
// ---------------------------------------------------------------------------

/** One day of the "Tempo da semana" chart. `height`: percent of the busiest day. */
export type WeekTimeBar = {
  date: string;
  weekday: Weekday;
  minutes: number;
  height: number;
  isToday: boolean;
  isFuture: boolean;
};

/** Monday to Sunday of today's week, with the minutes worked each day. */
export function weekTimeBars(
  days: readonly { date: string; worked: number }[],
  today: string,
): WeekTimeBar[] {
  const monday = mondayOf(today);
  const worked = new Map(days.map((day) => [day.date, day.worked]));
  const dates = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const minutes = dates.map((date) => worked.get(date) ?? 0);
  const busiest = Math.max(0, ...minutes);
  return dates.map((date, index) => ({
    date,
    weekday: weekdayOf(date),
    minutes: minutes[index] ?? 0,
    height: busiest === 0 ? 0 : Math.round(((minutes[index] ?? 0) / busiest) * 100),
    isToday: date === today,
    isFuture: date > today,
  }));
}

/** How many categories get their own tone; the rest add up to "Outras". */
export const CATEGORY_TONES = 5;

/** `tone`: 1 to 5, the `--chart-N` color; null for "Outras". */
export type CategoryShare = { name: string; minutes: number; percent: number; tone: number | null };

/** The biggest categories (already in order) and "Outras", with percentages that add up to 100. */
export function categoryShares(shares: readonly Share[]): CategoryShare[] {
  const top = shares.slice(0, CATEGORY_TONES);
  const rest = shares.slice(CATEGORY_TONES).reduce((total, share) => total + share.minutes, 0);
  const rows: Omit<CategoryShare, "percent">[] = top.map((share, index) => ({
    name: share.name ?? "Sem categoria",
    minutes: share.minutes,
    tone: index + 1,
  }));
  if (rest > 0) rows.push({ name: "Outras", minutes: rest, tone: null });
  const percents = percentages(rows.map((row) => row.minutes));
  return rows.map((row, index) => ({
    name: row.name,
    minutes: row.minutes,
    percent: percents[index] ?? 0,
    tone: row.tone,
  }));
}
