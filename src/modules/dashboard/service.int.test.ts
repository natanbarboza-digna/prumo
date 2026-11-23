import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { changeBookStatus, createBook } from "@/modules/books/service";
import { addDays } from "@/lib/dates";
import { createCategory } from "@/modules/categories/service";
import { getDashboard, listDeadlines } from "@/modules/dashboard/service";
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
import { ensureDefaultTimeCategories } from "@/modules/time/defaults";
import { listTimeCategories, saveEntry, startDay } from "@/modules/time/service";
import { archiveTrack, createStep, createTrack, setStepStatus } from "@/modules/tracks/service";

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
    timesPerWeek: null,
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

  it("adds a weekly goal to the 30 days of adherence in goal days (plan 017)", async () => {
    // Today, 2026-11-16, is a Monday: the week of the 9th is closed, this one just began.
    await createRoutine(routineInput({ title: "Diária", startDate: "2026-11-09" }));
    const weekly = await createRoutine(
      routineInput({ title: "Semanal", timesPerWeek: 2, startDate: "2026-11-09" }),
    );
    await logRoutine(weekly.id, "2026-11-10", done, today);

    const { today: block } = await getDashboard(today);

    // Daily: 7 days of the week of the 9th, none done. Weekly: goal 2, 1 done.
    expect(block.adherence).toMatchObject({ scheduled: 9, done: 1 });
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
      books: { done: 0, total: 0 },
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

  it("leaves archived tracks out, without counting them as a first use (plan 024)", async () => {
    const archived = await track("Arquivada", [
      { title: "Feita", done: true },
      { title: "Com prazo", dueDate: addDays(today, 3) },
    ]);
    await archiveTrack(archived.id);

    const dashboard = await getDashboard(today);

    expect(dashboard.tracks.total).toBe(0);
    expect(dashboard.deadlines.overdue.items).toEqual([]);
    expect(dashboard.deadlines.upcoming.items).toEqual([]);
    expect(dashboard.firstUse).toBe(false);
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

describe("listDeadlines (plan 028)", () => {
  it("joins open steps, actions and goals with a date, by the dashboard's rules", async () => {
    const english = await track("Inglês", [
      { title: "Etapa distante", dueDate: addDays(today, 60) },
      { title: "Etapa feita", dueDate: today, done: true },
      { title: "Sem prazo" },
    ]);
    const archived = await track("Arquivada", [{ title: "Etapa guardada", dueDate: today }]);
    await archiveTrack(archived.id);
    const { cycle, addAction } = await cycleWithArea({ title: "Atual" });
    const action = await addAction("Ação atrasada", { dueDate: addDays(today, -4) });
    await addAction("Ação concluída", { dueDate: today, status: "DONE" });
    const closed = await cycleWithArea({ title: "Encerrado", status: "PLANNED" });
    await closed.addAction("Ação de ciclo encerrado", { dueDate: today });
    await closeCycle(closed.cycle.id);
    const goal = await createGoal(goalInput({ title: "Meta", targetDate: addDays(today, 100) }));
    await createGoal(goalInput({ title: "Arquivada", status: "ARCHIVED", targetDate: today }));

    const deadlines = await listDeadlines();

    expect(deadlines.map((item) => item.title).sort()).toEqual([
      "Ação atrasada",
      "Etapa distante",
      "Meta",
    ]);
    expect(deadlines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "STEP",
          href: `/tracks/${english.id}`,
          source: "Inglês",
          date: addDays(today, 60),
        }),
        expect.objectContaining({
          kind: "ACTION",
          id: action.id,
          href: `/pdi/${cycle.id}/actions/${action.id}`,
          source: "Atual",
        }),
        expect.objectContaining({ kind: "GOAL", id: goal.id, href: `/goals/${goal.id}` }),
      ]),
    );
  });
});

describe("books in the deadlines (plan 035)", () => {
  const book = (title: string, dueDate: string | null) =>
    createBook(
      {
        title,
        authors: "Autor",
        format: "PHYSICAL",
        pages: null,
        genre: null,
        recommendedBy: null,
        notes: null,
        reason: "WORK",
        dueDate,
        goalId: null,
        startedOn: null,
        finishedOn: null,
        durationMinutes: null,
      },
      today,
    );

  it("adds required books with a due date that are not finished", async () => {
    const late = await book("Livro atrasado", addDays(today, -2));
    const reading = await book("Livro lendo", addDays(today, 5));
    await changeBookStatus(reading.id, "START", today);
    const read = await book("Livro lido", addDays(today, 3));
    await changeBookStatus(read.id, "START", today);
    await changeBookStatus(read.id, "FINISH", today);
    await book("Livro sem prazo", null);

    const deadlines = await listDeadlines();

    expect(deadlines.map((item) => [item.kind, item.title, item.href, item.source])).toEqual([
      ["BOOK", "Livro atrasado", `/books/${late.id}`, null],
      ["BOOK", "Livro lendo", `/books/${reading.id}`, null],
    ]);
    const { deadlines: card, kpis } = await getDashboard(today);
    expect(card.overdue.items.map((item) => item.title)).toEqual(["Livro atrasado"]);
    expect(card.upcoming.items.map((item) => item.title)).toEqual(["Livro lendo"]);
    expect(kpis.overdue).toBe(1);
  });
});

describe("weekly adherence on the dashboard (plan 029)", () => {
  it("sums the active routines week by week, leaving ended ones out", async () => {
    const reading = await createRoutine(routineInput({ title: "Ler" }));
    await logRoutine(reading.id, addDays(today, -7), done, today);
    const ended = await createRoutine(
      routineInput({ title: "Encerrada", endDate: addDays(today, -2) }),
    );
    await logRoutine(ended.id, addDays(today, -7), done, today);

    const { today: block } = await getDashboard(today);

    expect(block.weekly).toHaveLength(12);
    // Last week (Monday the 9th): only "Ler" counts, 1 done of 7 days.
    expect(block.weekly[10]).toMatchObject({
      monday: addDays(today, -7),
      adherence: { scheduled: 7, done: 1 },
    });
  });
});

describe("dashboard numbers and week time (plan 034)", () => {
  // Wednesday, November 18, 12:00 in Fortaleza.
  const wednesday = "2026-11-18";
  const now = new Date("2026-11-18T15:00:00Z");
  const noon = 12 * 60;

  async function timeCategory(name: string) {
    await ensureDefaultTimeCategories(db);
    const found = (await listTimeCategories()).find((category) => category.name === name);
    if (!found) throw new Error(`No category ${name}`);
    return found.id;
  }

  async function work(date: string, slots: string[], categoryId: string) {
    for (const slot of slots) {
      await saveEntry(
        date,
        slot,
        null,
        { kind: "WORK", description: "Trabalho", categoryId, projectName: null },
        now,
      );
    }
  }

  it("counts today's routines, the overdue deadlines past the list limit and the PDI", async () => {
    await createRoutine(routineInput({ startDate: "2026-11-09" }));
    const second = await createRoutine(routineInput({ title: "Outra", startDate: "2026-11-09" }));
    await logRoutine(second.id, wednesday, done, wednesday);
    // Seven overdue steps: the card shows 5, the number counts all of them.
    await track(
      "Atrasada",
      Array.from({ length: 7 }, (_, index) => ({
        title: `Etapa ${index}`,
        dueDate: addDays(wednesday, -1 - index),
      })),
    );
    const { addAction, cycle } = await cycleWithArea();
    await addAction("Feita", { status: "DONE" });
    await addAction("Aberta");

    const dashboard = await getDashboard(wednesday, noon);

    expect(dashboard.deadlines.overdue.items).toHaveLength(5);
    expect(dashboard.kpis).toMatchObject({
      routinesToday: { done: 1, total: 2 },
      // Today without a log does not count yet: 10 + 9 days.
      adherence: { scheduled: 19, rate: 5 },
      overdue: 7,
      pdi: { cycleId: cycle.id, percent: 50 },
    });
  });

  it("has no PDI number without an active cycle", async () => {
    await cycleWithArea({ status: "PLANNED", startDate: "2027-01-01", endDate: "2027-06-30" });

    expect((await getDashboard(wednesday, noon)).kpis.pdi).toBeNull();
  });

  it("sums the week's time from Monday to today, by day, and the work by category", async () => {
    const projeto = await timeCategory("Projeto");
    const chamados = await timeCategory("Chamados");
    // Last week's Friday does not count.
    await startDay("2026-11-13", { startTime: "08:00", slotMinutes: 60, endTime: "10:00" }, now);
    await work("2026-11-13", ["08:00", "09:00"], projeto);
    await startDay("2026-11-16", { startTime: "08:00", slotMinutes: 60, endTime: "11:00" }, now);
    await work("2026-11-16", ["08:00", "09:00"], projeto);
    await work("2026-11-16", ["10:00"], chamados);
    await startDay(wednesday, { startTime: "08:00", slotMinutes: 60, endTime: null }, now);
    await work(wednesday, ["08:00"], chamados);

    const { kpis, timeWeek } = await getDashboard(wednesday, noon);

    // Worked is presence minus breaks (plan 031); today's open day counts up to noon.
    expect(kpis.workedThisWeek).toBe(420);
    expect(timeWeek.worked).toBe(420);
    expect(timeWeek.bars.map((bar) => bar.minutes)).toEqual([180, 0, 240, 0, 0, 0, 0]);
    expect(timeWeek.bars[2]).toMatchObject({ date: wednesday, isToday: true });
    expect(timeWeek.categories).toEqual([
      { name: "Chamados", minutes: 120, percent: 50, tone: 1 },
      { name: "Projeto", minutes: 120, percent: 50, tone: 2 },
    ]);
  });

  it("has an empty week without time records", async () => {
    const { kpis, timeWeek } = await getDashboard(wednesday, noon);

    expect(kpis.workedThisWeek).toBe(0);
    expect(timeWeek).toMatchObject({ worked: 0, days: 0, categories: [] });
  });

  it("is not the first use when only time was recorded", async () => {
    await startDay(wednesday, { startTime: "08:00", slotMinutes: 60, endTime: "09:00" }, now);

    expect((await getDashboard(wednesday, noon)).firstUse).toBe(false);
  });
});
