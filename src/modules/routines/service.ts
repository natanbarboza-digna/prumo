import type { Prisma, RoutineLog as RoutineLogRow } from "@/generated/prisma/client";
import type { RoutineLogStatus, Weekday } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { addDays, eachDay, formatDateOnly, parseDateOnly, weekdayOf } from "@/lib/dates";
import { isUuid } from "@/lib/form-fields";
import { isRecordNotFound } from "@/lib/prisma-errors";
import { GoalNotFoundError } from "@/modules/goals/service";
import {
  ActionFinishedError,
  CategoryDisallowsRoutineError,
  CycleClosedError,
  PdiActionNotFoundError,
  routineBlocker,
} from "@/modules/pdi/service";
import {
  ADHERENCE_DAYS,
  type Adherence,
  HISTORY_DAYS,
  type MonthCalendar,
  type RoutineStreak,
  type WeekProgress,
  computeAdherence,
  isScheduledOn,
  monthCalendar,
  routineStateOn,
  routineStreak,
  weekProgress,
} from "@/modules/routines/rules";
import type { RoutineInput, RoutineLogInput } from "@/modules/routines/schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Routine = {
  id: string;
  title: string;
  description: string | null;
  weekdays: Weekday[];
  /** Weekly goal (plan 017): N days per week, any days. Null for fixed days. */
  timesPerWeek: number | null;
  timeOfDay: string | null;
  startDate: string;
  endDate: string | null;
  goal: { id: string; title: string } | null;
  /**
   * The PDI action the routine puts into practice, if any. `cycleClosed`: the
   * action's cycle is read-only, so the link cannot be undone (plan 020).
   */
  pdiAction: { id: string; title: string; cycleId: string; cycleClosed: boolean } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RoutineLog = { date: string; status: RoutineLogStatus; note: string | null };

/** With the 30-day adherence and the streak (plan 019). */
export type RoutineSummary = Routine & { adherence: Adherence; streak: RoutineStreak };

/**
 * A day on the "Today" screen, with its log if any. `week`: the progress of a
 * weekly-goal routine in that day's week; null for fixed-days routines.
 */
export type RoutineDay = {
  routine: Routine;
  log: RoutineLog | null;
  week: WeekProgress | null;
  streak: RoutineStreak;
};
export type HistoryDay = { date: string; log: RoutineLog | null };

export class SkipNotAllowedError extends Error {
  constructor(routineId: string) {
    super(`A weekly-goal routine has no skipped days: ${routineId}`);
    this.name = "SkipNotAllowedError";
  }
}

export class RoutineNotFoundError extends Error {
  constructor(id: string) {
    super(`Routine not found: ${id}`);
    this.name = "RoutineNotFoundError";
  }
}

export class RoutineNotStartedError extends Error {
  constructor(id: string) {
    super(`Routine has not started yet: ${id}`);
    this.name = "RoutineNotStartedError";
  }
}

export class FutureDateError extends Error {
  constructor(date: string) {
    super(`Cannot log a future date: ${date}`);
    this.name = "FutureDateError";
  }
}

export class RoutineAlreadyLinkedError extends Error {
  constructor(id: string) {
    super(`Routine is already linked to a PDI action: ${id}`);
    this.name = "RoutineAlreadyLinkedError";
  }
}

export class RoutineEndedError extends Error {
  constructor(id: string) {
    super(`Routine has already ended: ${id}`);
    this.name = "RoutineEndedError";
  }
}

export class RoutineNotScheduledError extends Error {
  constructor(id: string, date: string) {
    super(`Routine ${id} is not scheduled on ${date}`);
    this.name = "RoutineNotScheduledError";
  }
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

const routineInclude = {
  goal: { select: { id: true, title: true } },
  pdiAction: {
    select: {
      id: true,
      title: true,
      area: { select: { cycleId: true, cycle: { select: { status: true } } } },
    },
  },
} satisfies Prisma.RoutineInclude;

// Earliest time first, routines without a time last, then alphabetical.
const routineOrder = [
  { timeOfDay: { sort: "asc", nulls: "last" } },
  { title: "asc" },
] satisfies Prisma.RoutineOrderByWithRelationInput[];

type RoutineRow = Prisma.RoutineGetPayload<{ include: typeof routineInclude }>;

export async function listRoutines(filter: {
  today: string;
  state?: "active" | "ended";
  goalId?: string;
}): Promise<RoutineSummary[]> {
  const { today } = filter;
  const where: Prisma.RoutineWhereInput = {};
  if (filter.goalId) where.goalId = filter.goalId;
  // "active" includes the routines that have not started yet.
  if (filter.state === "active") {
    where.OR = [{ endDate: null }, { endDate: { gte: parseDateOnly(today) } }];
  }
  if (filter.state === "ended") where.endDate = { lt: parseDateOnly(today) };

  const period = adherencePeriod(today);
  const rows = await db.routine.findMany({
    where,
    include: {
      ...routineInclude,
      // The whole history: the streak can go back to the routine's start.
      logs: true,
    },
    orderBy: routineOrder,
  });

  return rows.map((row) => {
    const routine = toRoutine(row);
    const logs = row.logs.map(toLog);
    return {
      ...routine,
      adherence: computeAdherence(routine, logs, period, today),
      streak: routineStreak(routine, logs, today),
    };
  });
}

export async function getRoutine(id: string): Promise<Routine> {
  if (!isUuid(id)) throw new RoutineNotFoundError(id);
  const row = await db.routine.findUnique({ where: { id }, include: routineInclude });
  if (!row) throw new RoutineNotFoundError(id);
  return toRoutine(row);
}

/**
 * Creates a routine, optionally linked to the PDI action it puts into practice.
 * The link is only set here: editing a routine never changes it.
 */
export async function createRoutine(
  input: RoutineInput,
  pdiActionId: string | null = null,
): Promise<Routine> {
  await assertGoalExists(input.goalId);
  if (pdiActionId !== null) await assertActionTakesRoutine(pdiActionId);
  const row = await db.routine.create({
    data: { ...toData(input), pdiActionId },
    include: routineInclude,
  });
  return toRoutine(row);
}

export async function updateRoutine(id: string, input: RoutineInput): Promise<Routine> {
  if (!isUuid(id)) throw new RoutineNotFoundError(id);
  await assertGoalExists(input.goalId);
  return withNotFound(id, async () =>
    toRoutine(
      await db.routine.update({ where: { id }, data: toData(input), include: routineInclude }),
    ),
  );
}

export async function deleteRoutine(id: string): Promise<void> {
  if (!isUuid(id)) throw new RoutineNotFoundError(id);
  await withNotFound(id, () => db.routine.delete({ where: { id } }));
}

/**
 * Ends the routine today: today still counts, tomorrow it is "ended". A routine
 * that already ended keeps its end date; one that has not started yet should be
 * deleted instead.
 */
export async function endRoutine(id: string, today: string): Promise<Routine> {
  const routine = await getRoutine(id);
  const state = routineStateOn(routine, today);
  if (state === "UPCOMING") throw new RoutineNotStartedError(id);
  if (state === "ENDED") return routine;
  const row = await db.routine.update({
    where: { id },
    data: { endDate: parseDateOnly(today) },
    include: routineInclude,
  });
  return toRoutine(row);
}

// ---------------------------------------------------------------------------
// Link to a PDI action (plan 020)
// ---------------------------------------------------------------------------

/** Routines that can be linked to a PDI action: no link yet and not ended. */
export async function listLinkableRoutines(today: string): Promise<Routine[]> {
  const rows = await db.routine.findMany({
    where: {
      pdiActionId: null,
      OR: [{ endDate: null }, { endDate: { gte: parseDateOnly(today) } }],
    },
    include: routineInclude,
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });
  return rows.map(toRoutine);
}

/**
 * Links an existing routine to a PDI action. The action must take routines (the
 * same rule as creating one from it); the routine must be free and not ended.
 */
export async function linkRoutine(
  actionId: string,
  routineId: string,
  today: string,
): Promise<Routine> {
  await assertActionTakesRoutine(actionId);
  const routine = await getRoutine(routineId);
  if (routine.pdiAction !== null) throw new RoutineAlreadyLinkedError(routineId);
  if (routineStateOn(routine, today) === "ENDED") throw new RoutineEndedError(routineId);
  const row = await db.routine.update({
    where: { id: routineId },
    data: { pdiActionId: actionId },
    include: routineInclude,
  });
  return toRoutine(row);
}

/**
 * Removes the routine's link to its PDI action. The routine and its logs stay;
 * they just stop counting as evidence. A closed cycle is read-only.
 */
export async function unlinkRoutine(routineId: string): Promise<Routine> {
  const routine = await getRoutine(routineId);
  if (routine.pdiAction === null) return routine;
  if (routine.pdiAction.cycleClosed) throw new CycleClosedError(routine.pdiAction.cycleId);
  const row = await db.routine.update({
    where: { id: routineId },
    data: { pdiActionId: null },
    include: routineInclude,
  });
  return toRoutine(row);
}

// ---------------------------------------------------------------------------
// Daily logs
// ---------------------------------------------------------------------------

export async function listRoutinesForDay(date: string): Promise<RoutineDay[]> {
  const day = parseDateOnly(date);
  // The period and weekday filters run in SQL; `has` checks the enum array.
  const rows = await db.routine.findMany({
    where: {
      startDate: { lte: day },
      OR: [{ endDate: null }, { endDate: { gte: day } }],
      weekdays: { has: weekdayOf(date) },
    },
    // The whole week's logs: a weekly goal shows its progress in the week.
    include: {
      ...routineInclude,
      // The whole history: the week's progress and the streak (plan 019).
      logs: true,
    },
    orderBy: routineOrder,
  });
  return rows.map((row) => {
    const routine = toRoutine(row);
    const logs = row.logs.map(toLog);
    return {
      routine,
      log: logs.find((log) => log.date === date) ?? null,
      week: routine.timesPerWeek ? weekProgress(routine, logs, date) : null,
      streak: routineStreak(routine, logs, date),
    };
  });
}

/** Creates or replaces the log of one day. */
export async function logRoutine(
  routineId: string,
  date: string,
  input: RoutineLogInput,
  today: string,
): Promise<RoutineLog> {
  const routine = await getRoutine(routineId);
  if (date > today) throw new FutureDateError(date);
  if (!isScheduledOn(routine, date)) throw new RoutineNotScheduledError(routineId, date);
  // A weekly goal has no required day, so there is nothing to skip (plan 017).
  if (routine.timesPerWeek && input.status === "SKIPPED") throw new SkipNotAllowedError(routineId);

  const day = parseDateOnly(date);
  const row = await db.routineLog.upsert({
    where: { routineId_date: { routineId, date: day } },
    create: { routineId, date: day, ...input },
    update: input,
  });
  return toLog(row);
}

export async function clearLog(routineId: string, date: string): Promise<void> {
  await getRoutine(routineId);
  // deleteMany does not fail when there is nothing to delete.
  await db.routineLog.deleteMany({ where: { routineId, date: parseDateOnly(date) } });
}

/** The scheduled days of the last 14 (today included), newest first. */
export async function getRoutineHistory(
  routineId: string,
  today: string,
  days = HISTORY_DAYS,
): Promise<HistoryDay[]> {
  const routine = await getRoutine(routineId);
  const from = addDays(today, -(days - 1));
  const logs = await logsBetween(routineId, from, today);
  const logByDate = new Map(logs.map((log) => [log.date, log]));

  return eachDay(from, today)
    .filter((date) => isScheduledOn(routine, date))
    .reverse()
    .map((date) => ({ date, log: logByDate.get(date) ?? null }));
}

/** One month of the routine for the calendar (plan 016). `month` is "YYYY-MM". */
export async function getRoutineMonth(
  routineId: string,
  month: string,
  today: string,
): Promise<MonthCalendar> {
  const routine = await getRoutine(routineId);
  const logs = await logsBetween(routineId, `${month}-01`, addDays(`${month}-01`, 31));
  return monthCalendar(routine, logs, month, today);
}

/** The streak of one routine, from its whole history (plan 019). */
export async function getRoutineStreak(routineId: string, today: string): Promise<RoutineStreak> {
  const routine = await getRoutine(routineId);
  const logs = await logsBetween(routineId, routine.startDate, today);
  return routineStreak(routine, logs, today);
}

export async function getAdherence(
  routineId: string,
  today: string,
  days = ADHERENCE_DAYS,
): Promise<Adherence> {
  const routine = await getRoutine(routineId);
  const period = adherencePeriod(today, days);
  const logs = await logsBetween(routineId, period.from, period.to);
  return computeAdherence(routine, logs, period, today);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adherencePeriod(today: string, days = ADHERENCE_DAYS) {
  return { from: addDays(today, -(days - 1)), to: today };
}

async function logsBetween(routineId: string, from: string, to: string): Promise<RoutineLog[]> {
  const rows = await db.routineLog.findMany({
    where: { routineId, date: { gte: parseDateOnly(from), lte: parseDateOnly(to) } },
  });
  return rows.map(toLog);
}

async function assertGoalExists(goalId: string | null): Promise<void> {
  if (goalId === null) return;
  const count = await db.goal.count({ where: { id: goalId } });
  if (count === 0) throw new GoalNotFoundError(goalId);
}

/** The rule lives here, not only in the hidden button: see the PDI errors. */
async function assertActionTakesRoutine(actionId: string): Promise<void> {
  if (!isUuid(actionId)) throw new PdiActionNotFoundError(actionId);
  const action = await db.pdiAction.findUnique({
    where: { id: actionId },
    select: {
      status: true,
      category: { select: { allowsRoutine: true } },
      area: { select: { cycle: { select: { id: true, status: true } } } },
    },
  });
  if (!action) throw new PdiActionNotFoundError(actionId);
  switch (routineBlocker(action, action.area.cycle.status)) {
    case "CYCLE_CLOSED":
      throw new CycleClosedError(action.area.cycle.id);
    case "ACTION_FINISHED":
      throw new ActionFinishedError(actionId);
    case "CATEGORY":
      throw new CategoryDisallowsRoutineError(actionId);
  }
}

async function withNotFound<T>(id: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isRecordNotFound(error)) throw new RoutineNotFoundError(id);
    throw error;
  }
}

function toData(input: RoutineInput) {
  return {
    ...input,
    startDate: parseDateOnly(input.startDate),
    endDate: input.endDate === null ? null : parseDateOnly(input.endDate),
  };
}

function toRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    weekdays: row.weekdays,
    timesPerWeek: row.timesPerWeek,
    timeOfDay: row.timeOfDay,
    startDate: formatDateOnly(row.startDate),
    endDate: row.endDate === null ? null : formatDateOnly(row.endDate),
    goal: row.goal,
    pdiAction: row.pdiAction && {
      id: row.pdiAction.id,
      title: row.pdiAction.title,
      cycleId: row.pdiAction.area.cycleId,
      cycleClosed: row.pdiAction.area.cycle.status === "CLOSED",
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLog(row: RoutineLogRow): RoutineLog {
  return { date: formatDateOnly(row.date), status: row.status, note: row.note };
}
