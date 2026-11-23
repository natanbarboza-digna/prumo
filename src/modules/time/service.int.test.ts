import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { ensureDefaultTimeCategories } from "@/modules/time/defaults";
import type { EntryInput } from "@/modules/time/schemas";
import {
  DayAlreadyStartedError,
  DayNotStartedError,
  EntryOutsideDayError,
  FutureDayError,
  JoinConflictError,
  NothingToRepeatError,
  SlotNotFoundError,
  TimeCategoryArchivedError,
  TimeCategoryInUseError,
  TimeProjectArchivedError,
  clearSlot,
  createTimeCategory,
  deleteTimeCategory,
  getTimeDay,
  joinSlot,
  listDescriptions,
  listTimeCategories,
  listTimeDays,
  listTimeProjects,
  repeatPrevious,
  saveEntry,
  setDayTimes,
  setTimeCategoryArchived,
  setTimeProjectArchived,
  splitSlot,
  startDay,
} from "@/modules/time/service";

// 14:00 UTC is 11:00 in Fortaleza, on Monday, November 23.
const now = new Date("2026-11-23T14:00:00Z");
const today = "2026-11-23";
const yesterday = "2026-11-22";

async function categoryId(name = "Projeto") {
  await ensureDefaultTimeCategories(db);
  const category = (await listTimeCategories()).find((item) => item.name === name);
  if (!category) throw new Error(`No category ${name}`);
  return category.id;
}

async function work(description: string, projectName: string | null = null): Promise<EntryInput> {
  return { kind: "WORK", description, categoryId: await categoryId(), projectName };
}

const pause: EntryInput = {
  kind: "BREAK",
  description: "Almoço",
  categoryId: null,
  projectName: null,
};

/** Today from 08:15, open, with 30-minute blocks. */
const startToday = () =>
  startDay(today, { startTime: "08:15", slotMinutes: 30, endTime: null }, now);

describe("starting and ending a day (plan 031)", () => {
  it("starts a day once, with its start and block size", async () => {
    const day = await startToday();

    expect(day).toMatchObject({ date: today, startTime: "08:15", endTime: null, slotMinutes: 30 });
    await expect(startToday()).rejects.toBeInstanceOf(DayAlreadyStartedError);
    expect(await getTimeDay(yesterday)).toBeNull();
  });

  it("refuses a day in the future", async () => {
    await expect(
      startDay("2026-11-24", { startTime: "08:00", slotMinutes: 30, endTime: null }, now),
    ).rejects.toBeInstanceOf(FutureDayError);
  });

  it("ends and corrects the day only while every entry still fits", async () => {
    await startToday();
    await saveEntry(today, "08:30", null, await work("E-mail"), now);
    await saveEntry(today, "10:30", null, await work("Relatórios"), now);

    await expect(setDayTimes(today, { startTime: "09:00", endTime: null })).rejects.toBeInstanceOf(
      EntryOutsideDayError,
    );
    await expect(
      setDayTimes(today, { startTime: "08:15", endTime: "10:30" }),
    ).rejects.toBeInstanceOf(EntryOutsideDayError);
    const ended = await setDayTimes(today, { startTime: "08:00", endTime: "18:30" });
    expect(ended).toMatchObject({ startTime: "08:00", endTime: "18:30" });
  });
});

describe("blocks", () => {
  it("saves work and breaks in whole blocks, one entry per block", async () => {
    await startToday();
    const categoryIdProjeto = await categoryId();

    await saveEntry(today, "08:30", null, await work("Relatórios"), now);
    await saveEntry(today, "08:30", null, await work("Relatórios Digna"), now);
    await saveEntry(today, "09:00", null, pause, now);

    const day = await getTimeDay(today);
    expect(day?.entries).toMatchObject([
      {
        startTime: "08:30",
        minutes: 30,
        kind: "WORK",
        description: "Relatórios Digna",
        category: { id: categoryIdProjeto },
        project: null,
      },
      { startTime: "09:00", minutes: 30, kind: "BREAK", description: "Almoço", category: null },
    ]);
  });

  it("only accepts blocks of the grid, up to the current block of an open day", async () => {
    await startToday();

    await expect(saveEntry(today, "08:45", null, await work("X"), now)).rejects.toBeInstanceOf(
      SlotNotFoundError,
    );
    // Now is 11:00: the 11:00 block is the current one, 11:30 is not there yet.
    await saveEntry(today, "11:00", null, await work("Agora"), now);
    await expect(saveEntry(today, "11:30", null, await work("X"), now)).rejects.toBeInstanceOf(
      SlotNotFoundError,
    );
    await expect(saveEntry(yesterday, "09:00", null, await work("X"), now)).rejects.toBeInstanceOf(
      DayNotStartedError,
    );
  });

  it("creates a project by name, reusing it regardless of case", async () => {
    await startToday();

    await saveEntry(today, "08:30", null, await work("Relatórios", "Digna"), now);
    await saveEntry(today, "09:00", null, await work("AD", "digna"), now);

    expect((await listTimeProjects()).map((project) => project.name)).toEqual(["Digna"]);
    const day = await getTimeDay(today);
    expect(new Set(day?.entries.map((entry) => entry.project?.name))).toEqual(new Set(["Digna"]));
  });

  it("repeats the previous work entry of the day", async () => {
    await startToday();
    await saveEntry(today, "08:30", null, await work("Relatórios", "Digna"), now);
    await saveEntry(today, "09:00", null, pause, now);

    await repeatPrevious(today, "09:30", null, now);

    const repeated = (await getTimeDay(today))?.entries.find(
      (entry) => entry.startTime === "09:30",
    );
    expect(repeated).toMatchObject({
      kind: "WORK",
      description: "Relatórios",
      project: { name: "Digna" },
    });
    await expect(repeatPrevious(today, "08:15", null, now)).rejects.toBeInstanceOf(
      NothingToRepeatError,
    );
  });

  it("splits a block in halves, keeping a whole entry in the first half, and joins it back", async () => {
    await startToday();
    await saveEntry(today, "10:00", null, await work("AD"), now);

    await splitSlot(today, "10:00", now);
    await saveEntry(today, "10:00", "SECOND", await work("Atendimento Hanna"), now);

    let entries = (await getTimeDay(today))?.entries ?? [];
    expect(entries.map((entry) => [entry.startTime, entry.minutes, entry.description])).toEqual([
      ["10:00", 15, "AD"],
      ["10:15", 15, "Atendimento Hanna"],
    ]);
    await expect(joinSlot(today, "10:00", now)).rejects.toBeInstanceOf(JoinConflictError);

    await clearSlot(today, "10:00", "SECOND");
    await joinSlot(today, "10:00", now);
    entries = (await getTimeDay(today))?.entries ?? [];
    expect(entries.map((entry) => [entry.startTime, entry.minutes, entry.description])).toEqual([
      ["10:00", 30, "AD"],
    ]);
  });

  it("suggests the texts already used, most recent first, without repeating", async () => {
    await startToday();
    await saveEntry(today, "08:30", null, await work("E-mail"), now);
    await saveEntry(today, "09:00", null, await work("Relatórios"), now);
    await saveEntry(today, "09:30", null, await work("E-mail"), now);

    expect(await listDescriptions()).toEqual(["E-mail", "Relatórios"]);
  });
});

describe("time categories and projects", () => {
  it("refuses an archived category or project for a new entry", async () => {
    await startToday();
    const id = await categoryId("Estudo");
    await setTimeCategoryArchived(id, true);

    await expect(
      saveEntry(
        today,
        "08:30",
        null,
        { kind: "WORK", description: "Ler", categoryId: id, projectName: null },
        now,
      ),
    ).rejects.toBeInstanceOf(TimeCategoryArchivedError);

    await saveEntry(today, "09:00", null, await work("Relatórios", "Digna"), now);
    const project = (await listTimeProjects())[0]!;
    await setTimeProjectArchived(project.id, true);
    await expect(
      saveEntry(today, "09:30", null, await work("Mais", "Digna"), now),
    ).rejects.toBeInstanceOf(TimeProjectArchivedError);
  });

  it("deletes an unused category and refuses one in use", async () => {
    await startToday();
    const unused = await createTimeCategory({ name: "Leitura técnica" });
    await deleteTimeCategory(unused.id);
    expect((await listTimeCategories({ includeArchived: true })).map((c) => c.name)).not.toContain(
      "Leitura técnica",
    );

    await saveEntry(today, "08:30", null, await work("Relatórios"), now);
    await expect(deleteTimeCategory(await categoryId())).rejects.toBeInstanceOf(
      TimeCategoryInUseError,
    );
  });
});

describe("listTimeDays (plan 032)", () => {
  it("brings the days of the range, oldest first, with their entries", async () => {
    const id = await categoryId();
    for (const date of ["2026-11-15", "2026-11-17", "2026-11-20"]) {
      await startDay(date, { startTime: "09:00", slotMinutes: 30, endTime: "10:00" }, now);
    }
    await saveEntry(
      "2026-11-17",
      "09:00",
      null,
      { kind: "WORK", description: "Relatórios", categoryId: id, projectName: "Digna" },
      now,
    );

    const days = await listTimeDays("2026-11-16", "2026-11-20");

    expect(days.map((day) => day.date)).toEqual(["2026-11-17", "2026-11-20"]);
    expect(days[0]?.entries).toMatchObject([
      { startTime: "09:00", category: { id }, project: { name: "Digna" } },
    ]);
  });
});
