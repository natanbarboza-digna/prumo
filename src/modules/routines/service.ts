import type { Prisma, RoutineLog as RoutineLogRow } from "@/generated/prisma/client";
import type { RoutineLogStatus, Weekday } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { addDays, eachDay, formatDateOnly, parseDateOnly, weekdayOf } from "@/lib/dates";
import { isUuid } from "@/lib/form-fields";
import { isRecordNotFound } from "@/lib/prisma-errors";
import { GoalNotFoundError } from "@/modules/goals/service";
import type { RoutineInput, RoutineLogInput } from "@/modules/routines/schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Routine = {
  id: string;
  title: string;
  description: string | null;
  weekdays: Weekday[];
  timeOfDay: string | null;
  startDate: string;
  endDate: string | null;
  goal: { id: string; title: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RoutineLog = { date: string; status: RoutineLogStatus; note: string | null };

export type Adherence = {
  scheduled: number;
  done: number;
  skipped: number;
  missed: number;
  /** Done days as a whole percentage of the scheduled days (0 when none). */
  rate: number;
};

export type RoutineSummary = Routine & { adherence: Adherence };

/** A day on the "Today" screen or in a routine's history, with its log if any. */
export type RoutineDay = { routine: Routine; log: RoutineLog | null };
export type HistoryDay = { date: string; log: RoutineLog | null };

export type RoutineState = "UPCOMING" | "ACTIVE" | "ENDED";

type Schedule = Pick<Routine, "weekdays" | "startDate" | "endDate">;

/** How far back adherence and history look, counting today. */
export const ADHERENCE_DAYS = 30;
export const HISTORY_DAYS = 14;

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

export class RoutineNotScheduledError extends Error {
  constructor(id: string, date: string) {
    super(`Routine ${id} is not scheduled on ${date}`);
    this.name = "RoutineNotScheduledError";
  }
}

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

export function isScheduledOn(routine: Schedule, date: string): boolean {
  // "YYYY-MM-DD" strings compare correctly as plain text.
  return (
    routine.startDate <= date &&
    (routine.endDate === null || date <= routine.endDate) &&
    routine.weekdays.includes(weekdayOf(date))
  );
}

export function routineStateOn(routine: Schedule, today: string): RoutineState {
  if (routine.startDate > today) return "UPCOMING";
  if (routine.endDate !== null && routine.endDate < today) return "ENDED";
  return "ACTIVE";
}

/**
 * Adherence over the scheduled days of a period. Days after today never count,
 * and today only counts once logged, since it is not over yet. Skipped days
 * count as not done. Logs on days that are no longer scheduled are ignored.
 */
export function computeAdherence(
  routine: Schedule,
  logs: readonly Pick<RoutineLog, "date" | "status">[],
  period: { from: string; to: string },
  today: string,
): Adherence {
  const statusByDate = new Map(logs.map((log) => [log.date, log.status]));
  const last = period.to < today ? period.to : today;
  let scheduled = 0;
  let done = 0;
  let skipped = 0;

  for (const date of eachDay(period.from, last)) {
    if (!isScheduledOn(routine, date)) continue;
    const status = statusByDate.get(date);
    if (date === today && status === undefined) continue;
    scheduled++;
    if (status === "DONE") done++;
    if (status === "SKIPPED") skipped++;
  }

  return {
    scheduled,
    done,
    skipped,
    missed: scheduled - done - skipped,
    rate: scheduled === 0 ? 0 : Math.round((done / scheduled) * 100),
  };
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

const routineInclude = {
  goal: { select: { id: true, title: true } },
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
      logs: { where: { date: { gte: parseDateOnly(period.from) } } },
    },
    orderBy: routineOrder,
  });

  return rows.map((row) => {
    const routine = toRoutine(row);
    const logs = row.logs.map(toLog);
    return { ...routine, adherence: computeAdherence(routine, logs, period, today) };
  });
}

export async function getRoutine(id: string): Promise<Routine> {
  if (!isUuid(id)) throw new RoutineNotFoundError(id);
  const row = await db.routine.findUnique({ where: { id }, include: routineInclude });
  if (!row) throw new RoutineNotFoundError(id);
  return toRoutine(row);
}

export async function createRoutine(input: RoutineInput): Promise<Routine> {
  await assertGoalExists(input.goalId);
  const row = await db.routine.create({ data: toData(input), include: routineInclude });
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
    include: { ...routineInclude, logs: { where: { date: day } } },
    orderBy: routineOrder,
  });
  return rows.map((row) => ({
    routine: toRoutine(row),
    log: row.logs[0] ? toLog(row.logs[0]) : null,
  }));
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
    timeOfDay: row.timeOfDay,
    startDate: formatDateOnly(row.startDate),
    endDate: row.endDate === null ? null : formatDateOnly(row.endDate),
    goal: row.goal,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLog(row: RoutineLogRow): RoutineLog {
  return { date: formatDateOnly(row.date), status: row.status, note: row.note };
}
