import { describe, expect, it } from "vitest";

import {
  type DayShape,
  type EntryShape,
  canSplit,
  daySlots,
  daySummary,
  entriesOutside,
  fitsSlot,
  placeEntries,
} from "@/modules/time/rules";

const hm = (h: number, m = 0) => h * 60 + m;

function day(overrides: Partial<DayShape> = {}): DayShape {
  return { startMinute: hm(8, 15), endMinute: hm(18, 30), slotMinutes: 30, ...overrides };
}

const work = (start: number, minutes: number): EntryShape => ({
  startMinute: start,
  minutes,
  kind: "WORK",
});
const pause = (start: number, minutes: number): EntryShape => ({
  startMinute: start,
  minutes,
  kind: "BREAK",
});

const bounds = (slots: { start: number; end: number }[]) => slots.map((s) => [s.start, s.end]);

describe("daySlots (plan 031)", () => {
  it("aligns the blocks to the clock, with a short first block when the start is off the grid", () => {
    const slots = daySlots(day({ endMinute: hm(10) }), { now: null });

    expect(bounds(slots)).toEqual([
      [hm(8, 15), hm(8, 30)],
      [hm(8, 30), hm(9)],
      [hm(9), hm(9, 30)],
      [hm(9, 30), hm(10)],
    ]);
  });

  it("ends with a short block when the end is off the grid", () => {
    const slots = daySlots(day({ startMinute: hm(9), endMinute: hm(10, 10) }), { now: null });

    expect(bounds(slots)).toEqual([
      [hm(9), hm(9, 30)],
      [hm(9, 30), hm(10)],
      [hm(10), hm(10, 10)],
    ]);
  });

  it("works with 15- and 60-minute blocks", () => {
    expect(
      bounds(
        daySlots(day({ startMinute: hm(9), endMinute: hm(9, 45), slotMinutes: 15 }), { now: null }),
      ),
    ).toEqual([
      [hm(9), hm(9, 15)],
      [hm(9, 15), hm(9, 30)],
      [hm(9, 30), hm(9, 45)],
    ]);
    expect(
      bounds(
        daySlots(day({ startMinute: hm(8, 30), endMinute: hm(11), slotMinutes: 60 }), {
          now: null,
        }),
      ),
    ).toEqual([
      [hm(8, 30), hm(9)],
      [hm(9), hm(10)],
      [hm(10), hm(11)],
    ]);
  });

  it("grows up to the current block while the day is open", () => {
    const slots = daySlots(day({ endMinute: null }), { now: hm(9, 40) });

    expect(bounds(slots).at(-1)).toEqual([hm(9, 30), hm(10)]);
    expect(slots).toHaveLength(4);
  });

  it("shows at least the first block right after starting the day", () => {
    expect(bounds(daySlots(day({ endMinute: null }), { now: hm(8, 15) }))).toEqual([
      [hm(8, 15), hm(8, 30)],
    ]);
  });

  it("goes up to midnight for an open day in the past", () => {
    const slots = daySlots(day({ startMinute: hm(22), endMinute: null }), { now: null });

    expect(bounds(slots)).toEqual([
      [hm(22), hm(22, 30)],
      [hm(22, 30), hm(23)],
      [hm(23), hm(23, 30)],
      [hm(23, 30), hm(24)],
    ]);
  });
});

describe("entries in the grid", () => {
  const slot = { start: hm(14), end: hm(14, 30) };

  it("fits a whole block or either half of it", () => {
    expect(fitsSlot(slot, work(hm(14), 30))).toBe(true);
    expect(fitsSlot(slot, work(hm(14), 15))).toBe(true);
    expect(fitsSlot(slot, work(hm(14, 15), 15))).toBe(true);
    expect(fitsSlot(slot, work(hm(14, 10), 20))).toBe(false);
    expect(fitsSlot(slot, work(hm(14), 45))).toBe(false);
  });

  it("only splits blocks with an even length", () => {
    expect(canSplit(slot)).toBe(true);
    expect(canSplit({ start: hm(9), end: hm(9, 15) })).toBe(false);
  });

  it("places each entry in its block, marking split blocks", () => {
    const slots = daySlots(day({ startMinute: hm(14), endMinute: hm(15) }), { now: null });

    const placed = placeEntries(slots, [
      work(hm(14), 30),
      work(hm(14, 30), 15),
      pause(hm(14, 45), 15),
    ]);

    expect(placed.map((p) => [p.entries.length, p.split])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("finds the entries a new start or end would leave out of the day", () => {
    const entries = [work(hm(8, 30), 30), work(hm(17, 30), 30)];

    expect(entriesOutside(entries, hm(9), hm(18, 30))).toEqual([entries[0]]);
    expect(entriesOutside(entries, hm(8, 15), hm(17, 30))).toEqual([entries[1]]);
    expect(entriesOutside(entries, hm(8, 15), null)).toEqual([]);
  });
});

describe("daySummary", () => {
  it("adds presence, breaks, worked time and unregistered time of a closed day", () => {
    // 08:15 to 10:00 is 105 min: 30 of work, 30 of break, 45 unregistered.
    const shape = day({ endMinute: hm(10) });
    const entries = [work(hm(8, 30), 30), pause(hm(9), 30)];

    expect(daySummary(shape, entries, { now: null })).toEqual({
      presence: 105,
      breaks: 30,
      worked: 75,
      unregistered: 45,
    });
  });

  it("counts an open day up to now, leaving the rest of the current block out", () => {
    const shape = day({ startMinute: hm(9), endMinute: null });

    expect(daySummary(shape, [work(hm(9), 30)], { now: hm(9, 40) })).toEqual({
      presence: 40,
      breaks: 0,
      worked: 40,
      unregistered: 10,
    });
  });
});
