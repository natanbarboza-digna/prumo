import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  CategoryNotFoundError,
  createCategory,
  setCategoryArchived,
} from "@/modules/categories/service";
import { GoalNotFoundError, createGoal, deleteGoal } from "@/modules/goals/service";
import type { ActionInput, CycleInput } from "@/modules/pdi/schemas";
import {
  ActiveCycleExistsError,
  AreaNotInCycleError,
  CategoryArchivedError,
  CycleClosedError,
  PdiActionNotFoundError,
  RoutineOutcomeRequiredError,
  PdiAreaNotFoundError,
  PdiCheckInNotFoundError,
  PdiCycleNotFoundError,
  closeCycle,
  createAction,
  createArea,
  createCheckIn,
  createCycle,
  deleteAction,
  deleteArea,
  deleteCheckIn,
  deleteCycle,
  getAction,
  getActionDetail,
  getCycle,
  getLastCheckInDate,
  getRoutineEvidenceByAction,
  listActionsForGoal,
  listCycles,
  listOpenActionsWithDueDate,
  listRoutinesInEffect,
  reopenCycle,
  updateAction,
  updateArea,
  updateCheckIn,
  updateCycle,
} from "@/modules/pdi/service";
import type { RoutineInput } from "@/modules/routines/schemas";
import { createRoutine, getRoutine, logRoutine } from "@/modules/routines/service";
import { pdiActionFixture } from "@/test/pdi-fixtures";

const MISSING_ID = "0190a3e4-0000-7000-8000-000000000000";

function cycleInput(overrides: Partial<CycleInput> = {}): CycleInput {
  return {
    title: "PDI 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "PLANNED",
    managerName: null,
    careerObjective: null,
    selfAssessment: null,
    managerFeedback: null,
    finalRating: null,
    ...overrides,
  };
}

const areaInput = (name = "Comunicação") => ({ name, description: null, expectedOutcome: null });

function actionInput(
  areaId: string,
  categoryId: string,
  overrides: Partial<ActionInput> = {},
): ActionInput {
  return {
    areaId,
    categoryId,
    title: "Ação",
    description: null,
    expectedResult: null,
    dueDate: null,
    status: "NOT_STARTED",
    evidence: null,
    managerComment: null,
    goalId: null,
    ...overrides,
  };
}

const checkInInput = (date = "2026-03-01", summary = "Alinhamento") => ({
  date,
  summary,
  nextSteps: null,
  managerNotes: null,
});

async function category(name = "Curso") {
  return createCategory({ name, allowsRoutine: false });
}

/** A cycle with one area and a category, ready for actions. */
async function setup(overrides: Partial<CycleInput> = {}) {
  const cycle = await createCycle(cycleInput(overrides));
  const area = await createArea(cycle.id, areaInput());
  const cat = await category();
  return { cycle, area, category: cat };
}

describe("cycles", () => {
  it("creates a cycle with every field", async () => {
    const cycle = await createCycle(
      cycleInput({
        status: "ACTIVE",
        managerName: "Ana",
        careerObjective: "Tech lead",
        finalRating: "Atende",
      }),
    );

    expect(cycle).toMatchObject({
      title: "PDI 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "ACTIVE",
      managerName: "Ana",
      careerObjective: "Tech lead",
      finalRating: "Atende",
      areas: [],
      checkIns: [],
      progress: { done: 0, total: 0 },
    });
  });

  it("lists the active cycle first, then planned, then closed, newest start first", async () => {
    const closed = await createCycle(cycleInput({ title: "2024", startDate: "2024-01-01" }));
    await closeCycle(closed.id);
    const planned = await createCycle(cycleInput({ title: "2027", startDate: "2027-01-01" }));
    const older = await createCycle(cycleInput({ title: "2025", startDate: "2025-01-01" }));
    const active = await createCycle(cycleInput({ title: "2026", status: "ACTIVE" }));

    const ids = (await listCycles()).map((cycle) => cycle.id);

    expect(ids).toEqual([active.id, planned.id, older.id, closed.id]);
  });

  it("allows a single active cycle", async () => {
    const first = await createCycle(cycleInput({ status: "ACTIVE" }));
    const second = await createCycle(cycleInput());

    await expect(createCycle(cycleInput({ status: "ACTIVE" }))).rejects.toBeInstanceOf(
      ActiveCycleExistsError,
    );
    await expect(updateCycle(second.id, cycleInput({ status: "ACTIVE" }))).rejects.toBeInstanceOf(
      ActiveCycleExistsError,
    );
    // Saving the active cycle itself is fine.
    await expect(
      updateCycle(first.id, cycleInput({ status: "ACTIVE", title: "Novo" })),
    ).resolves.toMatchObject({ title: "Novo" });
  });

  it("closes and reopens a cycle", async () => {
    const cycle = await createCycle(cycleInput({ status: "ACTIVE" }));

    expect((await closeCycle(cycle.id)).status).toBe("CLOSED");
    expect((await reopenCycle(cycle.id)).status).toBe("ACTIVE");
  });

  it("refuses to reopen while another cycle is active", async () => {
    const old = await createCycle(cycleInput());
    await closeCycle(old.id);
    await createCycle(cycleInput({ status: "ACTIVE" }));

    await expect(reopenCycle(old.id)).rejects.toBeInstanceOf(ActiveCycleExistsError);
  });

  it("makes a closed cycle and everything in it read-only", async () => {
    const { cycle, area, category: cat } = await setup();
    const action = await createAction(cycle.id, actionInput(area.id, cat.id));
    const checkIn = await createCheckIn(cycle.id, checkInInput());
    await closeCycle(cycle.id);

    const attempts = [
      () => updateCycle(cycle.id, cycleInput()),
      () => deleteCycle(cycle.id),
      () => closeCycle(cycle.id),
      () => createArea(cycle.id, areaInput()),
      () => updateArea(area.id, areaInput("Outra")),
      () => deleteArea(area.id),
      () => createAction(cycle.id, actionInput(area.id, cat.id)),
      () => updateAction(action.id, actionInput(area.id, cat.id, { status: "DONE" })),
      () => deleteAction(action.id),
      () => createCheckIn(cycle.id, checkInInput()),
      () => updateCheckIn(checkIn.id, checkInInput("2026-04-01")),
      () => deleteCheckIn(checkIn.id),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toBeInstanceOf(CycleClosedError);
    }
    expect((await getCycle(cycle.id)).areas[0]!.actions).toHaveLength(1);
  });

  it("refuses to reopen a cycle that is not closed", async () => {
    const cycle = await createCycle(cycleInput());

    await expect(reopenCycle(cycle.id)).rejects.toThrow();
  });

  it("deletes a cycle with its areas, actions and check-ins", async () => {
    const { cycle, area, category: cat } = await setup();
    await createAction(cycle.id, actionInput(area.id, cat.id));
    await createCheckIn(cycle.id, checkInInput());

    await deleteCycle(cycle.id);

    await expect(getCycle(cycle.id)).rejects.toBeInstanceOf(PdiCycleNotFoundError);
    expect(await db.pdiArea.count()).toBe(0);
    expect(await db.pdiAction.count()).toBe(0);
    expect(await db.pdiCheckIn.count()).toBe(0);
  });

  it.each([MISSING_ID, "not-a-uuid"])("throws PdiCycleNotFoundError for %j", async (id) => {
    await expect(getCycle(id)).rejects.toBeInstanceOf(PdiCycleNotFoundError);
    await expect(updateCycle(id, cycleInput())).rejects.toBeInstanceOf(PdiCycleNotFoundError);
    await expect(deleteCycle(id)).rejects.toBeInstanceOf(PdiCycleNotFoundError);
    await expect(closeCycle(id)).rejects.toBeInstanceOf(PdiCycleNotFoundError);
    await expect(createArea(id, areaInput())).rejects.toBeInstanceOf(PdiCycleNotFoundError);
    await expect(createCheckIn(id, checkInInput())).rejects.toBeInstanceOf(PdiCycleNotFoundError);
  });
});

describe("areas", () => {
  it("creates areas in creation order and updates them", async () => {
    const cycle = await createCycle(cycleInput());
    const first = await createArea(cycle.id, areaInput("Comunicação"));
    await createArea(cycle.id, areaInput("Liderança"));

    await updateArea(first.id, { name: "Oratória", description: "d", expectedOutcome: "e" });

    expect((await getCycle(cycle.id)).areas.map((area) => area.name)).toEqual([
      "Oratória",
      "Liderança",
    ]);
  });

  it("deletes an area together with its actions", async () => {
    const { cycle, area, category: cat } = await setup();
    await createAction(cycle.id, actionInput(area.id, cat.id));

    await deleteArea(area.id);

    expect((await getCycle(cycle.id)).areas).toEqual([]);
    expect(await db.pdiAction.count()).toBe(0);
  });

  it.each([MISSING_ID, "not-a-uuid"])("throws PdiAreaNotFoundError for %j", async (id) => {
    await expect(updateArea(id, areaInput())).rejects.toBeInstanceOf(PdiAreaNotFoundError);
    await expect(deleteArea(id)).rejects.toBeInstanceOf(PdiAreaNotFoundError);
  });
});

describe("actions", () => {
  it("creates an action with its category and goal", async () => {
    const { cycle, area, category: cat } = await setup();
    const goal = await createGoal({
      title: "Liderar",
      description: null,
      status: "NOT_STARTED",
      targetDate: null,
    });

    const action = await createAction(
      cycle.id,
      actionInput(area.id, cat.id, { title: "Curso", dueDate: "2026-06-30", goalId: goal.id }),
    );

    expect(action).toMatchObject({
      areaId: area.id,
      cycleId: cycle.id,
      title: "Curso",
      dueDate: "2026-06-30",
      status: "NOT_STARTED",
      category: { id: cat.id, name: "Curso", archived: false },
      goal: { id: goal.id, title: "Liderar" },
    });
  });

  it("orders actions by due date (none last), then creation", async () => {
    const { cycle, area, category: cat } = await setup();
    await createAction(cycle.id, actionInput(area.id, cat.id, { title: "Sem prazo" }));
    await createAction(
      cycle.id,
      actionInput(area.id, cat.id, { title: "Dezembro", dueDate: "2026-12-01" }),
    );
    await createAction(
      cycle.id,
      actionInput(area.id, cat.id, { title: "Março", dueDate: "2026-03-01" }),
    );

    const titles = (await getCycle(cycle.id)).areas[0]!.actions.map((action) => action.title);

    expect(titles).toEqual(["Março", "Dezembro", "Sem prazo"]);
  });

  it("refuses an archived category for a new action or a category change", async () => {
    const { cycle, area, category: active } = await setup();
    const archived = await category("Leitura");
    await setCategoryArchived(archived.id, true);
    const action = await createAction(cycle.id, actionInput(area.id, active.id));

    await expect(createAction(cycle.id, actionInput(area.id, archived.id))).rejects.toBeInstanceOf(
      CategoryArchivedError,
    );
    await expect(updateAction(action.id, actionInput(area.id, archived.id))).rejects.toBeInstanceOf(
      CategoryArchivedError,
    );
  });

  it("keeps an archived category the action already uses", async () => {
    const { cycle, area, category: cat } = await setup();
    const action = await createAction(cycle.id, actionInput(area.id, cat.id));
    await setCategoryArchived(cat.id, true);

    const updated = await updateAction(action.id, actionInput(area.id, cat.id, { status: "DONE" }));

    expect(updated).toMatchObject({ status: "DONE", category: { id: cat.id, archived: true } });
  });

  it("refuses an area from another cycle and moves within the cycle", async () => {
    const { cycle, area, category: cat } = await setup();
    const other = await createArea(cycle.id, areaInput("Outra"));
    const foreignCycle = await createCycle(cycleInput({ title: "Outro" }));
    const foreignArea = await createArea(foreignCycle.id, areaInput());
    const action = await createAction(cycle.id, actionInput(area.id, cat.id));

    await expect(
      createAction(cycle.id, actionInput(foreignArea.id, cat.id)),
    ).rejects.toBeInstanceOf(AreaNotInCycleError);
    await expect(
      updateAction(action.id, actionInput(foreignArea.id, cat.id)),
    ).rejects.toBeInstanceOf(AreaNotInCycleError);
    expect((await updateAction(action.id, actionInput(other.id, cat.id))).areaId).toBe(other.id);
  });

  it("rejects a missing category or goal", async () => {
    const { cycle, area, category: cat } = await setup();

    await expect(createAction(cycle.id, actionInput(area.id, MISSING_ID))).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    await expect(
      createAction(cycle.id, actionInput(area.id, cat.id, { goalId: MISSING_ID })),
    ).rejects.toBeInstanceOf(GoalNotFoundError);
  });

  it("counts progress in the cycle without cancelled actions", async () => {
    const { cycle, area, category: cat } = await setup();
    await createAction(cycle.id, actionInput(area.id, cat.id, { status: "DONE" }));
    await createAction(cycle.id, actionInput(area.id, cat.id, { status: "IN_PROGRESS" }));
    await createAction(cycle.id, actionInput(area.id, cat.id, { status: "CANCELLED" }));

    expect((await getCycle(cycle.id)).progress).toEqual({ done: 1, total: 2 });
    expect((await listCycles())[0]!.progress).toEqual({ done: 1, total: 2 });
  });

  it("lists a goal's actions with cycle and area, and unlinks them when the goal is deleted", async () => {
    const { cycle, area, category: cat } = await setup();
    const goal = await createGoal({
      title: "Liderar",
      description: null,
      status: "NOT_STARTED",
      targetDate: null,
    });
    const action = await createAction(cycle.id, actionInput(area.id, cat.id, { goalId: goal.id }));
    await createAction(cycle.id, actionInput(area.id, cat.id));

    const linked = await listActionsForGoal(goal.id);
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({
      id: action.id,
      cycle: { id: cycle.id, title: "PDI 2026" },
      areaName: "Comunicação",
    });

    await deleteGoal(goal.id);
    expect((await getAction(action.id)).goal).toBeNull();
  });

  it.each([MISSING_ID, "not-a-uuid"])("throws PdiActionNotFoundError for %j", async (id) => {
    const { area, category: cat } = await setup();

    await expect(getAction(id)).rejects.toBeInstanceOf(PdiActionNotFoundError);
    await expect(updateAction(id, actionInput(area.id, cat.id))).rejects.toBeInstanceOf(
      PdiActionNotFoundError,
    );
    await expect(deleteAction(id)).rejects.toBeInstanceOf(PdiActionNotFoundError);
  });
});

describe("check-ins", () => {
  it("lists check-ins newest first, and updates and deletes them", async () => {
    const cycle = await createCycle(cycleInput());
    const march = await createCheckIn(cycle.id, checkInInput("2026-03-01", "Março"));
    await createCheckIn(cycle.id, checkInInput("2026-06-01", "Junho"));

    await updateCheckIn(march.id, { ...checkInInput("2026-03-02", "Março 2"), nextSteps: "x" });
    expect((await getCycle(cycle.id)).checkIns.map((checkIn) => checkIn.summary)).toEqual([
      "Junho",
      "Março 2",
    ]);

    await deleteCheckIn(march.id);
    expect((await getCycle(cycle.id)).checkIns).toHaveLength(1);
  });

  it.each([MISSING_ID, "not-a-uuid"])("throws PdiCheckInNotFoundError for %j", async (id) => {
    await expect(updateCheckIn(id, checkInInput())).rejects.toBeInstanceOf(PdiCheckInNotFoundError);
    await expect(deleteCheckIn(id)).rejects.toBeInstanceOf(PdiCheckInNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// Routines linked to actions (plan 005)
// ---------------------------------------------------------------------------

// 2026-11-16 is a Monday.
const today = "2026-11-16";

function routineInput(overrides: Partial<RoutineInput> = {}): RoutineInput {
  return {
    title: "Praticar",
    description: null,
    weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    timesPerWeek: null,
    timeOfDay: null,
    startDate: "2026-11-02",
    endDate: null,
    goalId: null,
    ...overrides,
  };
}

const done = { status: "DONE" as const, note: null };

/** The action as the edit form would send it, with a new status. */
function finish(
  fixture: Awaited<ReturnType<typeof pdiActionFixture>>,
  status: "DONE" | "CANCELLED" | "IN_PROGRESS",
  routineOutcome?: "END" | "UNLINK",
): ActionInput {
  return {
    ...actionInput(fixture.area.id, fixture.category.id, { title: fixture.action.title, status }),
    routineOutcome,
  };
}

describe("action evidence", () => {
  it("counts a weekly-goal routine in goal days (plan 017)", async () => {
    const fixture = await pdiActionFixture({
      cycle: { startDate: "2026-01-01", endDate: "2026-12-31" },
    });
    // From Monday the 2nd; today, the 16th, starts a new week.
    const routine = await createRoutine(routineInput({ timesPerWeek: 2 }), fixture.action.id);
    for (const date of ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-11"]) {
      await logRoutine(routine.id, date, done, today);
    }

    const detail = await getActionDetail(fixture.action.id, today);

    // Two closed weeks with a goal of 2: 2 (of 3 done) + 1.
    expect(detail.routines[0]?.adherence).toMatchObject({ scheduled: 4, done: 3, missed: 1 });
  });

  it("shows the linked routines with adherence inside the cycle, and their logs newest first", async () => {
    const fixture = await pdiActionFixture({
      cycle: { startDate: "2026-01-01", endDate: "2026-11-10" },
    });
    const routine = await createRoutine(routineInput(), fixture.action.id);
    await logRoutine(routine.id, "2026-11-03", done, today);
    await logRoutine(routine.id, "2026-11-04", { status: "SKIPPED", note: "Viagem" }, today);
    // After the cycle ended: not evidence for this PDI.
    await logRoutine(routine.id, "2026-11-12", done, today);

    const detail = await getActionDetail(fixture.action.id, today);

    expect(detail.action.id).toBe(fixture.action.id);
    expect(detail.cycle).toMatchObject({ id: fixture.cycle.id, status: "PLANNED" });
    expect(detail.areaName).toBe("Área");
    expect(detail.routines).toHaveLength(1);
    expect(detail.routines[0]).toMatchObject({
      routine: { id: routine.id, title: "Praticar" },
      period: { from: "2026-11-02", to: "2026-11-10" },
      adherence: { scheduled: 9, done: 1, skipped: 1, missed: 7, rate: 11 },
    });
    expect(detail.logs).toEqual([
      {
        routineId: routine.id,
        routineTitle: "Praticar",
        date: "2026-11-04",
        status: "SKIPPED",
        note: "Viagem",
      },
      {
        routineId: routine.id,
        routineTitle: "Praticar",
        date: "2026-11-03",
        status: "DONE",
        note: null,
      },
    ]);
  });

  it("shows a routine that has not started yet with no period", async () => {
    const fixture = await pdiActionFixture();
    await createRoutine(routineInput({ startDate: "2026-11-20" }), fixture.action.id);

    const detail = await getActionDetail(fixture.action.id, today);

    expect(detail.routines[0]).toMatchObject({ period: null, adherence: { scheduled: 0 } });
  });

  it("sums the adherence of every routine of each action in a cycle", async () => {
    const fixture = await pdiActionFixture();
    const morning = await createRoutine(
      routineInput({ startDate: "2026-11-15" }),
      fixture.action.id,
    );
    await createRoutine(routineInput({ startDate: "2026-11-15" }), fixture.action.id);
    await logRoutine(morning.id, "2026-11-15", done, today);

    const evidence = await getRoutineEvidenceByAction(fixture.cycle.id, today);

    expect(evidence[fixture.action.id]).toEqual({
      count: 2,
      adherence: { scheduled: 2, done: 1, skipped: 0, missed: 1, rate: 50 },
    });
  });

  it("leaves actions without routines out of the summary", async () => {
    const fixture = await pdiActionFixture();

    expect(await getRoutineEvidenceByAction(fixture.cycle.id, today)).toEqual({});
  });

  it("lists the routines still in effect (active or upcoming)", async () => {
    const fixture = await pdiActionFixture();
    const active = await createRoutine(routineInput({ title: "Ativa" }), fixture.action.id);
    const upcoming = await createRoutine(
      routineInput({ title: "Futura", startDate: "2026-11-20" }),
      fixture.action.id,
    );
    await createRoutine(
      routineInput({ title: "Encerrada", endDate: "2026-11-10" }),
      fixture.action.id,
    );

    expect(await listRoutinesInEffect(fixture.action.id, today)).toEqual([
      { id: active.id, title: "Ativa", upcoming: false },
      { id: upcoming.id, title: "Futura", upcoming: true },
    ]);
  });
});

describe("finishing an action with linked routines", () => {
  it.each(["DONE", "CANCELLED"] as const)(
    "requires a choice when the action becomes %s",
    async (status) => {
      const fixture = await pdiActionFixture();
      await createRoutine(routineInput(), fixture.action.id);

      await expect(
        updateAction(fixture.action.id, finish(fixture, status), today),
      ).rejects.toBeInstanceOf(RoutineOutcomeRequiredError);
      expect((await getAction(fixture.action.id)).status).toBe("IN_PROGRESS");
    },
  );

  it("needs no choice without routines in effect", async () => {
    const fixture = await pdiActionFixture();
    await createRoutine(routineInput({ endDate: "2026-11-10" }), fixture.action.id);

    const updated = await updateAction(fixture.action.id, finish(fixture, "DONE"), today);

    expect(updated.status).toBe("DONE");
  });

  it("needs no choice when the action stays open", async () => {
    const fixture = await pdiActionFixture();
    await createRoutine(routineInput(), fixture.action.id);

    const updated = await updateAction(fixture.action.id, finish(fixture, "IN_PROGRESS"), today);

    expect(updated.status).toBe("IN_PROGRESS");
  });

  it("END ends the routine today and keeps the link", async () => {
    const fixture = await pdiActionFixture();
    const routine = await createRoutine(routineInput(), fixture.action.id);

    await updateAction(fixture.action.id, finish(fixture, "DONE", "END"), today);

    expect(await getRoutine(routine.id)).toMatchObject({
      endDate: today,
      pdiAction: { id: fixture.action.id },
    });
  });

  it("END deletes a routine that has not started yet", async () => {
    const fixture = await pdiActionFixture();
    const routine = await createRoutine(
      routineInput({ startDate: "2026-11-20" }),
      fixture.action.id,
    );

    await updateAction(fixture.action.id, finish(fixture, "CANCELLED", "END"), today);

    expect(await db.routine.count({ where: { id: routine.id } })).toBe(0);
  });

  it("UNLINK removes the link and keeps the routine going", async () => {
    const fixture = await pdiActionFixture();
    const routine = await createRoutine(routineInput(), fixture.action.id);

    await updateAction(fixture.action.id, finish(fixture, "CANCELLED", "UNLINK"), today);

    expect(await getRoutine(routine.id)).toMatchObject({ endDate: null, pdiAction: null });
  });

  it.each(["END", "UNLINK"] as const)(
    "keeps an already ended routine linked with %s",
    async (outcome) => {
      const fixture = await pdiActionFixture();
      const ended = await createRoutine(routineInput({ endDate: "2026-11-10" }), fixture.action.id);
      await createRoutine(routineInput(), fixture.action.id);

      await updateAction(fixture.action.id, finish(fixture, "DONE", outcome), today);

      expect(await getRoutine(ended.id)).toMatchObject({
        endDate: "2026-11-10",
        pdiAction: { id: fixture.action.id },
      });
    },
  );

  it("does not touch the routines when a done action goes back to in progress", async () => {
    const fixture = await pdiActionFixture();
    const routine = await createRoutine(routineInput(), fixture.action.id);
    await updateAction(fixture.action.id, finish(fixture, "DONE", "END"), today);

    await updateAction(fixture.action.id, finish(fixture, "IN_PROGRESS"), today);

    expect(await getRoutine(routine.id)).toMatchObject({
      endDate: today,
      pdiAction: { id: fixture.action.id },
    });
  });

  it("deleting the action keeps the routine, unlinked", async () => {
    const fixture = await pdiActionFixture();
    const routine = await createRoutine(routineInput(), fixture.action.id);

    await deleteAction(fixture.action.id);

    expect((await getRoutine(routine.id)).pdiAction).toBeNull();
  });
});

describe("dashboard queries", () => {
  it("lists open actions with a due date from cycles that are not closed", async () => {
    const { cycle, area, category: cat } = await setup({ title: "Atual" });
    const categoryId = cat.id;
    const add = (title: string, overrides: Partial<ActionInput> = {}) =>
      createAction(cycle.id, actionInput(area.id, categoryId, { title, ...overrides }));
    const open = await add("Aberta", { dueDate: "2026-11-20" });
    const started = await add("Começada", { dueDate: "2026-11-10", status: "IN_PROGRESS" });
    await add("Sem prazo", { dueDate: null });
    await add("Concluída", { dueDate: "2026-11-10", status: "DONE" });
    await add("Cancelada", { dueDate: "2026-11-10", status: "CANCELLED" });
    const closed = await createCycle(cycleInput({ title: "Antigo" }));
    const closedArea = await createArea(closed.id, areaInput());
    await createAction(
      closed.id,
      actionInput(closedArea.id, categoryId, {
        title: "Do ciclo encerrado",
        dueDate: "2026-11-01",
      }),
    );
    await closeCycle(closed.id);

    const actions = await listOpenActionsWithDueDate();

    expect(actions).toHaveLength(2);
    expect(actions).toEqual(
      expect.arrayContaining([
        {
          id: open.id,
          title: "Aberta",
          dueDate: "2026-11-20",
          cycle: { id: cycle.id, title: "Atual" },
        },
        {
          id: started.id,
          title: "Começada",
          dueDate: "2026-11-10",
          cycle: { id: cycle.id, title: "Atual" },
        },
      ]),
    );
  });

  it("gives the date of the cycle's latest check-in, or null", async () => {
    const { cycle } = await setup();
    await expect(getLastCheckInDate(cycle.id)).resolves.toBeNull();

    await createCheckIn(cycle.id, checkInInput("2026-03-01"));
    await createCheckIn(cycle.id, checkInInput("2026-05-10"));
    await createCheckIn(cycle.id, checkInInput("2026-04-02"));

    await expect(getLastCheckInDate(cycle.id)).resolves.toBe("2026-05-10");
  });
});
