import type { Prisma, TrackStep as TrackStepRow } from "@/generated/prisma/client";
import type { TrackStepStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatDateOnly, parseDateOnly, todayInAppTimeZone } from "@/lib/dates";
import { isUuid } from "@/lib/form-fields";
import { closeGap } from "@/lib/positions";
import { isRecordNotFound } from "@/lib/prisma-errors";
import { GoalNotFoundError } from "@/modules/goals/service";
import type { TrackFilter, TrackInput, TrackStepInput } from "@/modules/tracks/schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrackStep = {
  id: string;
  trackId: string;
  title: string;
  order: number;
  status: TrackStepStatus;
  dueDate: string | null;
  resourceUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StepCounts = { total: number; done: number; inProgress: number };

/** A track's status is not stored: it is derived from its steps. */
export type TrackStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export type TrackSummary = {
  id: string;
  title: string;
  description: string | null;
  goal: { id: string; title: string } | null;
  counts: StepCounts;
  /** The day it was archived (plan 024), in the app's time zone; null while active. */
  archivedAt: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TrackDetail = TrackSummary & { steps: TrackStep[] };

/** A step not done yet that has a due date, with its track (for the dashboard). */
export type OpenStep = {
  id: string;
  title: string;
  dueDate: string;
  track: { id: string; title: string };
};

export class TrackNotFoundError extends Error {
  constructor(id: string) {
    super(`Track not found: ${id}`);
    this.name = "TrackNotFoundError";
  }
}

/** An archived track is read-only until it is unarchived (plan 024). */
export class TrackArchivedError extends Error {
  constructor(id: string) {
    super(`Track is archived: ${id}`);
    this.name = "TrackArchivedError";
  }
}

export class TrackStepNotFoundError extends Error {
  constructor(id: string) {
    super(`Track step not found: ${id}`);
    this.name = "TrackStepNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

export function isStepOverdue(step: Pick<TrackStep, "status" | "dueDate">, today: string): boolean {
  // "YYYY-MM-DD" strings compare correctly as plain text.
  return step.dueDate !== null && step.dueDate < today && step.status !== "DONE";
}

export function deriveTrackStatus(counts: StepCounts): TrackStatus {
  if (counts.total > 0 && counts.done === counts.total) return "DONE";
  if (counts.done > 0 || counts.inProgress > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

export function progressPercent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

// What every track query loads: the linked goal's title and each step's status
// (enough to count steps without loading everything).
const summaryInclude = {
  goal: { select: { id: true, title: true } },
  steps: { select: { status: true } },
} satisfies Prisma.TrackInclude;

type TrackSummaryRow = Prisma.TrackGetPayload<{ include: typeof summaryInclude }>;

/**
 * Tracks, newest first. `filter` (plan 024) defaults to the active ones; a
 * goal's tracks default to all of them, archived included.
 */
export async function listTracks(
  options: { goalId?: string; filter?: TrackFilter } = {},
): Promise<TrackSummary[]> {
  const filter = options.filter ?? (options.goalId ? "ALL" : "ACTIVE");
  const archived =
    filter === "ALL" ? {} : { archivedAt: filter === "ARCHIVED" ? { not: null } : null };
  const rows = await db.track.findMany({
    where: { ...(options.goalId && { goalId: options.goalId }), ...archived },
    include: summaryInclude,
    orderBy: { createdAt: "desc" },
  });
  const tracks = rows.map(toSummary);
  // The situation is derived from the steps, so it is filtered here, not in SQL.
  return filter === "NOT_STARTED" || filter === "IN_PROGRESS" || filter === "DONE"
    ? tracks.filter((track) => deriveTrackStatus(track.counts) === filter)
    : tracks;
}

export async function getTrack(id: string): Promise<TrackDetail> {
  if (!isUuid(id)) throw new TrackNotFoundError(id);
  const row = await db.track.findUnique({
    where: { id },
    include: { ...summaryInclude, steps: { orderBy: { order: "asc" } } },
  });
  if (!row) throw new TrackNotFoundError(id);
  return { ...toSummary(row), steps: row.steps.map(toStep) };
}

export async function createTrack(input: TrackInput): Promise<TrackSummary> {
  await assertGoalExists(input.goalId);
  const row = await db.track.create({ data: input, include: summaryInclude });
  return toSummary(row);
}

export async function updateTrack(id: string, input: TrackInput): Promise<TrackSummary> {
  await assertTrackOpen(id);
  await assertGoalExists(input.goalId);
  try {
    const row = await db.track.update({ where: { id }, data: input, include: summaryInclude });
    return toSummary(row);
  } catch (error) {
    if (isRecordNotFound(error)) throw new TrackNotFoundError(id);
    throw error;
  }
}

/** Deletes the track; its steps go with it (ON DELETE CASCADE). */
export async function deleteTrack(id: string): Promise<void> {
  if (!isUuid(id)) throw new TrackNotFoundError(id);
  try {
    await db.track.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFound(error)) throw new TrackNotFoundError(id);
    throw error;
  }
}

/** Archives the track today; an archived track keeps its original date. */
export async function archiveTrack(id: string): Promise<TrackSummary> {
  const track = await findTrack(id);
  if (track.archivedAt !== null) return getSummary(id);
  return toSummary(
    await db.track.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: summaryInclude,
    }),
  );
}

export async function unarchiveTrack(id: string): Promise<TrackSummary> {
  await findTrack(id);
  return toSummary(
    await db.track.update({ where: { id }, data: { archivedAt: null }, include: summaryInclude }),
  );
}

async function getSummary(id: string): Promise<TrackSummary> {
  return toSummary(await db.track.findUniqueOrThrow({ where: { id }, include: summaryInclude }));
}

async function findTrack(id: string) {
  if (!isUuid(id)) throw new TrackNotFoundError(id);
  const row = await db.track.findUnique({ where: { id }, select: { id: true, archivedAt: true } });
  if (!row) throw new TrackNotFoundError(id);
  return row;
}

/** Refuses changes to an archived track or to its steps (plan 024). */
async function assertTrackOpen(id: string): Promise<void> {
  const track = await findTrack(id);
  if (track.archivedAt !== null) throw new TrackArchivedError(id);
}

/** The step's track must not be archived. Throws TrackStepNotFoundError for a missing step. */
async function assertStepOpen(stepId: string): Promise<void> {
  if (!isUuid(stepId)) throw new TrackStepNotFoundError(stepId);
  const step = await db.trackStep.findUnique({
    where: { id: stepId },
    select: { track: { select: { id: true, archivedAt: true } } },
  });
  if (!step) throw new TrackStepNotFoundError(stepId);
  if (step.track.archivedAt !== null) throw new TrackArchivedError(step.track.id);
}

async function assertGoalExists(goalId: string | null): Promise<void> {
  if (goalId === null) return;
  const count = await db.goal.count({ where: { id: goalId } });
  if (count === 0) throw new GoalNotFoundError(goalId);
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export async function getStep(id: string): Promise<TrackStep> {
  if (!isUuid(id)) throw new TrackStepNotFoundError(id);
  const row = await db.trackStep.findUnique({ where: { id } });
  if (!row) throw new TrackStepNotFoundError(id);
  return toStep(row);
}

/** Adds the step after the last one of the track. */
export async function createStep(trackId: string, input: TrackStepInput): Promise<TrackStep> {
  await assertTrackOpen(trackId);
  // A transaction runs these queries as one unit: either all apply or none do.
  return db.$transaction(async (tx) => {
    const track = await tx.track.findUnique({ where: { id: trackId }, select: { id: true } });
    if (!track) throw new TrackNotFoundError(trackId);
    const last = await tx.trackStep.aggregate({ where: { trackId }, _max: { order: true } });
    const row = await tx.trackStep.create({
      data: { ...toStepData(input), trackId, order: (last._max.order ?? 0) + 1 },
    });
    return toStep(row);
  });
}

export async function updateStep(id: string, input: TrackStepInput): Promise<TrackStep> {
  await assertStepOpen(id);
  return withStepNotFound(id, async () =>
    toStep(await db.trackStep.update({ where: { id }, data: toStepData(input) })),
  );
}

export async function setStepStatus(id: string, status: TrackStepStatus): Promise<TrackStep> {
  await assertStepOpen(id);
  return withStepNotFound(id, async () =>
    toStep(await db.trackStep.update({ where: { id }, data: { status } })),
  );
}

/** Swaps the step with its neighbour. At either end of the track it does nothing. */
export async function moveStep(id: string, direction: "up" | "down"): Promise<void> {
  await assertStepOpen(id);
  await db.$transaction(async (tx) => {
    const step = await tx.trackStep.findUnique({ where: { id } });
    if (!step) throw new TrackStepNotFoundError(id);

    const neighbour = await tx.trackStep.findFirst({
      where: {
        trackId: step.trackId,
        order: direction === "up" ? { lt: step.order } : { gt: step.order },
      },
      orderBy: { order: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbour) return;

    // (trackId, order) is unique, so park the step on a free value first.
    await tx.trackStep.update({ where: { id: step.id }, data: { order: -1 } });
    await tx.trackStep.update({ where: { id: neighbour.id }, data: { order: step.order } });
    await tx.trackStep.update({ where: { id: step.id }, data: { order: neighbour.order } });
  });
}

/** Deletes the step and shifts the following ones back, so positions stay 1, 2, 3… */
export async function deleteStep(id: string): Promise<void> {
  await assertStepOpen(id);
  await db.$transaction(async (tx) => {
    const step = await tx.trackStep.findUnique({ where: { id } });
    if (!step) throw new TrackStepNotFoundError(id);
    await tx.trackStep.delete({ where: { id } });
    await closeGap(tx, "track_steps", step.trackId, step.order);
  });
}

export async function listOpenStepsWithDueDate(): Promise<OpenStep[]> {
  const rows = await db.trackStep.findMany({
    // Steps of archived tracks are out of the way (plan 024).
    where: { status: { not: "DONE" }, dueDate: { not: null }, track: { archivedAt: null } },
    select: { id: true, title: true, dueDate: true, track: { select: { id: true, title: true } } },
  });
  return rows.flatMap((row) =>
    row.dueDate === null
      ? []
      : [{ id: row.id, title: row.title, dueDate: formatDateOnly(row.dueDate), track: row.track }],
  );
}

async function withStepNotFound<T>(id: string, operation: () => Promise<T>): Promise<T> {
  if (!isUuid(id)) throw new TrackStepNotFoundError(id);
  try {
    return await operation();
  } catch (error) {
    if (isRecordNotFound(error)) throw new TrackStepNotFoundError(id);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Mapping between database rows and app types
// ---------------------------------------------------------------------------

function toSummary(row: TrackSummaryRow): TrackSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    goal: row.goal,
    counts: countSteps(row.steps),
    archivedAt: row.archivedAt === null ? null : todayInAppTimeZone(row.archivedAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function countSteps(steps: { status: TrackStepStatus }[]): StepCounts {
  return {
    total: steps.length,
    done: steps.filter((step) => step.status === "DONE").length,
    inProgress: steps.filter((step) => step.status === "IN_PROGRESS").length,
  };
}

function toStepData(input: TrackStepInput) {
  return {
    title: input.title,
    status: input.status,
    dueDate: input.dueDate === null ? null : parseDateOnly(input.dueDate),
    resourceUrl: input.resourceUrl,
    notes: input.notes,
  };
}

function toStep(row: TrackStepRow): TrackStep {
  return {
    id: row.id,
    trackId: row.trackId,
    title: row.title,
    order: row.order,
    status: row.status,
    dueDate: row.dueDate === null ? null : formatDateOnly(row.dueDate),
    resourceUrl: row.resourceUrl,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
