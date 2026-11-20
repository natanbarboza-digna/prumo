import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { updateCategory } from "@/modules/categories/service";
import { GoalNotFoundError, createGoal, deleteGoal } from "@/modules/goals/service";
import {
  ActionFinishedError,
  CategoryDisallowsRoutineError,
  CycleClosedError,
  PdiActionNotFoundError,
  closeCycle,
  getActionDetail,
  updateAction,
} from "@/modules/pdi/service";
import type { RoutineInput } from "@/modules/routines/schemas";
import {
  FutureDateError,
  RoutineAlreadyLinkedError,
  RoutineEndedError,
  RoutineNotFoundError,
  RoutineNotScheduledError,
  RoutineNotStartedError,
  SkipNotAllowedError,
  clearLog,
  createRoutine,
  deleteRoutine,
  endRoutine,
  getAdherence,
  getRoutine,
  getRoutineHistory,
  getRoutineMonth,
  getRoutineStreak,
  linkRoutine,
  listLinkableRoutines,
  listRoutines,
  listRoutinesForDay,
  logRoutine,
  unlinkRoutine,
  updateRoutine,
} from "@/modules/routines/service";
import { pdiActionFixture } from "@/test/pdi-fixtures";

const MISSING_ID = "0190a3e4-0000-7000-8000-000000000000";

// 2026-11-16 is a Monday.
const today = "2026-11-16";

function routineInput(overrides: Partial<RoutineInput> = {}): RoutineInput {
  return {
    title: "Rotina",
    description: null,
    weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    timeOfDay: null,
    startDate: "2026-11-01",
    endDate: null,
    goalId: null,
    timesPerWeek: null,
    ...overrides,
  };
}

async function goal(title = "Objetivo") {
  return createGoal({ title, description: null, status: "NOT_STARTED", targetDate: null });
}

const done = { status: "DONE" as const, note: null };
const skipped = { status: "SKIPPED" as const, note: null };

describe("routines", () => {
  it("creates a routine without a goal, keeping weekdays and dates", async () => {
    const routine = await createRoutine(
      routineInput({
        title: "Ler",
        weekdays: ["MON", "FRI"],
        timeOfDay: "07:30",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      }),
    );

    expect(routine).toMatchObject({
      title: "Ler",
      weekdays: ["MON", "FRI"],
      timeOfDay: "07:30",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      goal: null,
    });
  });

  it("creates a routine linked to a goal", async () => {
    const linked = await goal("Saúde");

    const routine = await createRoutine(routineInput({ goalId: linked.id }));

    expect(routine.goal).toEqual({ id: linked.id, title: "Saúde" });
  });

  it("rejects a goal that does not exist", async () => {
    await expect(createRoutine(routineInput({ goalId: MISSING_ID }))).rejects.toBeInstanceOf(
      GoalNotFoundError,
    );
  });

  it("updates a routine and can clear its goal", async () => {
    const linked = await goal();
    const routine = await createRoutine(routineInput({ goalId: linked.id }));

    const updated = await updateRoutine(
      routine.id,
      routineInput({ title: "Nova", weekdays: ["SAT"], goalId: null }),
    );

    expect(updated).toMatchObject({ title: "Nova", weekdays: ["SAT"], goal: null });
  });

  it("separates active, upcoming and ended routines", async () => {
    const active = await createRoutine(routineInput({ title: "Ativa" }));
    const upcoming = await createRoutine(
      routineInput({ title: "Futura", startDate: "2026-12-01" }),
    );
    const endsToday = await createRoutine(routineInput({ title: "Termina hoje", endDate: today }));
    const ended = await createRoutine(routineInput({ title: "Encerrada", endDate: "2026-11-15" }));

    const activeIds = (await listRoutines({ state: "active", today })).map((r) => r.id);
    const endedIds = (await listRoutines({ state: "ended", today })).map((r) => r.id);

    expect(activeIds.sort()).toEqual([active.id, upcoming.id, endsToday.id].sort());
    expect(endedIds).toEqual([ended.id]);
  });

  it("orders by time of day, routines without a time last, then by title", async () => {
    await createRoutine(routineInput({ title: "Sem horário" }));
    await createRoutine(routineInput({ title: "B noite", timeOfDay: "21:00" }));
    await createRoutine(routineInput({ title: "A noite", timeOfDay: "21:00" }));
    await createRoutine(routineInput({ title: "Manhã", timeOfDay: "06:30" }));

    const titles = (await listRoutines({ state: "active", today })).map((r) => r.title);

    expect(titles).toEqual(["Manhã", "A noite", "B noite", "Sem horário"]);
  });

  it("filters by goal and includes the 30-day adherence", async () => {
    const linked = await goal();
    const mine = await createRoutine(routineInput({ goalId: linked.id, startDate: "2026-11-15" }));
    await createRoutine(routineInput());
    await logRoutine(mine.id, "2026-11-15", done, today);

    const routines = await listRoutines({ goalId: linked.id, today });

    expect(routines.map((r) => r.id)).toEqual([mine.id]);
    expect(routines[0]!.adherence).toMatchObject({ scheduled: 1, done: 1, rate: 100 });
  });

  it("ends a routine today", async () => {
    const routine = await createRoutine(routineInput());

    const ended = await endRoutine(routine.id, today);

    expect(ended.endDate).toBe(today);
  });

  it("keeps the end date of a routine that already ended", async () => {
    const routine = await createRoutine(routineInput({ endDate: "2026-11-10" }));

    expect((await endRoutine(routine.id, today)).endDate).toBe("2026-11-10");
  });

  it("refuses to end a routine that has not started", async () => {
    const routine = await createRoutine(routineInput({ startDate: "2026-11-17" }));

    await expect(endRoutine(routine.id, today)).rejects.toBeInstanceOf(RoutineNotStartedError);
  });

  it("deletes a routine together with its logs", async () => {
    const routine = await createRoutine(routineInput());
    await logRoutine(routine.id, today, done, today);

    await deleteRoutine(routine.id);

    await expect(getRoutine(routine.id)).rejects.toBeInstanceOf(RoutineNotFoundError);
    expect(await db.routineLog.count()).toBe(0);
  });

  it("keeps the routine and clears the link when its goal is deleted", async () => {
    const linked = await goal();
    const routine = await createRoutine(routineInput({ goalId: linked.id }));

    await deleteGoal(linked.id);

    expect((await getRoutine(routine.id)).goal).toBeNull();
  });

  it.each([MISSING_ID, "not-a-uuid"])("throws RoutineNotFoundError for %j", async (id) => {
    await expect(getRoutine(id)).rejects.toBeInstanceOf(RoutineNotFoundError);
    await expect(updateRoutine(id, routineInput())).rejects.toBeInstanceOf(RoutineNotFoundError);
    await expect(deleteRoutine(id)).rejects.toBeInstanceOf(RoutineNotFoundError);
    await expect(endRoutine(id, today)).rejects.toBeInstanceOf(RoutineNotFoundError);
    await expect(logRoutine(id, today, done, today)).rejects.toBeInstanceOf(RoutineNotFoundError);
    await expect(clearLog(id, today)).rejects.toBeInstanceOf(RoutineNotFoundError);
    await expect(getRoutineHistory(id, today)).rejects.toBeInstanceOf(RoutineNotFoundError);
  });
});

describe("daily logs", () => {
  it("lists only the routines scheduled on the day, with that day's log", async () => {
    const monday = await createRoutine(routineInput({ title: "Segunda", weekdays: ["MON"] }));
    await createRoutine(routineInput({ title: "Terça", weekdays: ["TUE"] }));
    await createRoutine(routineInput({ title: "Futura", startDate: "2026-11-17" }));
    await createRoutine(routineInput({ title: "Encerrada", endDate: "2026-11-15" }));
    const daily = await createRoutine(routineInput({ title: "Diária", timeOfDay: "06:00" }));
    await logRoutine(monday.id, today, { status: "SKIPPED", note: "Chuva" }, today);
    await logRoutine(monday.id, "2026-11-09", done, today);

    const items = await listRoutinesForDay(today);

    expect(items.map((item) => item.routine.id)).toEqual([daily.id, monday.id]);
    expect(items[0]!.log).toBeNull();
    expect(items[1]!.log).toMatchObject({ date: today, status: "SKIPPED", note: "Chuva" });
  });

  it("replaces the log when the same day is logged again", async () => {
    const routine = await createRoutine(routineInput());
    await logRoutine(routine.id, today, skipped, today);

    const log = await logRoutine(
      routine.id,
      today,
      { status: "DONE", note: "Feito à noite" },
      today,
    );

    expect(log).toMatchObject({ status: "DONE", note: "Feito à noite" });
    expect(await db.routineLog.count()).toBe(1);
  });

  it("refuses a future date", async () => {
    const routine = await createRoutine(routineInput());

    await expect(logRoutine(routine.id, "2026-11-17", done, today)).rejects.toBeInstanceOf(
      FutureDateError,
    );
  });

  it("refuses a day the routine is not scheduled on", async () => {
    const routine = await createRoutine(routineInput({ weekdays: ["TUE"] }));

    await expect(logRoutine(routine.id, today, done, today)).rejects.toBeInstanceOf(
      RoutineNotScheduledError,
    );
  });

  it("clears a log", async () => {
    const routine = await createRoutine(routineInput());
    await logRoutine(routine.id, today, done, today);

    await clearLog(routine.id, today);

    expect((await listRoutinesForDay(today))[0]!.log).toBeNull();
  });

  it("clearing a day without a log does nothing", async () => {
    const routine = await createRoutine(routineInput());

    await expect(clearLog(routine.id, today)).resolves.toBeUndefined();
  });

  it("returns the scheduled days of the last 14, newest first, never before the start", async () => {
    const routine = await createRoutine(
      routineInput({ weekdays: ["MON", "WED"], startDate: "2026-11-04" }),
    );
    await logRoutine(routine.id, "2026-11-09", done, today);

    const history = await getRoutineHistory(routine.id, today);

    expect(history.map((day) => day.date)).toEqual([
      "2026-11-16",
      "2026-11-11",
      "2026-11-09",
      "2026-11-04",
    ]);
    expect(history[2]!.log).toMatchObject({ status: "DONE" });
    expect(history[0]!.log).toBeNull();
  });

  it("limits the history to a 14-day window", async () => {
    const routine = await createRoutine(routineInput({ startDate: "2026-01-01" }));

    const history = await getRoutineHistory(routine.id, today);

    expect(history).toHaveLength(14);
    expect(history.at(-1)!.date).toBe("2026-11-03");
  });

  it("computes the adherence from the stored logs", async () => {
    const routine = await createRoutine(routineInput({ startDate: "2026-11-13" }));
    await logRoutine(routine.id, "2026-11-13", done, today);
    await logRoutine(routine.id, "2026-11-14", skipped, today);
    await logRoutine(routine.id, today, done, today);

    expect(await getAdherence(routine.id, today)).toEqual({
      scheduled: 4,
      done: 2,
      skipped: 1,
      missed: 1,
      rate: 50,
    });
  });
});

describe("routines created from a PDI action", () => {
  it("links the routine to an action whose category allows routines", async () => {
    const { action, cycle } = await pdiActionFixture();

    const routine = await createRoutine(routineInput(), action.id);

    expect(routine.pdiAction).toEqual({
      id: action.id,
      title: action.title,
      cycleId: cycle.id,
      cycleClosed: false,
    });
    expect((await getRoutine(routine.id)).pdiAction?.id).toBe(action.id);
  });

  it("allows more than one routine per action", async () => {
    const { action } = await pdiActionFixture();

    await createRoutine(routineInput({ title: "Manhã" }), action.id);
    await createRoutine(routineInput({ title: "Noite" }), action.id);

    expect(await db.routine.count({ where: { pdiActionId: action.id } })).toBe(2);
  });

  it("rejects an action whose category does not allow routines", async () => {
    const { action } = await pdiActionFixture({ allowsRoutine: false });

    await expect(createRoutine(routineInput(), action.id)).rejects.toBeInstanceOf(
      CategoryDisallowsRoutineError,
    );
  });

  it.each(["DONE", "CANCELLED"] as const)("rejects an action with status %s", async (status) => {
    const { action } = await pdiActionFixture({ status });

    await expect(createRoutine(routineInput(), action.id)).rejects.toBeInstanceOf(
      ActionFinishedError,
    );
  });

  it("rejects an action of a closed cycle", async () => {
    const { action, cycle } = await pdiActionFixture();
    await closeCycle(cycle.id);

    await expect(createRoutine(routineInput(), action.id)).rejects.toBeInstanceOf(CycleClosedError);
  });

  it("rejects an action that does not exist", async () => {
    await expect(createRoutine(routineInput(), MISSING_ID)).rejects.toBeInstanceOf(
      PdiActionNotFoundError,
    );
    expect(await db.routine.count()).toBe(0);
  });

  it("keeps the link when the routine is edited", async () => {
    const { action } = await pdiActionFixture();
    const routine = await createRoutine(routineInput(), action.id);

    const updated = await updateRoutine(routine.id, routineInput({ title: "Outro título" }));

    expect(updated.pdiAction?.id).toBe(action.id);
  });

  it("keeps existing routines when the category stops allowing them, but blocks new ones", async () => {
    const { action, category } = await pdiActionFixture();
    const routine = await createRoutine(routineInput(), action.id);

    await updateCategory(category.id, { name: category.name, allowsRoutine: false });

    expect((await getRoutine(routine.id)).pdiAction?.id).toBe(action.id);
    await expect(createRoutine(routineInput(), action.id)).rejects.toBeInstanceOf(
      CategoryDisallowsRoutineError,
    );
  });

  it("keeps existing routines when the action changes category", async () => {
    const { action, area } = await pdiActionFixture();
    const other = await pdiActionFixture({ allowsRoutine: false });
    const routine = await createRoutine(routineInput(), action.id);

    await updateAction(action.id, {
      areaId: area.id,
      categoryId: other.category.id,
      title: action.title,
      description: null,
      expectedResult: null,
      dueDate: null,
      status: "IN_PROGRESS",
      evidence: null,
      managerComment: null,
      goalId: null,
    });

    expect((await getRoutine(routine.id)).pdiAction?.id).toBe(action.id);
  });
});

describe("linking an existing routine to a PDI action (plan 020)", () => {
  it("lists the routines without a link that have not ended, by title", async () => {
    const { action } = await pdiActionFixture();
    await createRoutine(routineInput({ title: "Vinculada" }), action.id);
    await createRoutine(routineInput({ title: "Encerrada", endDate: "2026-11-15" }));
    await createRoutine(routineInput({ title: "Termina hoje", endDate: today }));
    await createRoutine(routineInput({ title: "Futura", startDate: "2026-12-01" }));
    await createRoutine(routineInput({ title: "Ler" }));

    const routines = await listLinkableRoutines(today);

    expect(routines.map((routine) => routine.title)).toEqual(["Futura", "Ler", "Termina hoje"]);
  });

  it("links the routine, and the action shows it as evidence", async () => {
    const { action, cycle } = await pdiActionFixture();
    const routine = await createRoutine(routineInput({ title: "Ler" }));
    await logRoutine(routine.id, "2026-11-10", done, today);

    const linked = await linkRoutine(action.id, routine.id, today);

    expect(linked.pdiAction).toEqual({
      id: action.id,
      title: action.title,
      cycleId: cycle.id,
      cycleClosed: false,
    });
    const detail = await getActionDetail(action.id, today);
    expect(detail.routines.map(({ routine }) => routine.id)).toEqual([routine.id]);
    expect(detail.logs).toMatchObject([{ routineId: routine.id, date: "2026-11-10" }]);
  });

  it("follows the same rule as creating a routine from the action", async () => {
    const routine = await createRoutine(routineInput());

    const category = await pdiActionFixture({ allowsRoutine: false });
    await expect(linkRoutine(category.action.id, routine.id, today)).rejects.toBeInstanceOf(
      CategoryDisallowsRoutineError,
    );

    const finished = await pdiActionFixture({ status: "DONE" });
    await expect(linkRoutine(finished.action.id, routine.id, today)).rejects.toBeInstanceOf(
      ActionFinishedError,
    );

    const closed = await pdiActionFixture();
    await closeCycle(closed.cycle.id);
    await expect(linkRoutine(closed.action.id, routine.id, today)).rejects.toBeInstanceOf(
      CycleClosedError,
    );

    await expect(linkRoutine(MISSING_ID, routine.id, today)).rejects.toBeInstanceOf(
      PdiActionNotFoundError,
    );
    expect((await getRoutine(routine.id)).pdiAction).toBeNull();
  });

  it("rejects a routine that is already linked, that ended or that does not exist", async () => {
    const { action } = await pdiActionFixture();
    const other = await pdiActionFixture();
    const linked = await createRoutine(routineInput(), other.action.id);
    const ended = await createRoutine(routineInput({ endDate: "2026-11-15" }));

    await expect(linkRoutine(action.id, linked.id, today)).rejects.toBeInstanceOf(
      RoutineAlreadyLinkedError,
    );
    await expect(linkRoutine(action.id, ended.id, today)).rejects.toBeInstanceOf(RoutineEndedError);
    await expect(linkRoutine(action.id, MISSING_ID, today)).rejects.toBeInstanceOf(
      RoutineNotFoundError,
    );
    expect((await getRoutine(linked.id)).pdiAction?.id).toBe(other.action.id);
  });

  it("unlinks the routine and keeps it with its logs", async () => {
    const { action } = await pdiActionFixture();
    const routine = await createRoutine(routineInput(), action.id);
    await logRoutine(routine.id, "2026-11-10", done, today);

    const unlinked = await unlinkRoutine(routine.id);

    expect(unlinked.pdiAction).toBeNull();
    expect((await getActionDetail(action.id, today)).routines).toEqual([]);
    expect(await db.routineLog.count({ where: { routineId: routine.id } })).toBe(1);
  });

  it("unlinks from a finished action of an open cycle, and does nothing without a link", async () => {
    const { action } = await pdiActionFixture();
    const routine = await createRoutine(routineInput(), action.id);
    await db.pdiAction.update({ where: { id: action.id }, data: { status: "DONE" } });

    expect((await unlinkRoutine(routine.id)).pdiAction).toBeNull();
    expect((await unlinkRoutine(routine.id)).pdiAction).toBeNull();
  });

  it("does not unlink from a closed cycle, which is read-only", async () => {
    const { action, cycle } = await pdiActionFixture();
    const routine = await createRoutine(routineInput(), action.id);
    await closeCycle(cycle.id);

    expect((await getRoutine(routine.id)).pdiAction?.cycleClosed).toBe(true);
    await expect(unlinkRoutine(routine.id)).rejects.toBeInstanceOf(CycleClosedError);
    expect((await getRoutine(routine.id)).pdiAction?.id).toBe(action.id);
  });

  it("rejects a routine that does not exist", async () => {
    await expect(unlinkRoutine(MISSING_ID)).rejects.toBeInstanceOf(RoutineNotFoundError);
  });
});

describe("getRoutineMonth", () => {
  it("builds the asked month from that month's logs only", async () => {
    const routine = await createRoutine(routineInput({ startDate: "2026-10-01" }));
    await logRoutine(routine.id, "2026-10-31", { status: "DONE", note: null }, today);
    await logRoutine(routine.id, "2026-11-01", { status: "DONE", note: null }, today);
    await logRoutine(routine.id, "2026-11-02", { status: "SKIPPED", note: null }, today);

    const november = await getRoutineMonth(routine.id, "2026-11", today);

    const day = (date: string) => november.weeks.flat().find((item) => item.date === date);
    expect(day("2026-10-31")?.state).toBe("OUTSIDE");
    expect(day("2026-11-01")?.state).toBe("DONE");
    expect(day("2026-11-02")?.state).toBe("SKIPPED");
    expect(day("2026-11-03")?.state).toBe("MISSED");
    expect(november.adherence).toMatchObject({ scheduled: 15, done: 1, skipped: 1 });

    const october = await getRoutineMonth(routine.id, "2026-10", today);
    expect(october.adherence).toMatchObject({ scheduled: 31, done: 1, skipped: 0, missed: 30 });
  });
});

describe("weekly goal routines (plan 017)", () => {
  const allDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
  const weekly = () =>
    routineInput({
      title: "Exercício",
      weekdays: [...allDays],
      timesPerWeek: 3,
      // A Monday: no partial first week.
      startDate: "2026-11-02",
    });
  const done = { status: "DONE" as const, note: null };

  it("stores the goal, and editing switches the kind both ways keeping the logs", async () => {
    const routine = await createRoutine(weekly());
    expect(routine).toMatchObject({ timesPerWeek: 3, weekdays: [...allDays] });
    await logRoutine(routine.id, "2026-11-03", done, today);

    const fixed = await updateRoutine(
      routine.id,
      routineInput({ title: "Exercício", weekdays: ["MON", "WED"], timesPerWeek: null }),
    );
    expect(fixed).toMatchObject({ timesPerWeek: null, weekdays: ["MON", "WED"] });

    const back = await updateRoutine(routine.id, weekly());
    expect(back.timesPerWeek).toBe(3);
    await expect(getRoutineHistory(routine.id, today)).resolves.toContainEqual({
      date: "2026-11-03",
      log: { date: "2026-11-03", status: "DONE", note: null },
    });
  });

  it("accepts done on any day and refuses skipped", async () => {
    const routine = await createRoutine(weekly());

    await expect(logRoutine(routine.id, "2026-11-08", done, today)).resolves.toMatchObject({
      status: "DONE",
    });
    await expect(
      logRoutine(routine.id, "2026-11-09", { status: "SKIPPED", note: "viagem" }, today),
    ).rejects.toThrow(SkipNotAllowedError);
  });

  it("shows up every day on Today, with the progress of the week", async () => {
    const routine = await createRoutine(weekly());
    // Week of Monday the 16th: done on the 16th; a log of the week before does not count.
    await logRoutine(routine.id, "2026-11-15", done, today);
    await logRoutine(routine.id, "2026-11-16", done, today);
    const daily = await createRoutine(routineInput({ title: "Ler" }));

    const items = await listRoutinesForDay("2026-11-16");

    expect(items.find((item) => item.routine.id === routine.id)).toMatchObject({
      log: { status: "DONE" },
      week: { done: 1, target: 3 },
    });
    expect(items.find((item) => item.routine.id === daily.id)?.week).toBeNull();
  });

  it("counts adherence in goal days, adding up with fixed-days routines", async () => {
    const routine = await createRoutine(weekly());
    for (const date of ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-10"]) {
      await logRoutine(routine.id, date, done, today);
    }

    // Weeks of the 2nd (3 of 3) and of the 9th (1 of 3); the current week has nothing yet.
    await expect(getAdherence(routine.id, today)).resolves.toMatchObject({
      scheduled: 6,
      done: 4,
      missed: 2,
    });
  });
});

describe("routine streaks (plan 019)", () => {
  const done = { status: "DONE" as const, note: null };

  it("comes with the routines of a day, the list and the routine page", async () => {
    // Today, 2026-11-16, is a Monday; done on the 13th, 14th and 15th.
    const routine = await createRoutine(routineInput({ title: "Ler" }));
    for (const date of ["2026-11-13", "2026-11-14", "2026-11-15"]) {
      await logRoutine(routine.id, date, done, today);
    }
    const streak = { unit: "DAYS", current: 3, best: 3 };

    const [day] = await listRoutinesForDay(today);
    expect(day?.streak).toEqual(streak);
    const [summary] = await listRoutines({ today });
    expect(summary?.streak).toEqual(streak);
    await expect(getRoutineStreak(routine.id, today)).resolves.toEqual(streak);
  });
});
