// Pure time tracking rules (plan 031): the day's grid of blocks, where entries
// sit in it and the day's totals. No database access, so they are tested alone.

import type { TimeEntryKind } from "@/generated/prisma/enums";
import { MINUTES_IN_DAY } from "@/lib/time-of-day";

export const SLOT_SIZES = [15, 30, 60] as const;

export type DayShape = {
  startMinute: number;
  /** Null while the day is open. */
  endMinute: number | null;
  slotMinutes: number;
};

export type EntryShape = { startMinute: number; minutes: number; kind: TimeEntryKind };

export type Slot = { start: number; end: number };

/**
 * `now`: the current time when the day is today and still open, so the grid
 * grows up to the current block; null otherwise.
 */
export type Clock = { now: number | null };

/** Where the grid stops: the end of the day, the current block, or midnight. */
function gridEnd(day: DayShape, { now }: Clock): number {
  if (day.endMinute !== null) return day.endMinute;
  // An open day in the past (the end was never set) goes up to midnight.
  if (now === null) return MINUTES_IN_DAY;
  const currentBlockEnd = (Math.floor(now / day.slotMinutes) + 1) * day.slotMinutes;
  return Math.min(MINUTES_IN_DAY, Math.max(currentBlockEnd, day.startMinute + 1));
}

/**
 * The day's blocks, aligned to the clock (with 30-minute blocks: :00 and :30).
 * A start or end off the grid makes the first or last block shorter.
 */
export function daySlots(day: DayShape, clock: Clock): Slot[] {
  const end = gridEnd(day, clock);
  const slots: Slot[] = [];
  let start = day.startMinute;
  while (start < end) {
    const next = Math.min(end, (Math.floor(start / day.slotMinutes) + 1) * day.slotMinutes);
    slots.push({ start, end: next });
    start = next;
  }
  return slots;
}

/** A block can be split in two equal halves when its length is even. */
export function canSplit(slot: Slot): boolean {
  return (slot.end - slot.start) % 2 === 0;
}

/** An entry takes a whole block or exactly one of its two halves. */
export function fitsSlot(slot: Slot, entry: Pick<EntryShape, "startMinute" | "minutes">): boolean {
  const length = slot.end - slot.start;
  if (entry.startMinute === slot.start && entry.minutes === length) return true;
  if (!canSplit(slot)) return false;
  const half = length / 2;
  return (
    entry.minutes === half &&
    (entry.startMinute === slot.start || entry.startMinute === slot.start + half)
  );
}

export type PlacedSlot<Entry extends EntryShape> = {
  slot: Slot;
  /** In time order: none, one, or two halves. */
  entries: Entry[];
  /** The block holds halves (even if only one of them is filled). */
  split: boolean;
};

/** Each block with the entries that sit in it. */
export function placeEntries<Entry extends EntryShape>(
  slots: readonly Slot[],
  entries: readonly Entry[],
): PlacedSlot<Entry>[] {
  return slots.map((slot) => {
    const inside = entries
      .filter((entry) => entry.startMinute >= slot.start && entry.startMinute < slot.end)
      .sort((a, b) => a.startMinute - b.startMinute);
    const split = inside.some((entry) => entry.minutes < slot.end - slot.start);
    return { slot, entries: inside, split };
  });
}

/** The entries that a day from `start` to `end` (null: still open) would leave out. */
export function entriesOutside<Entry extends EntryShape>(
  entries: readonly Entry[],
  start: number,
  end: number | null,
): Entry[] {
  return entries.filter(
    (entry) =>
      entry.startMinute < start || (end !== null && entry.startMinute + entry.minutes > end),
  );
}

export type DaySummary = {
  /** From the start to the end (or to now, or midnight, while open). */
  presence: number;
  breaks: number;
  /** Presence minus breaks. */
  worked: number;
  /** Minutes of the presence with no entry. */
  unregistered: number;
};

/** The day's totals, in minutes. */
export function daySummary(
  day: DayShape,
  entries: readonly EntryShape[],
  { now }: Clock,
): DaySummary {
  const end = day.endMinute ?? now ?? MINUTES_IN_DAY;
  const presence = Math.max(0, end - day.startMinute);
  // Only what falls inside the presence counts (an open day stops at now).
  const within = (entry: EntryShape) =>
    Math.max(
      0,
      Math.min(entry.startMinute + entry.minutes, end) -
        Math.max(entry.startMinute, day.startMinute),
    );
  const breaks = entries
    .filter((entry) => entry.kind === "BREAK")
    .reduce((sum, e) => sum + within(e), 0);
  const covered = entries.reduce((sum, entry) => sum + within(entry), 0);
  return { presence, breaks, worked: presence - breaks, unregistered: presence - covered };
}
