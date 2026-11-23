import { describe, expect, it } from "vitest";

import { analyticsQuery, periodRange } from "@/modules/time/period";

// 2026-11-19 is a Thursday; its week goes from Monday 16 to Sunday 22.
const thursday = "2026-11-19";

describe("periodRange (plan 032)", () => {
  it("gives this week and last week, Monday to Sunday", () => {
    expect(periodRange("thisWeek", thursday)).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(periodRange("lastWeek", thursday)).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    // On a Sunday the week is still the one that started on Monday.
    expect(periodRange("thisWeek", "2026-11-22")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
  });

  it("gives this month and last month, across the year", () => {
    expect(periodRange("thisMonth", thursday)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodRange("lastMonth", thursday)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("lastMonth", "2027-01-10")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
    expect(periodRange("thisMonth", "2028-02-10")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });

  it("gives the last 30 days, today included", () => {
    expect(periodRange("last30", thursday)).toEqual({ from: "2026-10-21", to: thursday });
  });
});

describe("analyticsQuery", () => {
  it("reads the period and the filters from the URL", () => {
    expect(
      analyticsQuery(
        {
          periodo: "lastMonth",
          categoria: "0190a3e4-0000-7000-8000-000000000000",
          projeto: "none",
        },
        thursday,
      ),
    ).toEqual({
      period: "lastMonth",
      from: "2026-10-01",
      to: "2026-10-31",
      categoryId: "0190a3e4-0000-7000-8000-000000000000",
      projectId: "none",
    });
  });

  it("accepts a custom range and falls back to this week when it is invalid", () => {
    expect(
      analyticsQuery({ periodo: "custom", de: "2026-11-01", ate: "2026-11-10" }, thursday),
    ).toMatchObject({ period: "custom", from: "2026-11-01", to: "2026-11-10" });
    for (const query of [
      { periodo: "custom", de: "2026-11-10", ate: "2026-11-01" },
      { periodo: "custom", de: "ontem" },
      { periodo: "qualquer" },
      {},
    ]) {
      expect(analyticsQuery(query, thursday)).toMatchObject({
        period: "thisWeek",
        from: "2026-11-16",
        to: "2026-11-22",
        categoryId: null,
        projectId: null,
      });
    }
  });

  it("ignores filters that are not ids", () => {
    expect(analyticsQuery({ categoria: "abc", projeto: ["x", "y"] }, thursday)).toMatchObject({
      categoryId: null,
      projectId: null,
    });
  });
});
