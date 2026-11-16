import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { GoalNotFoundError, createGoal, deleteGoal } from "@/modules/goals/service";
import type { RoutineInput } from "@/modules/routines/schemas";
import {
  FutureDateError,
  RoutineNotFoundError,
  RoutineNotScheduledError,
  RoutineNotStartedError,
  clearLog,
  createRoutine,
  deleteRoutine,
  endRoutine,
  getAdherence,
  getRoutine,
  getRoutineHistory,
  listRoutines,
  listRoutinesForDay,
  logRoutine,
  updateRoutine,
} from "@/modules/routines/service";

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
