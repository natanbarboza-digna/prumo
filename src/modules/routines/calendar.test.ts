import { describe, expect, it } from "vitest";

import type { Weekday } from "@/generated/prisma/enums";
import {
  calendarDayName,
  dayStateLabels,
  monthSummaryText,
  monthTitle,
} from "@/modules/routines/labels";
import {
  type CalendarDay,
  type Schedule,
  addMonths,
  monthCalendar,
  monthRange,
  parseMonth,
} from "@/modules/routines/rules";

// 2026-11-16 is a Monday; November 2026 starts on a Sunday.
const today = "2026-11-16";
const everyDay: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return { weekdays: everyDay, startDate: "2026-11-01", endDate: null, ...overrides };
}

function dayOf(days: CalendarDay[][], date: string): CalendarDay | undefined {
  return days.flat().find((day) => day.date === date);
}

describe("monthCalendar", () => {
  it("fills whole Monday-to-Sunday weeks around the month", () => {
    const { weeks } = monthCalendar(schedule(), [], "2026-11", today);

    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    // Six October days come before Sunday, November 1st.
    expect(weeks[0]?.map((day) => day.date)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(weeks[0]?.slice(0, 6).every((day) => day.state === "OUTSIDE")).toBe(true);
    expect(weeks.at(-1)?.at(-1)?.date).toBe("2026-12-06");
  });

  it("gives each day of the month its state", () => {
    const routine = schedule({ weekdays: ["MON", "WED", "FRI", "SUN"], startDate: "2026-11-02" });
    const logs = [
      { date: "2026-11-02", status: "DONE" as const },
      { date: "2026-11-04", status: "SKIPPED" as const },
      // Tuesday is not scheduled: its log does not change anything.
      { date: "2026-11-03", status: "DONE" as const },
    ];

    const { weeks } = monthCalendar(routine, logs, "2026-11", today);

    expect(dayOf(weeks, "2026-11-01")?.state).toBe("NOT_SCHEDULED"); // before the start
    expect(dayOf(weeks, "2026-11-02")?.state).toBe("DONE");
    expect(dayOf(weeks, "2026-11-03")?.state).toBe("NOT_SCHEDULED");
    expect(dayOf(weeks, "2026-11-04")?.state).toBe("SKIPPED");
    expect(dayOf(weeks, "2026-11-06")?.state).toBe("MISSED");
    expect(dayOf(weeks, "2026-11-16")).toMatchObject({ state: "PENDING", isToday: true });
    expect(dayOf(weeks, "2026-11-18")?.state).toBe("FUTURE");
  });

  it("shows today as done once it is logged, and nothing after the end date", () => {
    const routine = schedule({ endDate: "2026-11-16" });

    const { weeks } = monthCalendar(
      routine,
      [{ date: today, status: "DONE" }],
      "2026-11",
      "2026-11-20",
    );

    expect(dayOf(weeks, today)?.state).toBe("DONE");
    expect(dayOf(weeks, "2026-11-17")?.state).toBe("NOT_SCHEDULED");
  });

  it("sums the month's adherence up to today", () => {
    const { adherence } = monthCalendar(
      schedule(),
      [
        { date: "2026-11-01", status: "DONE" },
        { date: "2026-11-02", status: "SKIPPED" },
      ],
      "2026-11",
      today,
    );

    // November 1st to 15th: today has no log yet, so it does not count.
    expect(adherence).toMatchObject({ scheduled: 15, done: 1, skipped: 1, missed: 13 });
  });
});

describe("monthRange", () => {
  it("goes from the start month to the current month", () => {
    expect(monthRange(schedule({ startDate: "2026-08-20" }), today)).toEqual({
      from: "2026-08",
      to: "2026-11",
    });
  });

  it("stops at the end month of a routine that already ended", () => {
    expect(monthRange(schedule({ startDate: "2026-03-01", endDate: "2026-06-10" }), today)).toEqual(
      { from: "2026-03", to: "2026-06" },
    );
  });

  it("is just the start month for a routine that starts later", () => {
    expect(monthRange(schedule({ startDate: "2027-02-01" }), today)).toEqual({
      from: "2027-02",
      to: "2027-02",
    });
  });
});

describe("parseMonth", () => {
  const range = { from: "2026-08", to: "2026-11" };

  it("accepts a month inside the range", () => {
    expect(parseMonth("2026-10", range)).toBe("2026-10");
  });

  it("falls back to the last month for anything else", () => {
    for (const value of ["2026-13", "26-10", "outubro", "2026-07", "2026-12", undefined]) {
      expect(parseMonth(value, range), String(value)).toBe("2026-11");
    }
  });
});

describe("addMonths", () => {
  it("moves across years", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
});

describe("calendar labels", () => {
  it("names the month in pt-BR", () => {
    expect(monthTitle("2026-11")).toBe("Novembro de 2026");
  });

  it("gives each day a full accessible name", () => {
    expect(calendarDayName("2026-11-02", "DONE")).toBe("segunda-feira, 2 de novembro: feita");
    expect(dayStateLabels.MISSED).toBe("sem registro");
  });

  it("summarizes the month, with singular and plural", () => {
    expect(
      monthSummaryText("2026-10", { scheduled: 23, done: 18, skipped: 2, missed: 3, rate: 78 }),
    ).toBe("Em outubro: 18 feitas, 2 puladas e 3 sem registro, 78% de adesão.");
    expect(
      monthSummaryText("2026-10", { scheduled: 3, done: 1, skipped: 1, missed: 1, rate: 33 }),
    ).toBe("Em outubro: 1 feita, 1 pulada e 1 sem registro, 33% de adesão.");
    expect(
      monthSummaryText("2026-12", { scheduled: 0, done: 0, skipped: 0, missed: 0, rate: 0 }),
    ).toBe("Em dezembro: nenhum dia para contar ainda.");
  });
});
