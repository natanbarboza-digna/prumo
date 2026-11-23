import { describe, expect, it } from "vitest";

import {
  DEADLINE_LIMIT,
  type Deadline,
  categoryShares,
  groupDeadlines,
  groupDeadlinesByWeek,
  weekTimeBars,
} from "@/modules/dashboard/rules";

const today = "2026-11-16";

function deadline(date: string, title = `Item ${date}`): Deadline {
  return { kind: "STEP", id: `${date}-${title}`, title, date, href: "/tracks/1", source: null };
}

describe("groupDeadlines", () => {
  it("splits overdue items (before today) from upcoming ones (today on)", () => {
    const groups = groupDeadlines([deadline("2026-11-15"), deadline(today)], today);

    expect(groups.overdue.items.map((item) => item.date)).toEqual(["2026-11-15"]);
    expect(groups.upcoming.items.map((item) => item.date)).toEqual([today]);
  });

  it("keeps upcoming items up to today + 13 and leaves the rest out", () => {
    const groups = groupDeadlines([deadline("2026-11-29"), deadline("2026-11-30")], today);

    expect(groups.upcoming.items.map((item) => item.date)).toEqual(["2026-11-29"]);
    expect(groups.upcoming.hidden).toBe(0);
  });

  it("orders by date, then by title", () => {
    const groups = groupDeadlines(
      [
        deadline("2026-11-20", "B"),
        deadline("2026-11-18", "Z"),
        deadline("2026-11-20", "A"),
        deadline("2026-11-10", "Atraso recente"),
        deadline("2026-10-01", "Atraso antigo"),
      ],
      today,
    );

    expect(groups.upcoming.items.map((item) => item.title)).toEqual(["Z", "A", "B"]);
    expect(groups.overdue.items.map((item) => item.title)).toEqual([
      "Atraso antigo",
      "Atraso recente",
    ]);
  });

  it("lists 5 per group on the dashboard (plan 034)", () => {
    expect(DEADLINE_LIMIT).toBe(5);
  });

  it("shows at most the limit per group and counts what was left out", () => {
    const items = Array.from({ length: 12 }, (_, index) => deadline(today, `Item ${index + 10}`));

    const groups = groupDeadlines(items, today, { limit: 10 });

    expect(groups.upcoming.items).toHaveLength(10);
    expect(groups.upcoming.hidden).toBe(2);
    expect(groups.overdue).toEqual({ items: [], hidden: 0 });
  });

  it("accepts another horizon", () => {
    const groups = groupDeadlines([deadline("2026-11-17"), deadline("2026-11-18")], today, {
      horizonDays: 2,
    });

    expect(groups.upcoming.items.map((item) => item.date)).toEqual(["2026-11-17"]);
  });

  it("is empty without items", () => {
    expect(groupDeadlines([], today)).toEqual({
      overdue: { items: [], hidden: 0 },
      upcoming: { items: [], hidden: 0 },
    });
  });
});

describe("groupDeadlinesByWeek (plan 028)", () => {
  // 2026-11-19 is a Thursday: its week goes from Monday 16 to Sunday 22.
  const thursday = "2026-11-19";
  const dates = (items: Deadline[]) => items.map((item) => item.date);

  it("puts overdue items first, oldest first, whatever the period", () => {
    const groups = groupDeadlinesByWeek(
      [deadline("2026-11-18"), deadline("2026-10-01"), deadline(thursday)],
      thursday,
      { periodDays: 7 },
    );

    expect(dates(groups.overdue)).toEqual(["2026-10-01", "2026-11-18"]);
  });

  it("groups the rest by week, Monday to Sunday, from today on", () => {
    const groups = groupDeadlinesByWeek(
      [deadline("2026-12-01"), deadline("2026-11-22"), deadline(thursday), deadline("2026-11-23")],
      thursday,
      { periodDays: 30 },
    );

    expect(groups.weeks.map((week) => [week.monday, week.sunday, dates(week.items)])).toEqual([
      ["2026-11-16", "2026-11-22", [thursday, "2026-11-22"]],
      ["2026-11-23", "2026-11-29", ["2026-11-23"]],
      ["2026-11-30", "2026-12-06", ["2026-12-01"]],
    ]);
  });

  it("orders each week by date, then title, and leaves empty weeks out", () => {
    const groups = groupDeadlinesByWeek(
      [deadline("2026-11-20", "B"), deadline("2026-11-20", "A"), deadline("2026-12-10")],
      thursday,
      { periodDays: null },
    );

    expect(groups.weeks.map((week) => week.monday)).toEqual(["2026-11-16", "2026-12-07"]);
    expect(groups.weeks[0]!.items.map((item) => item.title)).toEqual(["A", "B"]);
  });

  it("cuts what goes past today + period − 1 days, and keeps everything for all", () => {
    const items = [deadline("2026-11-25"), deadline("2026-11-26"), deadline("2027-03-01")];

    // 7 days: Thursday 19 up to Wednesday 25.
    const week = groupDeadlinesByWeek(items, thursday, { periodDays: 7 });
    expect(week.weeks.flatMap((group) => dates(group.items))).toEqual(["2026-11-25"]);

    const all = groupDeadlinesByWeek(items, thursday, { periodDays: null });
    expect(all.weeks.flatMap((group) => dates(group.items))).toHaveLength(3);
  });

  it("starts the current week at today when today is a Sunday", () => {
    const sunday = "2026-11-22";

    const groups = groupDeadlinesByWeek([deadline(sunday), deadline("2026-11-23")], sunday, {
      periodDays: 30,
    });

    expect(groups.weeks.map((week) => week.monday)).toEqual(["2026-11-16", "2026-11-23"]);
    expect(dates(groups.weeks[0]!.items)).toEqual([sunday]);
  });
});

describe("weekTimeBars (plan 034)", () => {
  // Thursday.
  const thursday = "2026-11-19";

  it("gives Monday to Sunday with the hours worked, today marked and future days empty", () => {
    const bars = weekTimeBars(
      [
        { date: "2026-11-16", worked: 480 },
        { date: "2026-11-18", worked: 240 },
        { date: thursday, worked: 120 },
      ],
      thursday,
    );

    expect(bars.map((bar) => bar.weekday)).toEqual([
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
      "SUN",
    ]);
    expect(bars.map((bar) => bar.minutes)).toEqual([480, 0, 240, 120, 0, 0, 0]);
    expect(bars.map((bar) => bar.height)).toEqual([100, 0, 50, 25, 0, 0, 0]);
    expect(bars.filter((bar) => bar.isToday).map((bar) => bar.date)).toEqual([thursday]);
    expect(bars.map((bar) => bar.isFuture)).toEqual([false, false, false, false, true, true, true]);
  });

  it("ignores days outside the week and handles a week without records", () => {
    const bars = weekTimeBars([{ date: "2026-11-13", worked: 300 }], thursday);

    expect(bars.every((bar) => bar.minutes === 0 && bar.height === 0)).toBe(true);
    expect(bars[0]!.date).toBe("2026-11-16");
    expect(bars[6]!.date).toBe("2026-11-22");
  });
});

describe("categoryShares (plan 034)", () => {
  const share = (name: string, minutes: number) => ({ id: name, name, minutes, percent: 0 });

  it("keeps up to five categories with their tone, in the given order", () => {
    const shares = categoryShares([share("Projeto", 120), share("Chamados", 60)]);

    expect(shares).toEqual([
      { name: "Projeto", minutes: 120, percent: 67, tone: 1 },
      { name: "Chamados", minutes: 60, percent: 33, tone: 2 },
    ]);
  });

  it("sums the categories after the fifth into Outras, with percentages adding up to 100", () => {
    const shares = categoryShares([
      share("A", 300),
      share("B", 200),
      share("C", 100),
      share("D", 100),
      share("E", 50),
      share("F", 30),
      share("G", 20),
    ]);

    expect(shares.map((item) => [item.name, item.minutes, item.tone])).toEqual([
      ["A", 300, 1],
      ["B", 200, 2],
      ["C", 100, 3],
      ["D", 100, 4],
      ["E", 50, 5],
      ["Outras", 50, null],
    ]);
    expect(shares.reduce((total, item) => total + item.percent, 0)).toBe(100);
  });

  it("gives nothing without work", () => {
    expect(categoryShares([])).toEqual([]);
  });
});
