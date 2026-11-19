import { describe, expect, it } from "vitest";

import type { Weekday } from "@/generated/prisma/enums";
import { streakPageText, streakShortText } from "@/modules/routines/labels";
import { type Schedule, routineStreak } from "@/modules/routines/rules";

// 2026-11-19 is a Thursday; its week goes from Monday 16 to Sunday 22.
const today = "2026-11-19";
const everyDay: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function daily(overrides: Partial<Schedule> = {}): Schedule {
  return { weekdays: everyDay, startDate: "2026-11-01", endDate: null, ...overrides };
}

const done = (...dates: string[]) => dates.map((date) => ({ date, status: "DONE" as const }));
const skipped = (date: string) => ({ date, status: "SKIPPED" as const });

describe("routineStreak for fixed days", () => {
  it("counts the scheduled days done in a row, ending yesterday when today has no log", () => {
    const logs = done("2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18");

    expect(routineStreak(daily(), logs, today)).toEqual({ unit: "DAYS", current: 4, best: 4 });
  });

  it("adds today once it is done", () => {
    const logs = done("2026-11-17", "2026-11-18", today);

    expect(routineStreak(daily(), logs, today)).toMatchObject({ current: 3 });
  });

  it("breaks on a skipped day and on a scheduled day left without a log", () => {
    const skippedLogs = [
      ...done("2026-11-15", "2026-11-16"),
      skipped("2026-11-17"),
      ...done("2026-11-18"),
    ];
    expect(routineStreak(daily(), skippedLogs, today)).toMatchObject({ current: 1, best: 2 });

    // The 17th has no log at all.
    const missing = done("2026-11-14", "2026-11-15", "2026-11-16", "2026-11-18");
    expect(routineStreak(daily(), missing, today)).toMatchObject({ current: 1, best: 3 });
  });

  it("is broken today when today is skipped", () => {
    const logs = [...done("2026-11-17", "2026-11-18"), skipped(today)];

    expect(routineStreak(daily(), logs, today)).toMatchObject({ current: 0, best: 2 });
  });

  it("skips over days that are not scheduled", () => {
    // Monday, Wednesday and Friday: Tuesday the 17th is not a gap.
    const routine = daily({ weekdays: ["MON", "WED", "FRI"] });

    const streak = routineStreak(routine, done("2026-11-13", "2026-11-16", "2026-11-18"), today);

    expect(streak).toMatchObject({ current: 3 });
  });

  it("keeps the best run even after it was broken", () => {
    const logs = [
      ...done("2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"),
      skipped("2026-11-07"),
      ...done("2026-11-18"),
    ];

    expect(routineStreak(daily({ startDate: "2026-11-02" }), logs, today)).toMatchObject({
      current: 1,
      best: 5,
    });
  });

  it("is zero without anything done", () => {
    expect(routineStreak(daily(), [], today)).toEqual({ unit: "DAYS", current: 0, best: 0 });
  });

  it("only has a best for a routine that already ended", () => {
    const routine = daily({ startDate: "2026-11-01", endDate: "2026-11-10" });

    const streak = routineStreak(routine, done("2026-11-08", "2026-11-09", "2026-11-10"), today);

    expect(streak).toEqual({ unit: "DAYS", current: null, best: 3 });
  });
});

describe("routineStreak for a weekly goal", () => {
  // 2x per week from Monday, November 2.
  const weekly = (overrides: Partial<Schedule> = {}) =>
    daily({ timesPerWeek: 2, startDate: "2026-11-02", ...overrides });

  it("counts the weeks in a row with the goal met", () => {
    const logs = done("2026-11-02", "2026-11-05", "2026-11-10", "2026-11-11");

    expect(routineStreak(weekly(), logs, today)).toEqual({ unit: "WEEKS", current: 2, best: 2 });
  });

  it("adds the current week once its goal is met, and does not break it before that", () => {
    const met = done("2026-11-10", "2026-11-11", "2026-11-16", "2026-11-17");
    expect(routineStreak(weekly(), met, today)).toMatchObject({ current: 2 });

    const notYet = done("2026-11-10", "2026-11-11", "2026-11-16");
    expect(routineStreak(weekly(), notYet, today)).toMatchObject({ current: 1 });
  });

  it("breaks on a closed week below the goal", () => {
    const logs = done("2026-11-02", "2026-11-03", "2026-11-10");

    expect(routineStreak(weekly(), logs, today)).toMatchObject({ current: 0, best: 1 });
  });

  it("uses the prorated goal in a partial first week", () => {
    // Started on Sunday the 8th: one day that week, so its goal is 1.
    const logs = done("2026-11-08", "2026-11-10", "2026-11-12");

    expect(routineStreak(weekly({ startDate: "2026-11-08" }), logs, today)).toMatchObject({
      current: 2,
    });
  });
});

describe("streak labels", () => {
  it("shows the current streak from 2 on", () => {
    expect(streakShortText({ unit: "DAYS", current: 5, best: 9 })).toBe("5 dias seguidos");
    expect(streakShortText({ unit: "WEEKS", current: 2, best: 2 })).toBe("2 semanas seguidas");
    expect(streakShortText({ unit: "DAYS", current: 1, best: 3 })).toBeNull();
    expect(streakShortText({ unit: "DAYS", current: null, best: 3 })).toBeNull();
  });

  it("describes the streak on the routine page", () => {
    expect(streakPageText({ unit: "DAYS", current: 5, best: 12 })).toBe(
      "Sequência atual: 5 dias · Recorde: 12 dias",
    );
    expect(streakPageText({ unit: "WEEKS", current: 1, best: 1 })).toBe(
      "Sequência atual: 1 semana · Recorde: 1 semana",
    );
    expect(streakPageText({ unit: "DAYS", current: null, best: 4 })).toBe("Recorde: 4 dias");
    expect(streakPageText({ unit: "DAYS", current: 0, best: 0 })).toBe("Nenhuma sequência ainda");
  });
});
