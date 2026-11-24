import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { listCategories } from "@/modules/categories/service";
import { getDashboard } from "@/modules/dashboard/service";
import { createGoal } from "@/modules/goals/service";
import { getActionDetail, listCycles } from "@/modules/pdi/service";
import { DEFAULT_CATEGORIES, ensureDefaultCategories } from "@/modules/categories/defaults";

import { DemoDataExistsError, assertCanSeed, resetAllData, seedDemo } from "./seed-demo";

// Seeding the whole demo through the services creates hundreds of rows one by
// one: 2 to 5 s per test, above Vitest's default 5 s on a slow or just-started
// database. Every test that seeds gets this limit instead.
const SEED_TIMEOUT = 20_000;

// 2026-11-16 is a Monday; 2026-11-22 is a Sunday.
const monday = "2026-11-16";
const sunday = "2026-11-22";

describe("seedDemo", { timeout: SEED_TIMEOUT }, () => {
  it("creates the demo data and reports how much", async () => {
    const summary = await seedDemo(monday);

    expect(summary).toEqual({
      goals: 4,
      tracks: 3,
      steps: 12,
      routines: 5,
      logs: expect.any(Number),
      cycles: 3,
      areas: 3,
      actions: 7,
      checkIns: 3,
      books: 5,
    });
    expect(summary.logs).toBeGreaterThan(50);
    await expect(db.goal.count()).resolves.toBe(4);
    await expect(db.trackStep.count()).resolves.toBe(12);
    await expect(db.routine.count()).resolves.toBe(5);
    await expect(db.routineLog.count()).resolves.toBe(summary.logs);
    await expect(db.pdiAction.count()).resolves.toBe(7);
    await expect(db.pdiCheckIn.count()).resolves.toBe(3);
    await expect(
      db.book.groupBy({ by: ["status"], _count: true, orderBy: { status: "asc" } }),
    ).resolves.toEqual([
      { status: "TO_READ", _count: 2 },
      { status: "READING", _count: 1 },
      { status: "READ", _count: 1 },
      { status: "ABANDONED", _count: 1 },
    ]);
    await expect(db.bookLog.count()).resolves.toBe(7);
    await expect(db.bookQuote.count()).resolves.toBe(1);
    await expect(db.readingGoal.count()).resolves.toBe(1);
    await expect(db.book.count({ where: { rating: { not: null } } })).resolves.toBe(1);
  });

  it("fills every dashboard card", async () => {
    await seedDemo(monday);

    const dashboard = await getDashboard(monday);

    expect(dashboard.firstUse).toBe(false);
    expect(dashboard.today.items.length).toBeGreaterThan(0);
    expect(dashboard.today.adherence.scheduled).toBeGreaterThan(0);
    expect(dashboard.deadlines.overdue.items.map((item) => [item.kind, item.date])).toEqual([
      ["STEP", addDays(monday, -3)],
      ["ACTION", addDays(monday, -2)],
    ]);
    expect(dashboard.deadlines.upcoming.items.map((item) => item.kind).sort()).toEqual([
      "ACTION",
      "GOAL",
      "STEP",
      "STEP",
    ]);
    expect(dashboard.pdi).toMatchObject({
      kind: "ACTIVE",
      cycle: { title: "PDI 2026/1" },
      overdueActions: 1,
      lastCheckIn: addDays(monday, -15),
    });
    expect(dashboard.pdi.kind === "ACTIVE" && dashboard.pdi.routineAdherence?.done).toBeGreaterThan(
      0,
    );
    expect(dashboard.goals.total).toBe(2);
    expect(dashboard.tracks.items.map((track) => track.title).sort()).toEqual([
      "Inglês para reuniões",
      "Next.js App Router",
    ]);
  });

  it("has a weekly-goal routine (plan 017)", async () => {
    await seedDemo(monday);

    const exercise = await db.routine.findFirstOrThrow({ where: { title: "Exercício" } });
    expect(exercise.timesPerWeek).toBe(3);
    await expect(
      db.routineLog.count({ where: { routineId: exercise.id, status: "SKIPPED" } }),
    ).resolves.toBe(0);
  });

  it("links a routine to a PDI action, with logs as evidence", async () => {
    await seedDemo(monday);
    const action = await db.pdiAction.findFirstOrThrow({
      where: { title: "Praticar apresentações em inglês" },
    });

    const detail = await getActionDetail(action.id, monday);

    expect(detail.routines.map(({ routine }) => routine.title)).toEqual(["Ensaiar apresentação"]);
    expect(detail.routines[0]?.adherence.done).toBeGreaterThan(0);
    expect(detail.logs.length).toBeGreaterThan(0);
  });

  it("has one closed, one active and one planned cycle", async () => {
    await seedDemo(monday);

    const cycles = await listCycles();

    expect(cycles.map((cycle) => [cycle.title, cycle.status])).toEqual([
      ["PDI 2026/1", "ACTIVE"],
      ["PDI 2026/2", "PLANNED"],
      ["PDI 2025/2", "CLOSED"],
    ]);
  });

  it("works whatever the weekday of today", async () => {
    await seedDemo(sunday);

    const dashboard = await getDashboard(sunday);

    expect(dashboard.pdi).toMatchObject({ kind: "ACTIVE", overdueActions: 1 });
    expect(dashboard.deadlines.overdue.items).toHaveLength(2);
  });
});

describe("assertCanSeed", () => {
  it("accepts a database with only the default categories", async () => {
    await ensureDefaultCategories(db);

    await expect(assertCanSeed()).resolves.toBeUndefined();
  });

  it("refuses a database that already has data", async () => {
    await createGoal({ title: "Real", description: null, status: "NOT_STARTED", targetDate: null });

    await expect(assertCanSeed()).rejects.toThrow(DemoDataExistsError);
  });
});

describe("resetAllData", () => {
  // Seeds the demo twice (about 90 logs each), so it needs more than the 5 s default.
  it(
    "deletes everything but keeps the default categories, so the demo can run again",
    async () => {
      await seedDemo(monday);

      await resetAllData();

      await expect(db.goal.count()).resolves.toBe(0);
      await expect(db.routineLog.count()).resolves.toBe(0);
      await expect(db.pdiCycle.count()).resolves.toBe(0);
      const categories = await listCategories();
      expect(categories.map((category) => category.name).sort()).toEqual(
        DEFAULT_CATEGORIES.map((category) => category.name).sort(),
      );
      await expect(assertCanSeed()).resolves.toBeUndefined();
      await expect(seedDemo(monday)).resolves.toMatchObject({ goals: 4 });
    },
    SEED_TIMEOUT,
  );
});
