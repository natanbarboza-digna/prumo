// The period and filters of the time analytics page (plan 032), read from the
// URL. Pure: no database access.

import { addDays, isValidDateOnly, mondayOf } from "@/lib/dates";
import { isUuid } from "@/lib/form-fields";

export const ANALYTICS_PERIODS = [
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "last30",
  "custom",
] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export type DateRange = { from: string; to: string };

/** "none" filters the work with no project. */
export type ProjectFilter = string | "none" | null;

export type AnalyticsQuery = DateRange & {
  period: AnalyticsPeriod;
  categoryId: string | null;
  projectId: ProjectFilter;
};

const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
/** The last day of the month of a date: the day before the next month starts. */
const monthEnd = (date: string) => addDays(monthStart(addDays(monthStart(date), 31)), -1);

/** The dates a fixed period covers (weeks go from Monday to Sunday). */
export function periodRange(period: Exclude<AnalyticsPeriod, "custom">, today: string): DateRange {
  switch (period) {
    case "thisWeek": {
      const monday = mondayOf(today);
      return { from: monday, to: addDays(monday, 6) };
    }
    case "lastWeek": {
      const monday = addDays(mondayOf(today), -7);
      return { from: monday, to: addDays(monday, 6) };
    }
    case "thisMonth":
      return { from: monthStart(today), to: monthEnd(today) };
    case "lastMonth": {
      const previous = addDays(monthStart(today), -1);
      return { from: monthStart(previous), to: previous };
    }
    case "last30":
      return { from: addDays(today, -29), to: today };
  }
}

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/**
 * ?periodo=, ?de=, ?ate=, ?categoria=, ?projeto=. Anything invalid falls back
 * to this week and no filters; a custom range needs both dates, in order.
 */
export function analyticsQuery(query: Query, today: string): AnalyticsQuery {
  const asked = one(query.periodo);
  const category = one(query.categoria);
  const project = one(query.projeto);
  const filters = {
    categoryId: isUuid(category) ? category : null,
    projectId: project === "none" || isUuid(project) ? project : null,
  };

  if (asked === "custom") {
    const from = one(query.de);
    const to = one(query.ate);
    if (isValidDateOnly(from) && isValidDateOnly(to) && from <= to) {
      return { period: "custom", from, to, ...filters };
    }
  } else if ((ANALYTICS_PERIODS as readonly string[]).includes(asked)) {
    const period = asked as Exclude<AnalyticsPeriod, "custom">;
    return { period, ...periodRange(period, today), ...filters };
  }
  return { period: "thisWeek", ...periodRange("thisWeek", today), ...filters };
}
