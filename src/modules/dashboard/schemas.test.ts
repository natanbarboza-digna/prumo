import { describe, expect, it } from "vitest";

import { deadlineKindFilterSchema, deadlinePeriodSchema } from "@/modules/dashboard/schemas";

describe("deadline filters (plan 028)", () => {
  it("reads the period from the URL, falling back to 30 days", () => {
    expect(deadlinePeriodSchema.parse("7")).toBe("7");
    expect(deadlinePeriodSchema.parse("90")).toBe("90");
    expect(deadlinePeriodSchema.parse("all")).toBe("all");
    expect(deadlinePeriodSchema.parse(undefined)).toBe("30");
    expect(deadlinePeriodSchema.parse("15")).toBe("30");
  });

  it("reads the kind from the URL, falling back to all of them", () => {
    expect(deadlineKindFilterSchema.parse("STEP")).toBe("STEP");
    expect(deadlineKindFilterSchema.parse("GOAL")).toBe("GOAL");
    expect(deadlineKindFilterSchema.parse(undefined)).toBe("ALL");
    expect(deadlineKindFilterSchema.parse(["STEP", "GOAL"])).toBe("ALL");
  });
});
