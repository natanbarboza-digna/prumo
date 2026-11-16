import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  eachDay,
  formatDateForDisplay,
  formatLongDate,
  formatDateOnly,
  isValidDateOnly,
  parseDateOnly,
  todayInAppTimeZone,
  weekdayOf,
} from "@/lib/dates";

describe("todayInAppTimeZone", () => {
  it("uses the Fortaleza day late at night, when UTC is already on the next day", () => {
    // 23:30 in Fortaleza (UTC-3) is 02:30 UTC on the following day.
    expect(todayInAppTimeZone(new Date("2026-11-17T02:30:00Z"))).toBe("2026-11-16");
  });

  it("uses the Fortaleza day just after local midnight", () => {
    expect(todayInAppTimeZone(new Date("2026-11-17T03:30:00Z"))).toBe("2026-11-17");
  });
});

describe("isValidDateOnly", () => {
  it.each(["2026-11-16", "2024-02-29"])("accepts %s", (value) => {
    expect(isValidDateOnly(value)).toBe(true);
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "16/11/2026", "2026-1-5", ""])(
    "rejects %j",
    (value) => {
      expect(isValidDateOnly(value)).toBe(false);
    },
  );
});

describe("parseDateOnly / formatDateOnly", () => {
  it("round-trips without shifting the day", () => {
    const date = parseDateOnly("2026-01-01");

    expect(date.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(formatDateOnly(date)).toBe("2026-01-01");
  });

  it("throws on an invalid date", () => {
    expect(() => parseDateOnly("2026-02-30")).toThrow();
  });
});

describe("formatDateForDisplay", () => {
  it("formats as dd/mm/aaaa", () => {
    expect(formatDateForDisplay("2026-03-05")).toBe("05/03/2026");
  });
});

describe("weekdayOf", () => {
  it.each([
    ["2026-11-16", "MON"],
    ["2026-11-15", "SUN"],
    ["2026-11-21", "SAT"],
    ["2025-12-31", "WED"],
    ["2026-01-01", "THU"],
  ])("%s is %s", (date, expected) => {
    expect(weekdayOf(date)).toBe(expected);
  });
});

describe("addDays", () => {
  it.each([
    ["2026-11-16", 1, "2026-11-17"],
    ["2026-11-30", 1, "2026-12-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2026-11-16", -29, "2026-10-18"],
    ["2026-11-16", 0, "2026-11-16"],
  ])("%s %+i days is %s", (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});

describe("eachDay", () => {
  it("lists every day, both ends included", () => {
    expect(eachDay("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("has a single day when both ends are equal", () => {
    expect(eachDay("2026-11-16", "2026-11-16")).toEqual(["2026-11-16"]);
  });

  it("is empty when from is after to", () => {
    expect(eachDay("2026-11-17", "2026-11-16")).toEqual([]);
  });
});

describe("formatLongDate", () => {
  it("writes the weekday and the date in pt-BR", () => {
    expect(formatLongDate("2026-11-16")).toBe("segunda-feira, 16 de novembro");
  });
});

describe("daysBetween", () => {
  it("counts the days from one date to another", () => {
    expect(daysBetween("2026-11-16", "2026-11-16")).toBe(0);
    expect(daysBetween("2026-11-16", "2026-11-30")).toBe(14);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("is negative when the second date comes first", () => {
    expect(daysBetween("2026-11-16", "2026-11-02")).toBe(-14);
  });
});
