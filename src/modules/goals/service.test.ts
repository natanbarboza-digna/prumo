import { describe, expect, it } from "vitest";

import { isGoalOverdue } from "@/modules/goals/service";

const today = "2026-11-16";

describe("isGoalOverdue", () => {
  it.each(["NOT_STARTED", "IN_PROGRESS"] as const)(
    "is overdue when the target date has passed and the status is %s",
    (status) => {
      expect(isGoalOverdue({ status, targetDate: "2026-11-15" }, today)).toBe(true);
    },
  );

  it.each(["DONE", "ARCHIVED"] as const)("is not overdue when the status is %s", (status) => {
    expect(isGoalOverdue({ status, targetDate: "2026-11-15" }, today)).toBe(false);
  });

  it("is not overdue on the target date itself", () => {
    expect(isGoalOverdue({ status: "IN_PROGRESS", targetDate: today }, today)).toBe(false);
  });

  it("is not overdue without a target date", () => {
    expect(isGoalOverdue({ status: "IN_PROGRESS", targetDate: null }, today)).toBe(false);
  });
});
