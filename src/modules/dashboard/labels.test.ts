import { describe, expect, it } from "vitest";

import {
  cycleTimeText,
  daysAgoText,
  deadlinesEmptyText,
  dueText,
  kpiItems,
  recentAdherenceText,
  weekTitle,
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

describe("deadline page texts (plan 028)", () => {
  const thursday = "2026-11-19";

  it("names this week and the next one, and dates the others", () => {
    expect(weekTitle("2026-11-16", "2026-11-22", thursday)).toBe("Esta semana");
    expect(weekTitle("2026-11-23", "2026-11-29", thursday)).toBe("Próxima semana");
    expect(weekTitle("2026-11-30", "2026-12-06", thursday)).toBe("Semana de 30/11 a 06/12");
  });

  it("says nothing is due in the chosen period", () => {
    expect(deadlinesEmptyText("30")).toBe("Nenhum prazo atrasado nem nos próximos 30 dias.");
    expect(deadlinesEmptyText("7")).toBe("Nenhum prazo atrasado nem nos próximos 7 dias.");
    expect(deadlinesEmptyText("all")).toBe("Nenhum prazo em aberto.");
  });
});

describe("kpiItems (plan 034)", () => {
  const kpis = {
    routinesToday: { done: 2, total: 3 },
    adherence: { scheduled: 20, rate: 78 },
    workedThisWeek: 1590,
    overdue: 2,
    pdi: { cycleId: "c1", percent: 40 },
  };

  it("gives the five numbers, each with its label and link", () => {
    expect(kpiItems(kpis)).toEqual([
      { label: "Rotinas hoje", value: "2 de 3", href: "/today", alert: false },
      { label: "Adesão em 30 dias", value: "78%", href: "/routines", alert: false },
      { label: "Trabalhado na semana", value: "26h30", href: "/time/analytics", alert: false },
      { label: "Prazos atrasados", value: "2", href: "/deadlines", alert: true },
      { label: "PDI concluído", value: "40%", href: "/pdi/c1", alert: false },
    ]);
  });

  it("uses a dash when there is nothing to count, and no alert without overdue items", () => {
    const values = kpiItems({
      routinesToday: { done: 0, total: 0 },
      adherence: { scheduled: 0, rate: 0 },
      workedThisWeek: 0,
      overdue: 0,
      pdi: null,
    });

    expect(values.map((item) => item.value)).toEqual(["—", "—", "0h", "0", "—"]);
    expect(values.some((item) => item.alert)).toBe(false);
    expect(values[4]!.href).toBe("/pdi");
  });
});
