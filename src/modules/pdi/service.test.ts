import { describe, expect, it } from "vitest";

import { actionProgress, isActionOverdue } from "@/modules/pdi/service";

const today = "2026-11-16";

describe("isActionOverdue", () => {
  it.each(["NOT_STARTED", "IN_PROGRESS"] as const)(
    "is overdue past the due date when %s",
    (status) => {
      expect(isActionOverdue({ status, dueDate: "2026-11-15" }, today)).toBe(true);
    },
  );

  it.each(["DONE", "CANCELLED"] as const)("is never overdue when %s", (status) => {
    expect(isActionOverdue({ status, dueDate: "2026-11-15" }, today)).toBe(false);
  });

  it("is not overdue on the due date or without one", () => {
    expect(isActionOverdue({ status: "NOT_STARTED", dueDate: today }, today)).toBe(false);
    expect(isActionOverdue({ status: "NOT_STARTED", dueDate: null }, today)).toBe(false);
  });
});

describe("actionProgress", () => {
  it("counts done actions and leaves cancelled ones out", () => {
    expect(actionProgress(["DONE", "IN_PROGRESS", "CANCELLED", "NOT_STARTED", "DONE"])).toEqual({
      done: 2,
      total: 4,
    });
  });

  it("is 0 of 0 without actions", () => {
    expect(actionProgress([])).toEqual({ done: 0, total: 0 });
  });
});
