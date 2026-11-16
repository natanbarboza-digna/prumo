import { describe, expect, it } from "vitest";

import {
  cycleTimeText,
  daysAgoText,
  dueText,
  recentAdherenceText,
} from "@/modules/dashboard/labels";

const today = "2026-11-16";

describe("dueText", () => {
  it("says when the item is due", () => {
    expect(dueText(today, today)).toBe("Vence hoje");
    expect(dueText("2026-11-20", today)).toBe("Vence em 20/11/2026");
    expect(dueText("2026-11-10", today)).toBe("Venceu em 10/11/2026");
  });
});

describe("cycleTimeText", () => {
  it("counts the days left, in the singular and plural", () => {
    expect(cycleTimeText("2026-11-17", today)).toBe("Falta 1 dia");
    expect(cycleTimeText("2026-11-30", today)).toBe("Faltam 14 dias");
  });

  it("says when the cycle ends today or has already ended", () => {
    expect(cycleTimeText(today, today)).toBe("Termina hoje");
    expect(cycleTimeText("2026-11-15", today)).toBe("Terminou há 1 dia");
    expect(cycleTimeText("2026-11-06", today)).toBe("Terminou há 10 dias");
  });
});

describe("daysAgoText", () => {
  it("says how long ago a date was", () => {
    expect(daysAgoText(today, today)).toBe("hoje");
    expect(daysAgoText("2026-11-15", today)).toBe("ontem");
    expect(daysAgoText("2026-11-02", today)).toBe("há 14 dias");
  });
});

describe("recentAdherenceText", () => {
  it("shows the rate over the last 30 days", () => {
    expect(recentAdherenceText({ scheduled: 20, done: 16, skipped: 2, missed: 2, rate: 80 })).toBe(
      "Adesão em 30 dias: 80%",
    );
  });

  it("says so when there is no day to count yet", () => {
    expect(recentAdherenceText({ scheduled: 0, done: 0, skipped: 0, missed: 0, rate: 0 })).toBe(
      "Adesão em 30 dias: nenhum dia para contar ainda",
    );
  });
});
