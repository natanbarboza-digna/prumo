import { describe, expect, it } from "vitest";

import type { Weekday } from "@/generated/prisma/enums";
import {
  dayStateLabels,
  monthSummaryText,
  scheduleText,
  weekProgressText,
} from "@/modules/routines/labels";
import {
  type Schedule,
  computeAdherence,
  monthCalendar,
  weekProgress,
} from "@/modules/routines/rules";

// 2026-11-19 is a Thursday; its week goes from Monday 16 to Sunday 22.
const today = "2026-11-19";
const everyDay: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** 3x per week, started on Monday, November 2. */
function goal(overrides: Partial<Schedule> = {}): Schedule {
  return {
    weekdays: everyDay,
    timesPerWeek: 3,
    startDate: "2026-11-02",
    endDate: null,
    ...overrides,
  };
}

const done = (...dates: string[]) => dates.map((date) => ({ date, status: "DONE" as const }));

describe("computeAdherence for a weekly goal", () => {
  it("counts the goal of each closed week, with extra days not making up for another week", () => {
    const logs = done(
      // Week of the 2nd: 5 done, counts 3.
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      // Week of the 9th: 1 done of 3.
      "2026-11-10",
    );

    const adherence = computeAdherence(
      goal(),
      logs,
      { from: "2026-11-02", to: "2026-11-15" },
      today,
    );

    expect(adherence).toEqual({ scheduled: 6, done: 4, skipped: 0, missed: 2, rate: 67 });
  });

  it("counts only what was done in the current week, which is not over yet", () => {
    const adherence = computeAdherence(
      goal(),
      done("2026-11-16"),
      { from: "2026-11-16", to: "2026-11-22" },
      today,
    );

    expect(adherence).toEqual({ scheduled: 1, done: 1, skipped: 0, missed: 0, rate: 100 });
  });

  it("prorates a week cut by the start or end of the routine", () => {
    // Started on Saturday the 7th: only 2 days that week, so the goal is 2.
    const started = computeAdherence(
      goal({ startDate: "2026-11-07" }),
      done("2026-11-07"),
      { from: "2026-11-02", to: "2026-11-08" },
      today,
    );
    expect(started).toMatchObject({ scheduled: 2, done: 1, missed: 1 });

    // Ended on Tuesday the 10th: 2 days that week, goal 2.
    const ended = computeAdherence(
      goal({ endDate: "2026-11-10" }),
      done("2026-11-09", "2026-11-10"),
      { from: "2026-11-09", to: "2026-11-15" },
      today,
    );
    expect(ended).toMatchObject({ scheduled: 2, done: 2, missed: 0 });
  });

  it("prorates a week cut by the period itself (the last 30 days)", () => {
    // Only Saturday and Sunday of the week of the 2nd are in the period.
    const adherence = computeAdherence(
      goal(),
      done("2026-11-02", "2026-11-03", "2026-11-07"),
      { from: "2026-11-07", to: "2026-11-08" },
      today,
    );

    expect(adherence).toMatchObject({ scheduled: 2, done: 1, missed: 1 });
  });
});

describe("weekProgress", () => {
  it("counts the days done in the week of a date, Monday to Sunday", () => {
    const logs = done("2026-11-15", "2026-11-16", "2026-11-18", "2026-11-23");

    expect(weekProgress(goal(), logs, today)).toEqual({ done: 2, target: 3 });
    expect(weekProgress(goal(), logs, "2026-11-22")).toEqual({ done: 2, target: 3 });
  });

  it("prorates the goal for a week the routine only partly covers", () => {
    expect(weekProgress(goal({ startDate: "2026-11-21" }), [], today)).toEqual({
      done: 0,
      target: 2,
    });
  });
});

describe("monthCalendar for a weekly goal", () => {
  it("never marks a day as missed, and adds the progress of each week", () => {
    const calendar = monthCalendar(
      goal(),
      done("2026-11-02", "2026-11-04", "2026-11-06", "2026-11-10", "2026-11-17"),
      "2026-11",
      today,
    );
    const day = (date: string) => calendar.weeks.flat().find((item) => item.date === date);

    expect(day("2026-11-02")?.state).toBe("DONE");
    expect(day("2026-11-03")?.state).toBe("OPEN");
    expect(day(today)?.state).toBe("OPEN");
    expect(day("2026-11-20")?.state).toBe("FUTURE");
    expect(day("2026-11-01")?.state).toBe("NOT_SCHEDULED"); // before the start
    expect(calendar.weekGoals).toEqual([
      null, // October 26 to November 1: before the start
      { done: 3, target: 3, current: false },
      { done: 1, target: 3, current: false },
      { done: 1, target: 3, current: true },
      { done: 0, target: 3, current: true },
      { done: 0, target: 3, current: true },
    ]);
  });

  it("has no week column for a fixed-days routine", () => {
    const calendar = monthCalendar(goal({ timesPerWeek: null }), [], "2026-11", today);

    expect(calendar.weekGoals).toBeNull();
  });
});

describe("weekly goal labels", () => {
  it("describes the routine, the week and the month", () => {
    expect(scheduleText({ weekdays: everyDay, timesPerWeek: 3, timeOfDay: "18:30" })).toBe(
      "3 vezes por semana · 18:30",
    );
    expect(scheduleText({ weekdays: everyDay, timesPerWeek: 1, timeOfDay: null })).toBe(
      "1 vez por semana",
    );
    expect(scheduleText({ weekdays: ["MON", "WED"], timesPerWeek: null, timeOfDay: null })).toBe(
      "Seg, Qua",
    );
    expect(weekProgressText({ done: 1, target: 3 })).toBe("1 de 3 nesta semana");
    expect(weekProgressText({ done: 3, target: 3 })).toBe("Meta da semana cumprida (3 de 3)");
    expect(dayStateLabels.OPEN).toBe("livre");
    expect(
      monthSummaryText(
        "2026-11",
        { scheduled: 12, done: 10, skipped: 0, missed: 2, rate: 83 },
        { weeklyGoal: true },
      ),
    ).toBe("Em novembro: 10 de 12 dias da meta, 83% de adesão.");
  });
});
