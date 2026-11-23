import { describe, expect, it } from "vitest";

import {
  type AnalyticsDay,
  type AnalyticsEntry,
  computeAnalytics,
  normalizeActivity,
} from "@/modules/time/analytics";

const hm = (h: number, m = 0) => h * 60 + m;
const CHAMADOS = { id: "c1", name: "Chamados" };
const PROJETO = { id: "c2", name: "Projeto" };
const DIGNA = { id: "p1", name: "Digna" };
const MAXIMA = { id: "p2", name: "Máxima" };

function work(
  start: number,
  minutes: number,
  description: string,
  category = PROJETO,
  project: { id: string; name: string } | null = null,
): AnalyticsEntry {
  return { startMinute: start, minutes, kind: "WORK", description, category, project };
}
const pause = (start: number, minutes: number): AnalyticsEntry => ({
  startMinute: start,
  minutes,
  kind: "BREAK",
  description: null,
  category: null,
  project: null,
});

function day(date: string, start: number, end: number, entries: AnalyticsEntry[]): AnalyticsDay {
  return { date, startMinute: start, endMinute: end, slotMinutes: 30, entries };
}

const noFilters = { categoryId: null, projectId: null };
const clock = { today: "2026-11-23", nowMinute: hm(12) };

// Monday: 08:00–12:00 (4h), 1h of break, 2h30 of work, 30min unregistered.
const monday = day("2026-11-16", hm(8), hm(12), [
  work(hm(8), 30, "E-mail e chamados", CHAMADOS),
  work(hm(8, 30), 60, "Configuração digna relatórios", PROJETO, DIGNA),
  pause(hm(9, 30), 60),
  work(hm(10, 30), 60, "configuração Digna relatórios ", PROJETO, DIGNA),
]);
// Tuesday: 09:00–11:00 (2h), all work.
const tuesday = day("2026-11-17", hm(9), hm(11), [
  work(hm(9), 60, "Usuário da Máxima", CHAMADOS, MAXIMA),
  work(hm(10), 60, "Configuração Digna relatórios", PROJETO, DIGNA),
]);

describe("normalizeActivity (plan 032)", () => {
  it("ignores case, accents and surrounding or repeated spaces", () => {
    expect(normalizeActivity("  Configuração   Digna ")).toBe("configuracao digna");
    expect(normalizeActivity("CONFIGURACAO digna")).toBe("configuracao digna");
  });
});

describe("computeAnalytics", () => {
  it("adds the days' totals, the average and the longest day", () => {
    const { totals } = computeAnalytics([monday, tuesday], noFilters, clock);

    expect(totals).toEqual({
      days: 2,
      presence: 360,
      worked: 300,
      breaks: 60,
      unregistered: 30,
      averageWorked: 150,
      // Monday: 4h of presence minus 1h of break = 3h; Tuesday: 2h.
      longestDay: { date: "2026-11-16", worked: 180 },
      filtered: null,
    });
  });

  it("sums the work by category and by project, with percentages adding up to 100", () => {
    const { byCategory, byProject } = computeAnalytics([monday, tuesday], noFilters, clock);

    expect(byCategory).toEqual([
      { id: "c2", name: "Projeto", minutes: 180, percent: 67 },
      { id: "c1", name: "Chamados", minutes: 90, percent: 33 },
    ]);
    expect(byProject).toEqual([
      { id: "p1", name: "Digna", minutes: 180, percent: 67 },
      { id: "p2", name: "Máxima", minutes: 60, percent: 22 },
      { id: null, name: null, minutes: 30, percent: 11 },
    ]);
  });

  it("groups the activities by their normalized text, with blocks and the main category", () => {
    const { activities } = computeAnalytics([monday, tuesday], noFilters, clock);

    expect(activities[0]).toEqual({
      text: "Configuração Digna relatórios",
      minutes: 180,
      blocks: 3,
      category: "Projeto",
    });
    expect(activities.map((activity) => activity.minutes)).toEqual([180, 60, 30]);
  });

  it("keeps the 10 activities that took the most time", () => {
    const many = day(
      "2026-11-18",
      hm(8),
      hm(14),
      Array.from({ length: 12 }, (_, index) => work(hm(8) + index * 30, 30, `Tarefa ${index}`)),
    );

    expect(computeAnalytics([many], noFilters, clock).activities).toHaveLength(10);
  });

  it("counts topic switches per day, ignoring breaks and repeated activities", () => {
    const { perDay, averageSwitches } = computeAnalytics([monday, tuesday], noFilters, clock);

    // Monday: e-mail → digna (1); digna, break, digna (same: 0). Tuesday: máxima → digna (1).
    expect(perDay).toEqual([
      { date: "2026-11-16", worked: 180, breaks: 60, unregistered: 30, switches: 1 },
      { date: "2026-11-17", worked: 120, breaks: 0, unregistered: 0, switches: 1 },
    ]);
    expect(averageSwitches).toBe(1);
  });

  it("counts a switch when only the project changes", () => {
    const sameText = day("2026-11-18", hm(8), hm(9), [
      work(hm(8), 30, "Atendimento", CHAMADOS, DIGNA),
      work(hm(8, 30), 30, "Atendimento", CHAMADOS, MAXIMA),
    ]);

    expect(computeAnalytics([sameText], noFilters, clock).perDay[0]?.switches).toBe(1);
  });

  it("filters the work by category or project, not the presence or breaks", () => {
    const byDigna = computeAnalytics(
      [monday, tuesday],
      { categoryId: null, projectId: "p1" },
      clock,
    );

    expect(byDigna.totals).toMatchObject({ presence: 360, breaks: 60, filtered: 180 });
    expect(byDigna.byCategory).toEqual([{ id: "c2", name: "Projeto", minutes: 180, percent: 100 }]);
    expect(byDigna.activities).toHaveLength(1);

    const withoutProject = computeAnalytics(
      [monday],
      { categoryId: null, projectId: "none" },
      clock,
    );
    expect(withoutProject.totals.filtered).toBe(30);

    const chamados = computeAnalytics(
      [monday, tuesday],
      { categoryId: "c1", projectId: null },
      clock,
    );
    expect(chamados.byProject.map((project) => project.name)).toEqual(["Máxima", null]);
  });

  it("is empty without days", () => {
    expect(computeAnalytics([], noFilters, clock)).toMatchObject({
      totals: { days: 0, presence: 0, worked: 0, averageWorked: 0, longestDay: null },
      byCategory: [],
      byProject: [],
      activities: [],
      perDay: [],
      averageSwitches: 0,
    });
  });

  it("counts today's open day up to now", () => {
    const open = { ...day(clock.today, hm(9), hm(9), []), endMinute: null };

    expect(computeAnalytics([open], noFilters, clock).totals.presence).toBe(180);
  });
});
