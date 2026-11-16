import { describe, expect, it } from "vitest";

import type { Weekday } from "@/generated/prisma/enums";
import { computeAdherence, isScheduledOn, routineStateOn } from "@/modules/routines/service";

// 2026-11-16 is a Monday.
const today = "2026-11-16";

type Schedule = { weekdays: Weekday[]; startDate: string; endDate: string | null };

const everyDay: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return { weekdays: everyDay, startDate: "2026-11-01", endDate: null, ...overrides };
}

describe("isScheduledOn", () => {
  const routine = schedule({
    weekdays: ["MON", "WED"],
    startDate: "2026-11-02",
    endDate: "2026-11-18",
  });

  it.each([
    ["the start day", "2026-11-02", true],
    ["the end day", "2026-11-18", true],
    ["a listed weekday in between", "2026-11-09", true],
    ["a weekday not in the list", "2026-11-10", false],
    ["before the start", "2026-10-26", false],
    ["after the end", "2026-11-23", false],
  ])("on %s (%s) is %s", (_label, date, expected) => {
    expect(isScheduledOn(routine, date)).toBe(expected);
  });

  it("has no end when endDate is empty", () => {
    expect(isScheduledOn(schedule({ endDate: null }), "2030-01-01")).toBe(true);
  });
});

describe("routineStateOn", () => {
  it.each([
    ["starts in the future", schedule({ startDate: "2026-11-17" }), "UPCOMING"],
    ["starts today", schedule({ startDate: today }), "ACTIVE"],
    ["has no end", schedule(), "ACTIVE"],
    ["ends today", schedule({ endDate: today }), "ACTIVE"],
    ["ended yesterday", schedule({ endDate: "2026-11-15" }), "ENDED"],
  ])("a routine that %s is %s", (_label, routine, expected) => {
    expect(routineStateOn(routine, today)).toBe(expected);
  });
});

describe("computeAdherence", () => {
  const week = { from: "2026-11-09", to: "2026-11-15" };

  it("counts done, skipped and missed days", () => {
    const logs = [
      { date: "2026-11-09", status: "DONE" as const },
      { date: "2026-11-10", status: "DONE" as const },
      { date: "2026-11-11", status: "SKIPPED" as const },
    ];

    expect(computeAdherence(schedule(), logs, week, today)).toEqual({
      scheduled: 7,
      done: 2,
      skipped: 1,
      missed: 4,
      rate: 29,
    });
  });

  it("only counts the routine's weekdays", () => {
    const routine = schedule({ weekdays: ["MON", "WED", "FRI"] });
    const logs = [{ date: "2026-11-09", status: "DONE" as const }];

    expect(computeAdherence(routine, logs, week, today)).toMatchObject({
      scheduled: 3,
      done: 1,
      missed: 2,
    });
  });

  it("ignores logs on days the routine is no longer scheduled", () => {
    const routine = schedule({ weekdays: ["MON"] });
    const logs = [
      { date: "2026-11-09", status: "DONE" as const },
      { date: "2026-11-10", status: "DONE" as const },
    ];

    expect(computeAdherence(routine, logs, week, today)).toMatchObject({
      scheduled: 1,
      done: 1,
      rate: 100,
    });
  });

  it("respects the routine's start and end inside the period", () => {
    const routine = schedule({ startDate: "2026-11-11", endDate: "2026-11-13" });

    expect(computeAdherence(routine, [], week, today).scheduled).toBe(3);
  });

  it("ignores days after today", () => {
    expect(
      computeAdherence(schedule(), [], { from: "2026-11-14", to: "2026-11-20" }, today),
    ).toMatchObject({ scheduled: 2, missed: 2 });
  });

  it("does not count today as missed before it is logged", () => {
    const period = { from: "2026-11-15", to: today };

    expect(computeAdherence(schedule(), [], period, today)).toMatchObject({
      scheduled: 1,
      missed: 1,
    });
    expect(
      computeAdherence(schedule(), [{ date: today, status: "DONE" }], period, today),
    ).toMatchObject({ scheduled: 2, done: 1, missed: 1, rate: 50 });
  });

  it("has a rate of 0 when nothing was scheduled", () => {
    const routine = schedule({ startDate: "2026-12-01" });

    expect(computeAdherence(routine, [], week, today)).toEqual({
      scheduled: 0,
      done: 0,
      skipped: 0,
      missed: 0,
      rate: 0,
    });
  });

  it("rounds the rate to a whole number (2 of 3 is 67)", () => {
    const routine = schedule({ weekdays: ["MON", "TUE", "WED"] });
    const logs = [
      { date: "2026-11-09", status: "DONE" as const },
      { date: "2026-11-10", status: "DONE" as const },
    ];

    expect(computeAdherence(routine, logs, week, today).rate).toBe(67);
  });
});
