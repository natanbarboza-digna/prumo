import { describe, expect, it } from "vitest";

import {
  formatTimeOfDay,
  isValidTimeOfDay,
  minutesNowInAppTimeZone,
  parseTimeOfDay,
} from "@/lib/time-of-day";

describe("time of day (plan 031)", () => {
  it("turns HH:MM into minutes since midnight and back", () => {
    expect(parseTimeOfDay("00:00")).toBe(0);
    expect(parseTimeOfDay("08:15")).toBe(495);
    expect(parseTimeOfDay("23:59")).toBe(1439);
    expect(formatTimeOfDay(495)).toBe("08:15");
    expect(formatTimeOfDay(0)).toBe("00:00");
    // The end of the day, for a grid that goes up to midnight.
    expect(formatTimeOfDay(1440)).toBe("24:00");
  });

  it("only accepts real times written as HH:MM", () => {
    expect(isValidTimeOfDay("08:15")).toBe(true);
    for (const value of ["8:15", "24:00", "12:60", "ab:cd", "", "08:15:00"]) {
      expect(isValidTimeOfDay(value), value).toBe(false);
    }
    expect(() => parseTimeOfDay("25:00")).toThrow();
  });

  it("reads the current time in Fortaleza, not in UTC", () => {
    // 11:40 UTC is 08:40 in Fortaleza (UTC−3).
    expect(minutesNowInAppTimeZone(new Date("2026-11-23T11:40:00Z"))).toBe(8 * 60 + 40);
    // 01:10 UTC on the 24th is still 22:10 of the 23rd there.
    expect(minutesNowInAppTimeZone(new Date("2026-11-24T01:10:00Z"))).toBe(22 * 60 + 10);
  });
});
