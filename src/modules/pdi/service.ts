import type { Prisma } from "@/generated/prisma/client";
import type { PdiActionStatus, PdiCycleStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatDateOnly, parseDateOnly } from "@/lib/dates";
import { isUuid } from "@/lib/form-fields";
import { isRecordNotFound } from "@/lib/prisma-errors";
import { CategoryNotFoundError } from "@/modules/categories/service";
import { GoalNotFoundError } from "@/modules/goals/service";
import type { ActionInput, AreaInput, CheckInInput, CycleInput } from "@/modules/pdi/schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionProgress = { done: number; total: number };

export type PdiCycleSummary = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: PdiCycleStatus;
  managerName: string | null;
  progress: ActionProgress;
};

export type PdiAction = {
  id: string;
  areaId: string;
  cycleId: string;
  category: { id: string; name: string; archived: boolean; allowsRoutine: boolean };
  title: string;
  description: string | null;
  expectedResult: string | null;
  dueDate: string | null;
  status: PdiActionStatus;
  evidence: string | null;
  managerComment: string | null;
  goal: { id: string; title: string } | null;
};

export type PdiArea = {
  id: string;
  cycleId: string;
  name: string;
  description: string | null;
  expectedOutcome: string | null;
  actions: PdiAction[];
};

export type PdiCheckIn = {
  id: string;
  cycleId: string;
  date: string;
  summary: string;
  nextSteps: string | null;
  managerNotes: string | null;
};

export type PdiCycle = PdiCycleSummary & {
  careerObjective: string | null;
  selfAssessment: string | null;
  managerFeedback: string | null;
  finalRating: string | null;
  areas: PdiArea[];
  checkIns: PdiCheckIn[];
};

/** An action shown on a goal page, with where it lives. */
export type GoalPdiAction = PdiAction & { cycle: { id: string; title: string }; areaName: string };

class NotFoundError extends Error {
  constructor(kind: string, id: string) {
    super(`${kind} not found: ${id}`);
  }
}

export class PdiCycleNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("PDI cycle", id);
    this.name = "PdiCycleNotFoundError";
  }
}

export class PdiAreaNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("PDI area", id);
    this.name = "PdiAreaNotFoundError";
  }
}

export class PdiActionNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("PDI action", id);
    this.name = "PdiActionNotFoundError";
  }
}

export class PdiCheckInNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("PDI check-in", id);
    this.name = "PdiCheckInNotFoundError";
  }
}

/** A closed cycle is read-only: nothing in it can change, except reopening. */
export class CycleClosedError extends Error {
  constructor(id: string) {
    super(`PDI cycle is closed (read-only): ${id}`);
    this.name = "CycleClosedError";
  }
}

export class CycleNotClosedError extends Error {
  constructor(id: string) {
    super(`PDI cycle is not closed: ${id}`);
    this.name = "CycleNotClosedError";
  }
}

export class ActiveCycleExistsError extends Error {
  constructor() {
    super("Another PDI cycle is already active");
    this.name = "ActiveCycleExistsError";
  }
}

export class AreaNotInCycleError extends Error {
  constructor(areaId: string, cycleId: string) {
    super(`PDI area ${areaId} does not belong to cycle ${cycleId}`);
    this.name = "AreaNotInCycleError";
  }
}

export class CategoryArchivedError extends Error {
  constructor(id: string) {
    super(`Archived categories cannot be given to actions: ${id}`);
    this.name = "CategoryArchivedError";
  }
}

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

export function isActionOverdue(
  action: Pick<PdiAction, "status" | "dueDate">,
  today: string,
): boolean {
  // "YYYY-MM-DD" strings compare correctly as plain text.
  const open = action.status === "NOT_STARTED" || action.status === "IN_PROGRESS";
  return open && action.dueDate !== null && action.dueDate < today;
}

/** Done actions out of all actions, leaving cancelled ones out of the count. */
export function actionProgress(statuses: readonly PdiActionStatus[]): ActionProgress {
  const counted = statuses.filter((status) => status !== "CANCELLED");
  return { done: counted.filter((status) => status === "DONE").length, total: counted.length };
}

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------

const actionInclude = {
  category: { select: { id: true, name: true, archived: true, allowsRoutine: true } },
  goal: { select: { id: true, title: true } },
  area: { select: { cycleId: true, name: true } },
} satisfies Prisma.PdiActionInclude;

// Due date first (actions without one last), then creation.
const actionOrder = [
  { dueDate: { sort: "asc", nulls: "last" } },
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.PdiActionOrderByWithRelationInput[];

const summaryInclude = {
  areas: { select: { actions: { select: { status: true } } } },
} satisfies Prisma.PdiCycleInclude;

const detailInclude = {
  areas: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { actions: { include: actionInclude, orderBy: actionOrder } },
  },
  checkIns: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
} satisfies Prisma.PdiCycleInclude;

type ActionRow = Prisma.PdiActionGetPayload<{ include: typeof actionInclude }>;
type CycleRow = Prisma.PdiCycleGetPayload<object>;
type SummaryRow = Prisma.PdiCycleGetPayload<{ include: typeof summaryInclude }>;
type DetailRow = Prisma.PdiCycleGetPayload<{ include: typeof detailInclude }>;
type CheckInRow = Prisma.PdiCheckInGetPayload<object>;

const statusRank: Record<PdiCycleStatus, number> = { ACTIVE: 0, PLANNED: 1, CLOSED: 2 };

/** The active cycle first, then planned, then closed; newest start first in each group. */
export async function listCycles(): Promise<PdiCycleSummary[]> {
  const rows = await db.pdiCycle.findMany({
    include: summaryInclude,
    orderBy: { startDate: "desc" },
  });
  return rows.map(toSummary).sort((a, b) => statusRank[a.status] - statusRank[b.status]);
}

export async function getCycle(id: string): Promise<PdiCycle> {
  if (!isUuid(id)) throw new PdiCycleNotFoundError(id);
  const row = await db.pdiCycle.findUnique({ where: { id }, include: detailInclude });
  if (!row) throw new PdiCycleNotFoundError(id);
  return toCycle(row);
}

export async function createCycle(input: CycleInput): Promise<PdiCycle> {
  if (input.status === "ACTIVE") await assertNoOtherActive();
  const row = await db.pdiCycle.create({ data: toCycleData(input), include: detailInclude });
  return toCycle(row);
}

export async function updateCycle(id: string, input: CycleInput): Promise<PdiCycle> {
  await openCycle(id);
  if (input.status === "ACTIVE") await assertNoOtherActive(id);
  const row = await db.pdiCycle.update({
    where: { id },
    data: toCycleData(input),
    include: detailInclude,
  });
  return toCycle(row);
}

export async function deleteCycle(id: string): Promise<void> {
  await openCycle(id);
  await db.pdiCycle.delete({ where: { id } });
}

export async function closeCycle(id: string): Promise<PdiCycle> {
  await openCycle(id);
  return setCycleStatus(id, "CLOSED");
}

/** The only change a closed cycle accepts: back to ACTIVE. */
export async function reopenCycle(id: string): Promise<PdiCycle> {
  const cycle = await findCycle(id);
  if (cycle.status !== "CLOSED") throw new CycleNotClosedError(id);
  await assertNoOtherActive(id);
  return setCycleStatus(id, "ACTIVE");
}

async function setCycleStatus(id: string, status: PdiCycleStatus): Promise<PdiCycle> {
  return toCycle(
    await db.pdiCycle.update({ where: { id }, data: { status }, include: detailInclude }),
  );
}

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

export async function getArea(id: string): Promise<Omit<PdiArea, "actions">> {
  const row = await findArea(id);
  return toAreaFields(row);
}

export async function createArea(cycleId: string, input: AreaInput) {
  await openCycle(cycleId);
  return toAreaFields(await db.pdiArea.create({ data: { ...input, cycleId } }));
}

export async function updateArea(id: string, input: AreaInput) {
  const area = await findArea(id);
  await openCycle(area.cycleId);
  return toAreaFields(await db.pdiArea.update({ where: { id }, data: input }));
}

/** Deleting an area deletes its actions. */
export async function deleteArea(id: string): Promise<void> {
  const area = await findArea(id);
  await openCycle(area.cycleId);
  await ignoreGone(() => db.pdiArea.delete({ where: { id } }));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function getAction(id: string): Promise<PdiAction> {
  return toAction(await findAction(id));
}

export async function createAction(cycleId: string, input: ActionInput): Promise<PdiAction> {
  await openCycle(cycleId);
  await assertActionReferences(cycleId, input, null);
  const row = await db.pdiAction.create({ data: toActionData(input), include: actionInclude });
  return toAction(row);
}

export async function updateAction(id: string, input: ActionInput): Promise<PdiAction> {
  const current = await findAction(id);
  await openCycle(current.area.cycleId);
  await assertActionReferences(current.area.cycleId, input, current.categoryId);
  const row = await db.pdiAction.update({
    where: { id },
    data: toActionData(input),
    include: actionInclude,
  });
  return toAction(row);
}

export async function deleteAction(id: string): Promise<void> {
  const action = await findAction(id);
  await openCycle(action.area.cycleId);
  await ignoreGone(() => db.pdiAction.delete({ where: { id } }));
}

export async function listActionsForGoal(goalId: string): Promise<GoalPdiAction[]> {
  const rows = await db.pdiAction.findMany({
    where: { goalId },
    include: {
      ...actionInclude,
      area: { select: { cycleId: true, name: true, cycle: { select: { id: true, title: true } } } },
    },
    orderBy: actionOrder,
  });
  return rows.map((row) => ({ ...toAction(row), cycle: row.area.cycle, areaName: row.area.name }));
}

/**
 * The area must be in the action's cycle, the goal must exist and the category
 * must exist and not be archived, unless it is the one the action already had.
 */
async function assertActionReferences(
  cycleId: string,
  input: ActionInput,
  currentCategoryId: string | null,
): Promise<void> {
  const area = await db.pdiArea.findUnique({
    where: { id: input.areaId },
    select: { cycleId: true },
  });
  if (!area || area.cycleId !== cycleId) throw new AreaNotInCycleError(input.areaId, cycleId);

  const category = await db.actionCategory.findUnique({
    where: { id: input.categoryId },
    select: { archived: true },
  });
  if (!category) throw new CategoryNotFoundError(input.categoryId);
  if (category.archived && input.categoryId !== currentCategoryId) {
    throw new CategoryArchivedError(input.categoryId);
  }

  if (input.goalId !== null && (await db.goal.count({ where: { id: input.goalId } })) === 0) {
    throw new GoalNotFoundError(input.goalId);
  }
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export async function getCheckIn(id: string): Promise<PdiCheckIn> {
  return toCheckIn(await findCheckIn(id));
}

export async function createCheckIn(cycleId: string, input: CheckInInput): Promise<PdiCheckIn> {
  await openCycle(cycleId);
  const row = await db.pdiCheckIn.create({ data: { ...toCheckInData(input), cycleId } });
  return toCheckIn(row);
}

export async function updateCheckIn(id: string, input: CheckInInput): Promise<PdiCheckIn> {
  const checkIn = await findCheckIn(id);
  await openCycle(checkIn.cycleId);
  return toCheckIn(await db.pdiCheckIn.update({ where: { id }, data: toCheckInData(input) }));
}

export async function deleteCheckIn(id: string): Promise<void> {
  const checkIn = await findCheckIn(id);
  await openCycle(checkIn.cycleId);
  await ignoreGone(() => db.pdiCheckIn.delete({ where: { id } }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findCycle(id: string): Promise<CycleRow> {
  if (!isUuid(id)) throw new PdiCycleNotFoundError(id);
  const row = await db.pdiCycle.findUnique({ where: { id } });
  if (!row) throw new PdiCycleNotFoundError(id);
  return row;
}

/** Loads the cycle and refuses to go on when it is closed. */
async function openCycle(id: string): Promise<CycleRow> {
  const cycle = await findCycle(id);
  if (cycle.status === "CLOSED") throw new CycleClosedError(id);
  return cycle;
}

async function assertNoOtherActive(exceptId?: string): Promise<void> {
  const count = await db.pdiCycle.count({
    where: { status: "ACTIVE", ...(exceptId && { id: { not: exceptId } }) },
  });
  if (count > 0) throw new ActiveCycleExistsError();
}

async function findArea(id: string) {
  if (!isUuid(id)) throw new PdiAreaNotFoundError(id);
  const row = await db.pdiArea.findUnique({ where: { id } });
  if (!row) throw new PdiAreaNotFoundError(id);
  return row;
}

async function findAction(id: string): Promise<ActionRow> {
  if (!isUuid(id)) throw new PdiActionNotFoundError(id);
  const row = await db.pdiAction.findUnique({ where: { id }, include: actionInclude });
  if (!row) throw new PdiActionNotFoundError(id);
  return row;
}

async function findCheckIn(id: string): Promise<CheckInRow> {
  if (!isUuid(id)) throw new PdiCheckInNotFoundError(id);
  const row = await db.pdiCheckIn.findUnique({ where: { id } });
  if (!row) throw new PdiCheckInNotFoundError(id);
  return row;
}

/** Deleted in the meantime (another tab): the outcome the user wanted anyway. */
async function ignoreGone(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
  }
}

function toCycleData(input: CycleInput) {
  return {
    ...input,
    startDate: parseDateOnly(input.startDate),
    endDate: parseDateOnly(input.endDate),
  };
}

function toActionData(input: ActionInput) {
  return { ...input, dueDate: input.dueDate === null ? null : parseDateOnly(input.dueDate) };
}

function toCheckInData(input: CheckInInput) {
  return { ...input, date: parseDateOnly(input.date) };
}

function toCycleFields(row: CycleRow) {
  return {
    id: row.id,
    title: row.title,
    startDate: formatDateOnly(row.startDate),
    endDate: formatDateOnly(row.endDate),
    status: row.status,
    managerName: row.managerName,
  };
}

function toSummary(row: SummaryRow): PdiCycleSummary {
  const statuses = row.areas.flatMap((area) => area.actions.map((action) => action.status));
  return { ...toCycleFields(row), progress: actionProgress(statuses) };
}

function toCycle(row: DetailRow): PdiCycle {
  const areas = row.areas.map((area) => ({
    ...toAreaFields(area),
    actions: area.actions.map(toAction),
  }));
  const statuses = areas.flatMap((area) => area.actions.map((action) => action.status));
  return {
    ...toCycleFields(row),
    progress: actionProgress(statuses),
    careerObjective: row.careerObjective,
    selfAssessment: row.selfAssessment,
    managerFeedback: row.managerFeedback,
    finalRating: row.finalRating,
    areas,
    checkIns: row.checkIns.map(toCheckIn),
  };
}

function toAreaFields(row: Prisma.PdiAreaGetPayload<object>): Omit<PdiArea, "actions"> {
  return {
    id: row.id,
    cycleId: row.cycleId,
    name: row.name,
    description: row.description,
    expectedOutcome: row.expectedOutcome,
  };
}

function toAction(row: ActionRow): PdiAction {
  return {
    id: row.id,
    areaId: row.areaId,
    cycleId: row.area.cycleId,
    category: row.category,
    title: row.title,
    description: row.description,
    expectedResult: row.expectedResult,
    dueDate: row.dueDate === null ? null : formatDateOnly(row.dueDate),
    status: row.status,
    evidence: row.evidence,
    managerComment: row.managerComment,
    goal: row.goal,
  };
}

function toCheckIn(row: CheckInRow): PdiCheckIn {
  return {
    id: row.id,
    cycleId: row.cycleId,
    date: formatDateOnly(row.date),
    summary: row.summary,
    nextSteps: row.nextSteps,
    managerNotes: row.managerNotes,
  };
}
