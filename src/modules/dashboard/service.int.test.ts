import { describe, expect, it } from "vitest";

import { addDays } from "@/lib/dates";
import { createCategory } from "@/modules/categories/service";
import { getDashboard } from "@/modules/dashboard/service";
import type { GoalInput } from "@/modules/goals/schemas";
import { createGoal } from "@/modules/goals/service";
import type { CycleInput } from "@/modules/pdi/schemas";
import {
  closeCycle,
  createAction,
  createArea,
  createCheckIn,
  createCycle,
} from "@/modules/pdi/service";
import type { RoutineInput } from "@/modules/routines/schemas";
import { createRoutine, logRoutine } from "@/modules/routines/service";
import { createStep, createTrack, setStepStatus } from "@/modules/tracks/service";

// 2026-11-16 is a Monday.
const today = "2026-11-16";
const done = { status: "DONE" as const, note: null };

function goalInput(overrides: Partial<GoalInput> = {}): GoalInput {
  return {
    title: "Objetivo",
    description: null,
    status: "IN_PROGRESS",
    targetDate: null,
    ...overrides,
  };
}

function routineInput(overrides: Partial<RoutineInput> = {}): RoutineInput {
  return {
    title: "Rotina",
    description: null,
    weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    timeOfDay: null,
    startDate: addDays(today, -9),
    endDate: null,
    goalId: null,
    ...overrides,
  };
}

function cycleInput(overrides: Partial<CycleInput> = {}): CycleInput {
  return {
    title: "PDI 2026",
    startDate: "2026-07-01",
    endDate: "2026-12-31",
    status: "ACTIVE",
    managerName: null,
    careerObjective: null,
    selfAssessment: null,
    managerFeedback: null,
    finalRating: null,
    ...overrides,
  };
}

async function track(title: string, steps: { title: string; dueDate?: string; done?: boolean }[]) {
  const created = await createTrack({ title, description: null, goalId: null });
  for (const step of steps) {
    const row = await createStep(created.id, {
      title: step.title,
      status: "NOT_STARTED",
      dueDate: step.dueDate ?? null,
      resourceUrl: null,
      notes: null,
    });
    if (step.done) await setStepStatus(row.id, "DONE");
  }
  return created;
}

/** A cycle with one area and a category; `allowsRoutine` lets actions get routines. */
async function cycleWithArea(overrides: Partial<CycleInput> = {}) {
  const cycle = await createCycle(cycleInput(overrides));
  const area = await createArea(cycle.id, {
    name: "Área",
    description: null,
    expectedOutcome: null,
  });
  const category = await createCategory({ name: `Prática ${cycle.title}`, allowsRoutine: true });
  const addAction = (title: string, fields: { dueDate?: string; status?: "DONE" } = {}) =>
    createAction(cycle.id, {
      areaId: area.id,
      categoryId: category.id,
      title,
      description: null,
      expectedResult: null,
      dueDate: fields.dueDate ?? null,
      status: fields.status ?? "IN_PROGRESS",
      evidence: null,
      managerComment: null,
      goalId: null,
    });
  return { cycle, addAction };
}

describe("getDashboard", () => {
  it("marks the first use when there is nothing yet", async () => {
    const dashboard = await getDashboard(today);

    expect(dashboard.firstUse).toBe(true);
    expect(dashboard.today.items).toEqual([]);
    expect(dashboard.pdi).toEqual({ kind: "NONE" });
  });

  it("is not the first use once anything exists", async () => {
    await createRoutine(routineInput({ startDate: addDays(today, 5) }));

    await expect(getDashboard(today)).resolves.toMatchObject({ firstUse: false });
  });

  it("lists today's routines with their logs and the done count", async () => {
    const reading = await createRoutine(routineInput({ title: "Ler" }));
    await createRoutine(routineInput({ title: "Correr" }));
    await createRoutine(routineInput({ title: "Só no sábado", weekdays: ["SAT"] }));
    await logRoutine(reading.id, today, done, today);

    const { today: block } = await getDashboard(today);

    expect(block.items.map((item) => item.routine.title)).toEqual(["Correr", "Ler"]);
    expect(block.done).toBe(1);
  });

  it("sums the last 30 days of adherence of the active routines only", async () => {
    const active = await createRoutine(routineInput({ title: "Ativa" }));
    const ended = await createRoutine(
      routineInput({ title: "Encerrada", endDate: addDays(today, -1) }),
    );
    await logRoutine(active.id, today, done, today);
    await logRoutine(active.id, addDays(today, -1), done, today);
    await logRoutine(ended.id, addDays(today, -1), done, today);

    const { today: block } = await getDashboard(today);

    // Ten scheduled days (9 days ago up to today), two done.
    expect(block.adherence).toMatchObject({ scheduled: 10, done: 2, rate: 20 });
  });

  it("joins steps, actions and goals into overdue and upcoming deadlines", async () => {
    const english = await track("Inglês", [
      { title: "Etapa atrasada", dueDate: addDays(today, -2) },
      { title: "Etapa feita", dueDate: addDays(today, -3), done: true },
      { title: "Etapa distante", dueDate: addDays(today, 30) },
    ]);
    const { cycle, addAction } = await cycleWithArea({ title: "Atual" });
    const action = await addAction("Ação de hoje", { dueDate: today });
    await addAction("Ação concluída", { dueDate: today, status: "DONE" });
    const goal = await createGoal(
      goalInput({ title: "Objetivo próximo", targetDate: addDays(today, 5) }),
    );
    await createGoal(goalInput({ title: "Objetivo feito", status: "DONE", targetDate: today }));

    const { deadlines } = await getDashboard(today);

    expect(deadlines.overdue.items).toEqual([
      {
        kind: "STEP",
        id: expect.any(String),
        title: "Etapa atrasada",
        date: addDays(today, -2),
        href: `/tracks/${english.id}`,
        source: "Inglês",
      },
    ]);
    expect(deadlines.upcoming.items).toEqual([
      {
        kind: "ACTION",
        id: action.id,
        title: "Ação de hoje",
        date: today,
        href: `/pdi/${cycle.id}/actions/${action.id}`,
        source: "Atual",
      },
      {
        kind: "GOAL",
        id: goal.id,
        title: "Objetivo próximo",
        date: addDays(today, 5),
        href: `/goals/${goal.id}`,
        source: null,
      },
    ]);
  });

  it("lists up to five goals in progress by target date, without one last", async () => {
    await createGoal(goalInput({ title: "Sem data" }));
    await createGoal(goalInput({ title: "Não iniciado", status: "NOT_STARTED" }));
    for (const [index, title] of ["E", "D", "C", "B", "A"].entries()) {
      await createGoal(goalInput({ title, targetDate: addDays(today, 10 - index) }));
    }

    const { goals } = await getDashboard(today);

    expect(goals.total).toBe(6);
    expect(goals.items.map((item) => item.goal.title)).toEqual(["A", "B", "C", "D", "E"]);
    expect(goals.items[0]?.progress).toEqual({
      done: 0,
      total: 0,
      steps: { done: 0, total: 0 },
      actions: { done: 0, total: 0 },
    });
  });

  it("lists only the tracks in progress", async () => {
    await track("Começada", [{ title: "Feita", done: true }, { title: "Aberta" }]);
    await track("Não começada", [{ title: "Aberta" }]);
    await track("Concluída", [{ title: "Feita", done: true }]);

    const { tracks } = await getDashboard(today);

    expect(tracks.total).toBe(1);
    expect(tracks.items.map((item) => item.title)).toEqual(["Começada"]);
  });

  it("summarizes the active cycle", async () => {
    const { cycle, addAction } = await cycleWithArea();
    const practice = await addAction("Praticar", { dueDate: addDays(today, -1) });
    await addAction("Ler", { dueDate: addDays(today, 3) });
    await addAction("Feita", { status: "DONE" });
    const routine = await createRoutine(routineInput({ title: "Prática" }), practice.id);
    await logRoutine(routine.id, today, done, today);
    await createCheckIn(cycle.id, {
      date: "2026-11-02",
      summary: "Alinhamento",
      nextSteps: null,
      managerNotes: null,
    });

    const { pdi } = await getDashboard(today);

    expect(pdi).toMatchObject({
      kind: "ACTIVE",
      cycle: { id: cycle.id, progress: { done: 1, total: 3 } },
      overdueActions: 1,
      routineAdherence: { scheduled: 10, done: 1 },
      lastCheckIn: "2026-11-02",
    });
  });

  it("has no routine adherence when the active cycle has no linked routine", async () => {
    await cycleWithArea();

    const { pdi } = await getDashboard(today);

    expect(pdi).toMatchObject({ kind: "ACTIVE", routineAdherence: null, lastCheckIn: null });
  });

  it("shows the planned cycle that starts first when none is active", async () => {
    const old = await cycleWithArea({
      title: "Encerrado",
      status: "PLANNED",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });
    await closeCycle(old.cycle.id);
    await cycleWithArea({
      title: "Depois",
      status: "PLANNED",
      startDate: "2027-07-01",
      endDate: "2027-12-31",
    });
    await cycleWithArea({
      title: "Próximo",
      status: "PLANNED",
      startDate: "2027-01-01",
      endDate: "2027-06-30",
    });

    const { pdi } = await getDashboard(today);

    expect(pdi).toMatchObject({ kind: "PLANNED", cycle: { title: "Próximo" } });
  });
});
