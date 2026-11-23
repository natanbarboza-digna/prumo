// Time tracking (plan 031): days, their blocks, categories and projects.
// Days are addressed by their date ("YYYY-MM-DD"); blocks by their start
// ("HH:MM") and, in a split block, by which half.

import type { Prisma } from "@/generated/prisma/client";
import type { TimeEntryKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatDateOnly, parseDateOnly, todayInAppTimeZone } from "@/lib/dates";
import { isUuid } from "@/lib/form-fields";
import { isForeignKeyViolation, isRecordNotFound, isUniqueViolation } from "@/lib/prisma-errors";
import { formatTimeOfDay, minutesNowInAppTimeZone, parseTimeOfDay } from "@/lib/time-of-day";
import {
  type Clock,
  type DayShape,
  type Slot,
  canSplit,
  daySlots,
  entriesOutside,
} from "@/modules/time/rules";
import type { DayTimesInput, EntryInput, StartDayInput } from "@/modules/time/schemas";

// ---------------------------------------------------------------------------
// Types and errors
// ---------------------------------------------------------------------------

export type Half = "FIRST" | "SECOND";

export type TimeEntryView = {
  id: string;
  startTime: string;
  startMinute: number;
  minutes: number;
  kind: TimeEntryKind;
  description: string | null;
  category: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
};

export type TimeDayView = DayShape & {
  id: string;
  date: string;
  startTime: string;
  endTime: string | null;
  entries: TimeEntryView[];
};

export type TimeCategory = { id: string; name: string; archived: boolean };
export type TimeProject = { id: string; name: string; archived: boolean };

class TimeError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

export class FutureDayError extends TimeError {
  constructor(date: string) {
    super("FutureDayError", `Cannot track a future day: ${date}`);
  }
}
export class DayAlreadyStartedError extends TimeError {
  constructor(date: string) {
    super("DayAlreadyStartedError", `Day already started: ${date}`);
  }
}
export class DayNotStartedError extends TimeError {
  constructor(date: string) {
    super("DayNotStartedError", `Day not started: ${date}`);
  }
}
export class EntryOutsideDayError extends TimeError {
  constructor(readonly startTimes: string[]) {
    super("EntryOutsideDayError", `Entries outside the day: ${startTimes.join(", ")}`);
  }
}
export class SlotNotFoundError extends TimeError {
  constructor(start: string) {
    super("SlotNotFoundError", `No block starts at ${start}`);
  }
}
export class CannotSplitError extends TimeError {
  constructor(start: string) {
    super("CannotSplitError", `The block at ${start} cannot be split in equal halves`);
  }
}
export class JoinConflictError extends TimeError {
  constructor(start: string) {
    super("JoinConflictError", `The halves of the block at ${start} differ`);
  }
}
export class NothingToRepeatError extends TimeError {
  constructor(start: string) {
    super("NothingToRepeatError", `No work entry before ${start}`);
  }
}
export class TimeCategoryNotFoundError extends TimeError {
  constructor(id: string) {
    super("TimeCategoryNotFoundError", `Time category not found: ${id}`);
  }
}
export class TimeCategoryArchivedError extends TimeError {
  constructor(id: string) {
    super("TimeCategoryArchivedError", `Time category is archived: ${id}`);
  }
}
export class TimeCategoryInUseError extends TimeError {
  constructor(id: string) {
    super("TimeCategoryInUseError", `Time category is in use: ${id}`);
  }
}
export class TimeCategoryNameTakenError extends TimeError {
  constructor(name: string) {
    super("TimeCategoryNameTakenError", `Time category name taken: ${name}`);
  }
}
export class TimeProjectNotFoundError extends TimeError {
  constructor(id: string) {
    super("TimeProjectNotFoundError", `Project not found: ${id}`);
  }
}
export class TimeProjectArchivedError extends TimeError {
  constructor(name: string) {
    super("TimeProjectArchivedError", `Project is archived: ${name}`);
  }
}
export class TimeProjectNameTakenError extends TimeError {
  constructor(name: string) {
    super("TimeProjectNameTakenError", `Project name taken: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

const entryInclude = {
  category: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.TimeEntryInclude;

const dayInclude = {
  entries: { include: entryInclude, orderBy: { startMinute: "asc" } },
} satisfies Prisma.TimeDayInclude;

type DayRow = Prisma.TimeDayGetPayload<{ include: typeof dayInclude }>;

/** The day with its entries, or null when it was not started. */
export async function getTimeDay(date: string): Promise<TimeDayView | null> {
  const row = await db.timeDay.findUnique({
    where: { date: parseDateOnly(date) },
    include: dayInclude,
  });
  return row ? toDay(row) : null;
}

/** The grid's clock: "now" only for today while the day is still open. */
export function clockFor(day: Pick<TimeDayView, "date" | "endMinute">, now: Date): Clock {
  const open = day.endMinute === null && day.date === todayInAppTimeZone(now);
  return { now: open ? minutesNowInAppTimeZone(now) : null };
}

export async function startDay(
  date: string,
  input: StartDayInput,
  now: Date = new Date(),
): Promise<TimeDayView> {
  if (date > todayInAppTimeZone(now)) throw new FutureDayError(date);
  try {
    const row = await db.timeDay.create({
      data: {
        date: parseDateOnly(date),
        startMinute: parseTimeOfDay(input.startTime),
        endMinute: input.endTime === null ? null : parseTimeOfDay(input.endTime),
        slotMinutes: input.slotMinutes,
      },
      include: dayInclude,
    });
    return toDay(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DayAlreadyStartedError(date);
    throw error;
  }
}

/** Corrects the start and end (null: open again). Every entry has to stay inside. */
export async function setDayTimes(date: string, input: DayTimesInput): Promise<TimeDayView> {
  const day = await findDay(date);
  const start = parseTimeOfDay(input.startTime);
  const end = input.endTime === null ? null : parseTimeOfDay(input.endTime);
  const outside = entriesOutside(day.entries, start, end);
  if (outside.length > 0) throw new EntryOutsideDayError(outside.map((e) => e.startTime));
  const row = await db.timeDay.update({
    where: { id: day.id },
    data: { startMinute: start, endMinute: end },
    include: dayInclude,
  });
  return toDay(row);
}

/** "Encerrar o dia": the same check as correcting it, keeping the start. */
export async function endDay(date: string, endTime: string): Promise<TimeDayView> {
  const day = await findDay(date);
  return setDayTimes(date, { startTime: day.startTime, endTime });
}

async function findDay(date: string): Promise<TimeDayView> {
  const day = await getTimeDay(date);
  if (!day) throw new DayNotStartedError(date);
  return day;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/** The block starting at `start` in the day's current grid. */
function findSlot(day: TimeDayView, start: string, now: Date): Slot {
  const minute = parseTimeOfDay(start);
  const slot = daySlots(day, clockFor(day, now)).find((candidate) => candidate.start === minute);
  if (!slot) throw new SlotNotFoundError(start);
  return slot;
}

/** Start and length of the whole block or of one of its halves. */
function target(
  slot: Slot,
  half: Half | null,
  start: string,
): { startMinute: number; minutes: number } {
  const length = slot.end - slot.start;
  if (half === null) return { startMinute: slot.start, minutes: length };
  if (!canSplit(slot)) throw new CannotSplitError(start);
  return {
    startMinute: half === "FIRST" ? slot.start : slot.start + length / 2,
    minutes: length / 2,
  };
}

/** Saves the block (or half block), replacing what was there. */
export async function saveEntry(
  date: string,
  slotStart: string,
  half: Half | null,
  input: EntryInput,
  now: Date = new Date(),
): Promise<TimeEntryView> {
  const day = await findDay(date);
  const slot = findSlot(day, slotStart, now);
  const place = target(slot, half, slotStart);
  const categoryId = input.categoryId === null ? null : await activeCategoryId(input.categoryId);
  const projectId = input.projectName === null ? null : await projectIdByName(input.projectName);
  const data = {
    kind: input.kind,
    description: input.description,
    categoryId,
    projectId,
    minutes: place.minutes,
  };

  const row = await db.$transaction(async (tx) => {
    // Whatever else sat in the block's span (a whole entry, or the other
    // layout of halves) gives way, so the block never overlaps itself.
    await tx.timeEntry.deleteMany({
      where: {
        dayId: day.id,
        startMinute: { gte: place.startMinute, lt: place.startMinute + place.minutes },
        NOT: { startMinute: place.startMinute },
      },
    });
    if (half !== null) {
      // A whole entry covering the block becomes a half when a half is saved.
      await tx.timeEntry.updateMany({
        where: { dayId: day.id, startMinute: slot.start, minutes: slot.end - slot.start },
        data: { minutes: place.minutes },
      });
    }
    return tx.timeEntry.upsert({
      where: { dayId_startMinute: { dayId: day.id, startMinute: place.startMinute } },
      create: { ...data, dayId: day.id, startMinute: place.startMinute },
      update: data,
      include: entryInclude,
    });
  });
  return toEntry(row);
}

/** Copies the text, category and project of the day's previous work entry. */
export async function repeatPrevious(
  date: string,
  slotStart: string,
  half: Half | null,
  now: Date = new Date(),
): Promise<TimeEntryView> {
  const day = await findDay(date);
  const slot = findSlot(day, slotStart, now);
  const place = target(slot, half, slotStart);
  const previous = [...day.entries]
    .filter((entry) => entry.kind === "WORK" && entry.startMinute < place.startMinute)
    .at(-1);
  if (!previous) throw new NothingToRepeatError(slotStart);
  return saveEntry(
    date,
    slotStart,
    half,
    {
      kind: "WORK",
      description: previous.description,
      categoryId: previous.category?.id ?? null,
      projectName: previous.project?.name ?? null,
    },
    now,
  );
}

/** A whole entry becomes the first half; an empty block has nothing to store. */
export async function splitSlot(date: string, slotStart: string, now: Date = new Date()) {
  const day = await findDay(date);
  const slot = findSlot(day, slotStart, now);
  if (!canSplit(slot)) throw new CannotSplitError(slotStart);
  await db.timeEntry.updateMany({
    where: { dayId: day.id, startMinute: slot.start, minutes: slot.end - slot.start },
    data: { minutes: (slot.end - slot.start) / 2 },
  });
}

/** Back to one whole block: a single half grows; two halves must be the same. */
export async function joinSlot(date: string, slotStart: string, now: Date = new Date()) {
  const day = await findDay(date);
  const slot = findSlot(day, slotStart, now);
  const halves = day.entries.filter((e) => e.startMinute >= slot.start && e.startMinute < slot.end);
  const [first, second] = halves;
  if (!first) return;
  if (second && !sameContent(first, second)) throw new JoinConflictError(slotStart);
  await db.$transaction(async (tx) => {
    if (second) await tx.timeEntry.delete({ where: { id: second.id } });
    await tx.timeEntry.update({
      where: { id: first.id },
      data: { startMinute: slot.start, minutes: slot.end - slot.start },
    });
  });
}

/** Empties the block, or one of its halves. */
export async function clearSlot(date: string, slotStart: string, half: Half | null) {
  const day = await findDay(date);
  // Any block of the day, even past the current one: clearing never adds time.
  const slot = daySlots(day, { now: null }).find(
    (candidate) => candidate.start === parseTimeOfDay(slotStart),
  );
  if (!slot) throw new SlotNotFoundError(slotStart);
  const middle = slot.start + (slot.end - slot.start) / 2;
  const toClear = day.entries.filter((entry) => {
    if (entry.startMinute < slot.start || entry.startMinute >= slot.end) return false;
    if (half === "FIRST") return entry.startMinute === slot.start && entry.startMinute < middle;
    if (half === "SECOND") return entry.startMinute === middle;
    return true;
  });
  await db.timeEntry.deleteMany({ where: { id: { in: toClear.map((entry) => entry.id) } } });
}

/** The texts already used, most recent first, for the field's suggestions. */
export async function listDescriptions(limit = 50): Promise<string[]> {
  const rows = await db.timeEntry.findMany({
    where: { kind: "WORK", description: { not: null } },
    select: { description: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit * 4,
  });
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.description && !seen.has(row.description)) seen.add(row.description);
    if (seen.size === limit) break;
  }
  return [...seen];
}

function sameContent(a: TimeEntryView, b: TimeEntryView): boolean {
  return (
    a.kind === b.kind &&
    a.description === b.description &&
    a.category?.id === b.category?.id &&
    a.project?.id === b.project?.id
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listTimeCategories(
  options: { includeArchived?: boolean } = {},
): Promise<TimeCategory[]> {
  return db.timeCategory.findMany({
    where: options.includeArchived ? {} : { archived: false },
    select: { id: true, name: true, archived: true },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
  });
}

/** Ids of the categories used by some entry: those can only be archived. */
export async function timeCategoryIdsInUse(): Promise<Set<string>> {
  const rows = await db.timeEntry.findMany({
    where: { categoryId: { not: null } },
    distinct: ["categoryId"],
    select: { categoryId: true },
  });
  return new Set(rows.flatMap((row) => (row.categoryId ? [row.categoryId] : [])));
}

export async function createTimeCategory(input: { name: string }): Promise<TimeCategory> {
  try {
    return await db.timeCategory.create({
      data: { name: input.name },
      select: { id: true, name: true, archived: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new TimeCategoryNameTakenError(input.name);
    throw error;
  }
}

export async function updateTimeCategory(
  id: string,
  input: { name: string },
): Promise<TimeCategory> {
  if (!isUuid(id)) throw new TimeCategoryNotFoundError(id);
  try {
    return await db.timeCategory.update({
      where: { id },
      data: { name: input.name },
      select: { id: true, name: true, archived: true },
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new TimeCategoryNotFoundError(id);
    if (isUniqueViolation(error)) throw new TimeCategoryNameTakenError(input.name);
    throw error;
  }
}

export async function setTimeCategoryArchived(
  id: string,
  archived: boolean,
): Promise<TimeCategory> {
  if (!isUuid(id)) throw new TimeCategoryNotFoundError(id);
  try {
    return await db.timeCategory.update({
      where: { id },
      data: { archived },
      select: { id: true, name: true, archived: true },
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new TimeCategoryNotFoundError(id);
    throw error;
  }
}

/** A category in use can only be archived. */
export async function deleteTimeCategory(id: string): Promise<void> {
  if (!isUuid(id)) throw new TimeCategoryNotFoundError(id);
  try {
    await db.timeCategory.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFound(error)) throw new TimeCategoryNotFoundError(id);
    if (isForeignKeyViolation(error)) throw new TimeCategoryInUseError(id);
    throw error;
  }
}

async function activeCategoryId(id: string): Promise<string> {
  if (!isUuid(id)) throw new TimeCategoryNotFoundError(id);
  const category = await db.timeCategory.findUnique({ where: { id }, select: { archived: true } });
  if (!category) throw new TimeCategoryNotFoundError(id);
  if (category.archived) throw new TimeCategoryArchivedError(id);
  return id;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listTimeProjects(
  options: { includeArchived?: boolean } = {},
): Promise<TimeProject[]> {
  return db.timeProject.findMany({
    where: options.includeArchived ? {} : { archived: false },
    select: { id: true, name: true, archived: true },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
  });
}

export async function renameTimeProject(id: string, input: { name: string }): Promise<TimeProject> {
  if (!isUuid(id)) throw new TimeProjectNotFoundError(id);
  const clash = await findProjectByName(input.name);
  if (clash && clash.id !== id) throw new TimeProjectNameTakenError(input.name);
  try {
    return await db.timeProject.update({
      where: { id },
      data: { name: input.name },
      select: { id: true, name: true, archived: true },
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new TimeProjectNotFoundError(id);
    throw error;
  }
}

export async function setTimeProjectArchived(id: string, archived: boolean): Promise<TimeProject> {
  if (!isUuid(id)) throw new TimeProjectNotFoundError(id);
  try {
    return await db.timeProject.update({
      where: { id },
      data: { archived },
      select: { id: true, name: true, archived: true },
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new TimeProjectNotFoundError(id);
    throw error;
  }
}

/** Same name regardless of case ("Digna" and "digna"). */
function findProjectByName(name: string) {
  return db.timeProject.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, archived: true },
  });
}

/** The project with this name, created when new; an archived one is refused. */
async function projectIdByName(name: string): Promise<string> {
  const existing = await findProjectByName(name);
  if (existing) {
    if (existing.archived) throw new TimeProjectArchivedError(name);
    return existing.id;
  }
  try {
    return (await db.timeProject.create({ data: { name }, select: { id: true } })).id;
  } catch (error) {
    // Created by another request meanwhile: use that one.
    if (isUniqueViolation(error)) return projectIdByName(name);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function toDay(row: DayRow): TimeDayView {
  return {
    id: row.id,
    date: formatDateOnly(row.date),
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    slotMinutes: row.slotMinutes,
    startTime: formatTimeOfDay(row.startMinute),
    endTime: row.endMinute === null ? null : formatTimeOfDay(row.endMinute),
    entries: row.entries.map(toEntry),
  };
}

function toEntry(row: Prisma.TimeEntryGetPayload<{ include: typeof entryInclude }>): TimeEntryView {
  return {
    id: row.id,
    startTime: formatTimeOfDay(row.startMinute),
    startMinute: row.startMinute,
    minutes: row.minutes,
    kind: row.kind,
    description: row.description,
    category: row.category,
    project: row.project,
  };
}
