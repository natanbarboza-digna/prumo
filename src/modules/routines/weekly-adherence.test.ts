import { describe, expect, it } from "vitest";

import type { Weekday } from "@/generated/prisma/enums";
import { weekAdherenceText } from "@/modules/routines/labels";
import {
  type Schedule,
  type WeekAdherence,
  combineWeeklyAdherence,
  weeklyAdherence,
} from "@/modules/routines/rules";

// 2026-11-19 is a Thursday; its week goes from Monday 16 to Sunday 22.
const today = "2026-11-19";
const everyDay: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function daily(overrides: Partial<Schedule> = {}): Schedule {
  return { weekdays: everyDay, startDate: "2026-08-01", endDate: null, ...overrides };
}

const done = (...dates: string[]) => dates.map((date) => ({ date, status: "DONE" as const }));
const skipped = (date: string) => ({ date, status: "SKIPPED" as const });

/** The week starting on that Monday. */
const week = (weeks: WeekAdherence[], monday: string) => weeks.find((w) => w.monday === monday)!;

describe("weeklyAdherence (plan 029)", () => {
  it("covers the 12 weeks up to the current one, Monday to Sunday, oldest first", () => {
    const weeks = weeklyAdherence(daily(), [], today);

    expect(weeks).toHaveLength(12);
    expect(weeks[0]).toMatchObject({ monday: "2026-08-31", sunday: "2026-09-06", current: false });
    expect(weeks[11]).toMatchObject({ monday: "2026-11-16", sunday: "2026-11-22", current: true });
  });

  it("counts done over scheduled days, with skipped and missed days as not done", () => {
    // Week of 9 to 15: 4 done, 1 skipped, 2 without a log.
    const logs = [
      ...done("2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"),
      skipped("2026-11-13"),
    ];

    const lastWeek = week(weeklyAdherence(daily(), logs, today), "2026-11-09");

    expect(lastWeek.adherence).toMatchObject({
      scheduled: 7,
      done: 4,
      skipped: 1,
      missed: 2,
      rate: 57,
    });
  });

  it("only counts the current week up to today, leaving today out until it is logged", () => {
    const current = week(
      weeklyAdherence(daily(), done("2026-11-16", "2026-11-17"), today),
      "2026-11-16",
    );

    // Monday to Wednesday count (2 done, 1 missed); Thursday (today) has no log yet.
    expect(current.adherence).toMatchObject({ scheduled: 3, done: 2, rate: 67 });
  });

  it("leaves a week without any scheduled day as null, not 0%", () => {
    const routine = daily({ startDate: "2026-11-04", endDate: null, weekdays: ["WED"] });

    const weeks = weeklyAdherence(routine, done("2026-11-04"), today);

    expect(week(weeks, "2026-10-26").adherence).toBeNull(); // before the start
    expect(week(weeks, "2026-11-02").adherence).toMatchObject({ scheduled: 1, done: 1 });
    expect(weeks[0]!.adherence).toBeNull();
  });

  it("is null after the routine ended", () => {
    const routine = daily({ startDate: "2026-11-02", endDate: "2026-11-08" });

    const weeks = weeklyAdherence(routine, [], today);

    expect(week(weeks, "2026-11-02").adherence).toMatchObject({ scheduled: 7, done: 0 });
    expect(week(weeks, "2026-11-09").adherence).toBeNull();
  });

  it("uses goal days for a weekly goal, capped by the days of a partial first week", () => {
    // 3x per week from Thursday the 5th: that first week has 4 days, so its goal stays 3.
    const routine = daily({ timesPerWeek: 3, startDate: "2026-11-05" });
    const logs = done("2026-11-05", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13");

    const weeks = weeklyAdherence(routine, logs, today);

    expect(week(weeks, "2026-11-02").adherence).toMatchObject({ scheduled: 3, done: 1 });
    // Four done in a 3x week: done counts up to the goal.
    expect(week(weeks, "2026-11-09").adherence).toMatchObject({ scheduled: 3, done: 3, rate: 100 });
  });
});

describe("combineWeeklyAdherence", () => {
  it("adds the routines week by week, and keeps a week null when every routine had none", () => {
    const morning = weeklyAdherence(daily(), done("2026-11-09", "2026-11-10"), today);
    const night = weeklyAdherence(daily({ startDate: "2026-11-09" }), done("2026-11-09"), today);

    const combined = combineWeeklyAdherence([morning, night], today);

    expect(combined).toHaveLength(12);
    expect(week(combined, "2026-11-09").adherence).toMatchObject({ scheduled: 14, done: 3 });
    expect(week(combined, "2026-11-02").adherence).toMatchObject({ scheduled: 7, done: 0 });
    const nothing = combineWeeklyAdherence(
      [weeklyAdherence(daily({ startDate: "2026-12-01" }), [], today)],
      today,
    );
    expect(nothing.every((w) => w.adherence === null)).toBe(true);
  });

  it("gives the 12 empty weeks when there is no routine", () => {
    const weeks = combineWeeklyAdherence([], today);

    expect(weeks).toHaveLength(12);
    expect(weeks.every((w) => w.adherence === null)).toBe(true);
  });
});

describe("weekAdherenceText", () => {
  it("describes a week for the chart's table", () => {
    expect(weekAdherenceText({ scheduled: 7, done: 4, skipped: 1, missed: 2, rate: 57 })).toBe(
      "57% (4 de 7 dias)",
    );
    expect(weekAdherenceText({ scheduled: 1, done: 1, skipped: 0, missed: 0, rate: 100 })).toBe(
      "100% (1 de 1 dia)",
    );
    expect(weekAdherenceText({ scheduled: 0, done: 0, skipped: 0, missed: 0, rate: 0 })).toBe(
      "nada para contar ainda",
    );
    expect(weekAdherenceText(null)).toBe("sem dias previstos");
  });
});
