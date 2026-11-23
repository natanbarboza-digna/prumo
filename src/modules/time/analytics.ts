// Time analytics (plan 032): totals, work by category, by project and by
// activity, the days and how fragmented they were. Pure: the page passes the
// days it loaded, so every number here is tested without a database.

import type { TimeEntryKind } from "@/generated/prisma/enums";
import type { ProjectFilter } from "@/modules/time/period";
import { type DayShape, daySummary } from "@/modules/time/rules";

type Named = { id: string; name: string };

export type AnalyticsEntry = {
  startMinute: number;
  minutes: number;
  kind: TimeEntryKind;
  description: string | null;
  category: Named | null;
  project: Named | null;
};

export type AnalyticsDay = DayShape & { date: string; entries: AnalyticsEntry[] };

export type AnalyticsFilters = { categoryId: string | null; projectId: ProjectFilter };

/** Today and the current time, so today's open day counts up to now. */
export type AnalyticsClock = { today: string; nowMinute: number };

export type Share = { id: string | null; name: string | null; minutes: number; percent: number };

export type Activity = { text: string; minutes: number; blocks: number; category: string | null };

export type DayLine = {
  date: string;
  worked: number;
  breaks: number;
  unregistered: number;
  switches: number;
};

export type Analytics = {
  totals: {
    days: number;
    presence: number;
    worked: number;
    breaks: number;
    unregistered: number;
    /** Worked minutes per tracked day, rounded. */
    averageWorked: number;
    longestDay: { date: string; worked: number } | null;
    /** Work matching the category or project filter; null without filters. */
    filtered: number | null;
  };
  byCategory: Share[];
  byProject: Share[];
  activities: Activity[];
  perDay: DayLine[];
  /** Topic switches per tracked day, with one decimal. */
  averageSwitches: number;
};

export const TOP_ACTIVITIES = 10;

/** "  Configuração   Digna " → "configuracao digna": the same activity however it was typed. */
export function normalizeActivity(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

function matches(entry: AnalyticsEntry, filters: AnalyticsFilters): boolean {
  if (entry.kind !== "WORK") return false;
  if (filters.categoryId !== null && entry.category?.id !== filters.categoryId) return false;
  if (filters.projectId === "none") return entry.project === null;
  if (filters.projectId !== null) return entry.project?.id === filters.projectId;
  return true;
}

/**
 * Whole percentages that add up to 100 (largest remainder): 66.7 / 33.3 gives
 * 67 / 33, never 67 / 34 or 66 / 33.
 */
function percentages(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) return values.map(() => 0);
  const exact = values.map((value) => (value / total) * 100);
  const result = exact.map(Math.floor);
  let missing = 100 - result.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (missing <= 0) break;
    result[index] = (result[index] ?? 0) + 1;
    missing--;
  }
  return result;
}

/** Sums minutes by a key, biggest first, with percentages of their total. */
function shares(
  entries: readonly AnalyticsEntry[],
  keyOf: (entry: AnalyticsEntry) => Named | null,
): Share[] {
  const sums = new Map<string | null, { name: string | null; minutes: number }>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const current = sums.get(key?.id ?? null) ?? { name: key?.name ?? null, minutes: 0 };
    current.minutes += entry.minutes;
    sums.set(key?.id ?? null, current);
  }
  // Biggest first; "without" (null) always last.
  const rows = [...sums.entries()]
    .map(([id, { name, minutes }]) => ({ id, name, minutes }))
    .sort((a, b) =>
      a.id === null
        ? 1
        : b.id === null
          ? -1
          : b.minutes - a.minutes || (a.name ?? "").localeCompare(b.name ?? "", "pt-BR"),
    );
  const percents = percentages(rows.map((row) => row.minutes));
  return rows.map((row, index) => ({ ...row, percent: percents[index] ?? 0 }));
}

/** Changes of activity (text or project) between the day's work blocks, in time order. */
function switchesOf(entries: readonly AnalyticsEntry[]): number {
  const work = entries
    .filter((entry) => entry.kind === "WORK")
    .sort((a, b) => a.startMinute - b.startMinute);
  let switches = 0;
  for (let index = 1; index < work.length; index++) {
    const previous = work[index - 1]!;
    const current = work[index]!;
    const sameText =
      normalizeActivity(previous.description ?? "") ===
      normalizeActivity(current.description ?? "");
    if (!sameText || previous.project?.id !== current.project?.id) switches++;
  }
  return switches;
}

export function computeAnalytics(
  days: readonly AnalyticsDay[],
  filters: AnalyticsFilters,
  clock: AnalyticsClock,
): Analytics {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  // Each day's line, plus its presence (summed in the totals, not shown per day).
  const lines: (DayLine & { presence: number })[] = sorted.map((day) => {
    // Today's open day counts up to now; any other open day up to midnight.
    const now = day.endMinute === null && day.date === clock.today ? clock.nowMinute : null;
    const summary = daySummary(day, day.entries, { now });
    return {
      date: day.date,
      worked: summary.worked,
      breaks: summary.breaks,
      unregistered: summary.unregistered,
      switches: switchesOf(day.entries),
      presence: summary.presence,
    };
  });
  const perDay: DayLine[] = lines.map((line) => ({
    date: line.date,
    worked: line.worked,
    breaks: line.breaks,
    unregistered: line.unregistered,
    switches: line.switches,
  }));

  const sum = (key: "worked" | "breaks" | "unregistered" | "presence") =>
    lines.reduce((total, line) => total + line[key], 0);
  const worked = sum("worked");
  const longest = perDay.reduce<DayLine | null>(
    // Ties go to the most recent day (the list is in date order).
    (best, line) => (best === null || line.worked >= best.worked ? line : best),
    null,
  );

  // Work that passes the filters, with the date of its day (for the activity's latest text).
  const work = sorted.flatMap((day) =>
    day.entries
      .filter((entry) => matches(entry, filters))
      .map((entry) => ({ entry, date: day.date })),
  );
  const workEntries = work.map(({ entry }) => entry);

  const activities = new Map<
    string,
    { text: string; minutes: number; blocks: number; byCategory: Map<string, number> }
  >();
  for (const { entry } of work) {
    const key = normalizeActivity(entry.description ?? "");
    const current = activities.get(key) ?? {
      text: (entry.description ?? "").trim(),
      minutes: 0,
      blocks: 0,
      byCategory: new Map<string, number>(),
    };
    // `work` is in date and time order: the last text seen is the most recent spelling.
    current.text = (entry.description ?? "").trim();
    current.minutes += entry.minutes;
    current.blocks += 1;
    const category = entry.category?.name ?? "";
    current.byCategory.set(category, (current.byCategory.get(category) ?? 0) + entry.minutes);
    activities.set(key, current);
  }

  return {
    totals: {
      days: perDay.length,
      presence: sum("presence"),
      worked,
      breaks: sum("breaks"),
      unregistered: sum("unregistered"),
      averageWorked: perDay.length === 0 ? 0 : Math.round(worked / perDay.length),
      longestDay: longest ? { date: longest.date, worked: longest.worked } : null,
      filtered:
        filters.categoryId === null && filters.projectId === null
          ? null
          : workEntries.reduce((total, entry) => total + entry.minutes, 0),
    },
    byCategory: shares(workEntries, (entry) => entry.category),
    byProject: shares(workEntries, (entry) => entry.project),
    activities: [...activities.values()]
      .sort((a, b) => b.minutes - a.minutes || b.blocks - a.blocks)
      .slice(0, TOP_ACTIVITIES)
      .map(({ text, minutes, blocks, byCategory }) => ({
        text,
        minutes,
        blocks,
        category: [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      })),
    perDay,
    averageSwitches:
      perDay.length === 0
        ? 0
        : Math.round(
            (perDay.reduce((total, line) => total + line.switches, 0) / perDay.length) * 10,
          ) / 10,
  };
}
