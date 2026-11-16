import { describe, expect, it } from "vitest";

import {
  formatDateForDisplay,
  formatDateOnly,
  isValidDateOnly,
  parseDateOnly,
  todayInAppTimeZone,
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
