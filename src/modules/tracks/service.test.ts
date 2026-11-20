import { describe, expect, it } from "vitest";

import {
  copyTitle,
  deriveTrackStatus,
  isStepOverdue,
  progressPercent,
} from "@/modules/tracks/service";

const today = "2026-11-16";

describe("isStepOverdue", () => {
  it.each(["NOT_STARTED", "IN_PROGRESS"] as const)(
    "is overdue when the due date has passed and the status is %s",
    (status) => {
      expect(isStepOverdue({ status, dueDate: "2026-11-15" }, today)).toBe(true);
    },
  );

  it("is not overdue once done", () => {
    expect(isStepOverdue({ status: "DONE", dueDate: "2026-11-15" }, today)).toBe(false);
  });

  it("is not overdue on the due date itself", () => {
    expect(isStepOverdue({ status: "NOT_STARTED", dueDate: today }, today)).toBe(false);
  });

  it("is not overdue without a due date", () => {
    expect(isStepOverdue({ status: "NOT_STARTED", dueDate: null }, today)).toBe(false);
  });
});

describe("deriveTrackStatus", () => {
  it("is NOT_STARTED without steps", () => {
    expect(deriveTrackStatus({ total: 0, done: 0, inProgress: 0 })).toBe("NOT_STARTED");
  });

  it("is NOT_STARTED when no step has started", () => {
    expect(deriveTrackStatus({ total: 3, done: 0, inProgress: 0 })).toBe("NOT_STARTED");
  });

  it("is IN_PROGRESS when a step is in progress", () => {
    expect(deriveTrackStatus({ total: 3, done: 0, inProgress: 1 })).toBe("IN_PROGRESS");
  });

  it("is IN_PROGRESS when only some steps are done", () => {
    expect(deriveTrackStatus({ total: 3, done: 2, inProgress: 0 })).toBe("IN_PROGRESS");
  });

  it("is DONE when every step is done", () => {
    expect(deriveTrackStatus({ total: 3, done: 3, inProgress: 0 })).toBe("DONE");
  });
});

describe("progressPercent", () => {
  it.each([
    [0, 0, 0],
    [1, 3, 33],
    [2, 3, 67],
    [3, 3, 100],
  ])("%i of %i is %i%%", (done, total, expected) => {
    expect(progressPercent(done, total)).toBe(expected);
  });
});

describe("copyTitle (plan 026)", () => {
  it("prefixes the title with Cópia de", () => {
    expect(copyTitle("Inglês")).toBe("Cópia de Inglês");
  });

  it("cuts the copy to fit the 120-character title limit", () => {
    const copy = copyTitle("a".repeat(120));

    expect(copy).toHaveLength(120);
    expect(copy.startsWith("Cópia de a")).toBe(true);
  });
});
