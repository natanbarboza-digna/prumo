import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import type { GoalInput } from "@/modules/goals/schemas";
import {
  GoalNotFoundError,
  createGoal,
  deleteGoal,
  getGoal,
  getGoalProgress,
  getGoalsProgress,
  listGoals,
  updateGoal,
} from "@/modules/goals/service";
import { createStep, createTrack, setStepStatus } from "@/modules/tracks/service";

describe("getGoalProgress", () => {
  async function addTrack(goalId: string | null, statuses: ("NOT_STARTED" | "DONE")[]) {
    const track = await createTrack({ title: "Trilha", description: null, goalId });
    for (const status of statuses) {
      const step = await createStep(track.id, {
        title: "Etapa",
        status: "NOT_STARTED",
        dueDate: null,
        resourceUrl: null,
        notes: null,
      });
      if (status === "DONE") await setStepStatus(step.id, "DONE");
    }
  }

  it("is zero without linked tracks", async () => {
    const goal = await createGoal(input());

    await expect(getGoalProgress(goal.id)).resolves.toEqual({
      done: 0,
      total: 0,
      steps: { done: 0, total: 0 },
      actions: { done: 0, total: 0 },
    });
  });

  it("sums the steps of every linked track and ignores other goals", async () => {
    const goal = await createGoal(input());
    const other = await createGoal(input({ title: "Outro" }));
    await addTrack(goal.id, ["DONE", "NOT_STARTED"]);
    await addTrack(goal.id, ["DONE", "DONE", "NOT_STARTED"]);
    await addTrack(other.id, ["DONE"]);
    await addTrack(null, ["DONE"]);

    await expect(getGoalProgress(goal.id)).resolves.toMatchObject({
      done: 3,
      total: 5,
      steps: { done: 3, total: 5 },
    });
  });

  it("adds the linked PDI actions, leaving cancelled ones out", async () => {
    const goal = await createGoal(input());
    await addTrack(goal.id, ["DONE", "NOT_STARTED"]);
    const cycle = await db.pdiCycle.create({
      data: { title: "Ciclo", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
    });
    const area = await db.pdiArea.create({ data: { cycleId: cycle.id, name: "Área", order: 1 } });
    const category = await db.actionCategory.create({ data: { name: "Curso" } });
    let order = 0;
    for (const status of ["DONE", "IN_PROGRESS", "CANCELLED"] as const) {
      order++;
      await db.pdiAction.create({
        data: {
          areaId: area.id,
          categoryId: category.id,
          title: "Ação",
          status,
          goalId: goal.id,
          order,
        },
      });
    }

    await expect(getGoalProgress(goal.id)).resolves.toEqual({
      done: 2,
      total: 4,
      steps: { done: 1, total: 2 },
      actions: { done: 1, total: 2 },
    });
  });
});

const MISSING_ID = "0190a3e4-0000-7000-8000-000000000000";

function input(overrides: Partial<GoalInput> = {}): GoalInput {
  return {
    title: "Objetivo",
    description: null,
    status: "NOT_STARTED",
    targetDate: null,
    ...overrides,
  };
}

describe("createGoal", () => {
  it("stores the goal with defaults and timestamps", async () => {
    const goal = await createGoal(input({ title: "Aprender Next.js" }));

    expect(goal).toMatchObject({
      title: "Aprender Next.js",
      description: null,
      status: "NOT_STARTED",
      targetDate: null,
    });
    expect(goal.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(goal.createdAt).toBeInstanceOf(Date);
  });

  it("stores the target date without shifting the day", async () => {
    const goal = await createGoal(input({ targetDate: "2026-12-31" }));

    expect(goal.targetDate).toBe("2026-12-31");
    const [row] = await db.$queryRaw<{ value: string }[]>`
      SELECT target_date::text AS value FROM goals WHERE id = ${goal.id}::uuid`;
    expect(row?.value).toBe("2026-12-31");
  });
});

describe("listGoals", () => {
  it("hides archived goals and orders by nearest target date, undated last", async () => {
    const undated = await createGoal(input({ title: "Sem data" }));
    const later = await createGoal(input({ title: "Depois", targetDate: "2027-06-01" }));
    const sooner = await createGoal(input({ title: "Antes", targetDate: "2026-12-01" }));
    await createGoal(input({ title: "Arquivado", status: "ARCHIVED" }));

    const goals = await listGoals();

    expect(goals.map((goal) => goal.id)).toEqual([sooner.id, later.id, undated.id]);
  });

  it("puts the most recent first when target dates tie", async () => {
    const older = await createGoal(input({ title: "Mais antigo" }));
    const newer = await createGoal(input({ title: "Mais novo" }));
    // Two inserts can land in the same millisecond; pin the order explicitly.
    await db.$executeRaw`UPDATE goals SET created_at = '2026-01-01' WHERE id = ${older.id}::uuid`;

    const goals = await listGoals();

    expect(goals.map((goal) => goal.id)).toEqual([newer.id, older.id]);
  });

  it("filters by status, including archived", async () => {
    await createGoal(input({ title: "Ativo" }));
    const archived = await createGoal(input({ title: "Arquivado", status: "ARCHIVED" }));

    const goals = await listGoals({ status: "ARCHIVED" });

    expect(goals.map((goal) => goal.id)).toEqual([archived.id]);
  });
});

describe("getGoal", () => {
  it("returns the goal", async () => {
    const created = await createGoal(input({ title: "Ler 12 livros" }));

    await expect(getGoal(created.id)).resolves.toEqual(created);
  });

  it.each([MISSING_ID, "not-a-uuid"])("throws GoalNotFoundError for %j", async (id) => {
    await expect(getGoal(id)).rejects.toBeInstanceOf(GoalNotFoundError);
  });
});

describe("updateGoal", () => {
  it("changes the fields and bumps updatedAt", async () => {
    const created = await createGoal(input({ title: "Antes" }));
    // Move the creation into the past so the update is always measurably later.
    await db.$executeRaw`UPDATE goals SET updated_at = '2026-01-01' WHERE id = ${created.id}::uuid`;

    const updated = await updateGoal(
      created.id,
      input({
        title: "Depois",
        description: "Nova descrição",
        status: "DONE",
        targetDate: "2027-01-15",
      }),
    );

    expect(updated).toMatchObject({
      id: created.id,
      title: "Depois",
      description: "Nova descrição",
      status: "DONE",
      targetDate: "2027-01-15",
    });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(new Date("2026-01-01").getTime());
  });

  it("throws GoalNotFoundError for a missing goal", async () => {
    await expect(updateGoal(MISSING_ID, input())).rejects.toBeInstanceOf(GoalNotFoundError);
  });
});

describe("deleteGoal", () => {
  it("removes the goal", async () => {
    const created = await createGoal(input());

    await deleteGoal(created.id);

    await expect(getGoal(created.id)).rejects.toBeInstanceOf(GoalNotFoundError);
  });

  it("throws GoalNotFoundError for a missing goal", async () => {
    await expect(deleteGoal(MISSING_ID)).rejects.toBeInstanceOf(GoalNotFoundError);
  });
});

describe("getGoalsProgress", () => {
  it("gives each goal the same progress as getGoalProgress", async () => {
    const first = await createGoal(input({ title: "Primeiro" }));
    const second = await createGoal(input({ title: "Segundo" }));
    const empty = await createGoal(input({ title: "Vazio" }));
    const track = await createTrack({ title: "Trilha", description: null, goalId: first.id });
    const step = await createStep(track.id, {
      title: "Etapa",
      status: "NOT_STARTED",
      dueDate: null,
      resourceUrl: null,
      notes: null,
    });
    await setStepStatus(step.id, "DONE");
    await createStep(track.id, {
      title: "Outra",
      status: "IN_PROGRESS",
      dueDate: null,
      resourceUrl: null,
      notes: null,
    });
    const cycle = await db.pdiCycle.create({
      data: { title: "Ciclo", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
    });
    const area = await db.pdiArea.create({ data: { cycleId: cycle.id, name: "Área", order: 1 } });
    const category = await db.actionCategory.create({ data: { name: "Curso" } });
    let order = 0;
    for (const [goalId, status] of [
      [first.id, "DONE"],
      [second.id, "IN_PROGRESS"],
      [second.id, "DONE"],
      [second.id, "CANCELLED"],
    ] as const) {
      order++;
      await db.pdiAction.create({
        data: { areaId: area.id, categoryId: category.id, title: "Ação", status, goalId, order },
      });
    }

    const progress = await getGoalsProgress([first.id, second.id, empty.id]);

    for (const goal of [first, second, empty]) {
      expect(progress.get(goal.id)).toEqual(await getGoalProgress(goal.id));
    }
    expect(progress.get(first.id)).toMatchObject({ done: 2, total: 3 });
    expect(progress.get(second.id)).toMatchObject({ done: 1, total: 2 });
    expect(progress.get(empty.id)).toMatchObject({ done: 0, total: 0 });
  });

  it("is empty for no goals", async () => {
    await expect(getGoalsProgress([])).resolves.toEqual(new Map());
  });
});
