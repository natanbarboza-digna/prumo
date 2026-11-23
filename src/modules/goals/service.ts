import type { Goal as GoalRow } from "@/generated/prisma/client";
import type { GoalStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatDateOnly, parseDateOnly } from "@/lib/dates";
import { isUuid } from "@/lib/form-fields";
import { isRecordNotFound } from "@/lib/prisma-errors";
import type { GoalInput } from "@/modules/goals/schemas";

/** A goal as the rest of the app sees it: date-only fields as "YYYY-MM-DD". */
export type Goal = {
  id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  targetDate: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class GoalNotFoundError extends Error {
  constructor(id: string) {
    super(`Goal not found: ${id}`);
    this.name = "GoalNotFoundError";
  }
}

/** Statuses for which a passed target date still matters. */
const OPEN_STATUSES: ReadonlySet<GoalStatus> = new Set(["NOT_STARTED", "IN_PROGRESS"]);

export function isGoalOverdue(goal: Pick<Goal, "status" | "targetDate">, today: string): boolean {
  // "YYYY-MM-DD" strings compare correctly as plain text.
  return goal.targetDate !== null && goal.targetDate < today && OPEN_STATUSES.has(goal.status);
}

export async function listGoals(filter: { status?: GoalStatus } = {}): Promise<Goal[]> {
  const rows = await db.goal.findMany({
    where: filter.status ? { status: filter.status } : { status: { not: "ARCHIVED" } },
    orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return rows.map(toGoal);
}

export async function getGoal(id: string): Promise<Goal> {
  // The id column is a Postgres UUID: anything else would make the query fail
  // instead of simply not matching, so treat it as "not found" up front.
  if (!isUuid(id)) throw new GoalNotFoundError(id);
  const row = await db.goal.findUnique({ where: { id } });
  if (!row) throw new GoalNotFoundError(id);
  return toGoal(row);
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const row = await db.goal.create({ data: toData(input) });
  return toGoal(row);
}

export async function updateGoal(id: string, input: GoalInput): Promise<Goal> {
  return withNotFound(id, async () => {
    const row = await db.goal.update({ where: { id }, data: toData(input) });
    return toGoal(row);
  });
}

/** Deletes the goal. Linked tracks stay, with their link cleared (ON DELETE SET NULL). */
export async function deleteGoal(id: string): Promise<void> {
  await withNotFound(id, () => db.goal.delete({ where: { id } }));
}

export type Progress = { done: number; total: number };

/** Overall progress plus the share of each kind of item. */
export type GoalProgress = Progress & { steps: Progress; actions: Progress; books: Progress };

/**
 * Aggregated progress of what is linked to the goal: the steps of its tracks
 * its PDI actions (cancelled actions leave the count) and its books (read ones
 * are done, abandoned ones leave the count, plan 035). Routines repeat and
 * have no "done", so they show adherence on the goal page instead.
 */
export async function getGoalProgress(goalId: string): Promise<GoalProgress> {
  const progress = await getGoalsProgress([goalId]);
  const none = { done: 0, total: 0 };
  return progress.get(goalId) ?? toGoalProgress(none, none, none);
}

/**
 * The same as getGoalProgress for several goals at once, with three queries in
 * total instead of a few per goal (the dashboard lists many goals).
 */
export async function getGoalsProgress(
  goalIds: readonly string[],
): Promise<Map<string, GoalProgress>> {
  if (goalIds.length === 0) return new Map();
  const ids = [...goalIds];
  const [steps, actions, books] = await Promise.all([
    db.trackStep.findMany({
      where: { track: { goalId: { in: ids } } },
      select: { status: true, track: { select: { goalId: true } } },
    }),
    db.pdiAction.findMany({
      where: { goalId: { in: ids }, status: { not: "CANCELLED" } },
      select: { status: true, goalId: true },
    }),
    db.book.findMany({
      where: { goalId: { in: ids }, status: { not: "ABANDONED" } },
      select: { status: true, goalId: true },
    }),
  ]);

  const count = (items: { goalId: string | null; done: boolean }[], goalId: string): Progress => {
    const mine = items.filter((item) => item.goalId === goalId);
    return { done: mine.filter((item) => item.done).length, total: mine.length };
  };
  const stepItems = steps.map((step) => ({
    goalId: step.track.goalId,
    done: step.status === "DONE",
  }));
  const actionItems = actions.map((action) => ({
    goalId: action.goalId,
    done: action.status === "DONE",
  }));
  const bookItems = books.map((book) => ({ goalId: book.goalId, done: book.status === "READ" }));
  return new Map(
    ids.map((id) => [
      id,
      toGoalProgress(count(stepItems, id), count(actionItems, id), count(bookItems, id)),
    ]),
  );
}

function toGoalProgress(steps: Progress, actions: Progress, books: Progress): GoalProgress {
  return {
    done: steps.done + actions.done + books.done,
    total: steps.total + actions.total + books.total,
    steps,
    actions,
    books,
  };
}

function toData(input: GoalInput) {
  return {
    title: input.title,
    description: input.description,
    status: input.status,
    targetDate: input.targetDate === null ? null : parseDateOnly(input.targetDate),
  };
}

function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    targetDate: row.targetDate === null ? null : formatDateOnly(row.targetDate),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Maps Prisma's "record not found" (P2025) and malformed ids to GoalNotFoundError. */
async function withNotFound<T>(id: string, operation: () => Promise<T>): Promise<T> {
  if (!isUuid(id)) throw new GoalNotFoundError(id);
  try {
    return await operation();
  } catch (error) {
    if (isRecordNotFound(error)) throw new GoalNotFoundError(id);
    throw error;
  }
}
