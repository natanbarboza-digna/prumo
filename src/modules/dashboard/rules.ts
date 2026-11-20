// Pure dashboard rules: no database access, so they are tested without one.

import { addDays, mondayOf } from "@/lib/dates";

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

/** "Próximos 14 dias": today and the 13 days after it. */
export const DEADLINE_HORIZON_DAYS = 14;
export const DEADLINE_LIMIT = 10;
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
