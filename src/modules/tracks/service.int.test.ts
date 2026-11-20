import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { todayInAppTimeZone } from "@/lib/dates";
import {
  GoalNotFoundError,
  createGoal,
  deleteGoal,
  getGoalProgress,
} from "@/modules/goals/service";
import type { TrackFilter, TrackInput, TrackStepInput } from "@/modules/tracks/schemas";
import {
  TrackArchivedError,
  TrackNotFoundError,
  TrackStepNotFoundError,
  archiveTrack,
  createStep,
  createTrack,
  deleteStep,
  duplicateTrack,
  deleteTrack,
  getTrack,
  listOpenStepsWithDueDate,
  listTracks,
  moveStep,
  setStepStatus,
  unarchiveTrack,
  updateStep,
  updateTrack,
} from "@/modules/tracks/service";

const MISSING_ID = "0190a3e4-0000-7000-8000-000000000000";

function trackInput(overrides: Partial<TrackInput> = {}): TrackInput {
  return { title: "Trilha", description: null, goalId: null, ...overrides };
}

function stepInput(overrides: Partial<TrackStepInput> = {}): TrackStepInput {
  return {
    title: "Etapa",
    status: "NOT_STARTED",
    dueDate: null,
    resourceUrl: null,
    notes: null,
    ...overrides,
  };
}

async function goal(title = "Objetivo") {
  return createGoal({ title, description: null, status: "NOT_STARTED", targetDate: null });
}

async function trackWithSteps(...titles: string[]) {
  const track = await createTrack(trackInput());
  const steps = [];
  for (const title of titles) steps.push(await createStep(track.id, stepInput({ title })));
  return { track, steps };
}

async function stepTitlesInOrder(trackId: string) {
  return (await getTrack(trackId)).steps.map((step) => `${step.order}:${step.title}`);
}

describe("tracks", () => {
  it("creates a track without a goal", async () => {
    const track = await createTrack(trackInput({ title: "React" }));

    expect(track).toMatchObject({ title: "React", description: null, goal: null });
    expect(track.counts).toEqual({ total: 0, done: 0, inProgress: 0 });
  });

  it("creates a track linked to a goal", async () => {
    const linked = await goal("Ser sênior");

    const track = await createTrack(trackInput({ goalId: linked.id }));

    expect(track.goal).toEqual({ id: linked.id, title: "Ser sênior" });
  });

  it("rejects a goal that does not exist", async () => {
    await expect(createTrack(trackInput({ goalId: MISSING_ID }))).rejects.toBeInstanceOf(
      GoalNotFoundError,
    );
  });

  it("lists tracks newest first with step counts and goal title", async () => {
    const linked = await goal("Objetivo A");
    const older = await createTrack(trackInput({ title: "Antiga", goalId: linked.id }));
    await db.$executeRaw`UPDATE tracks SET created_at = '2026-01-01' WHERE id = ${older.id}::uuid`;
    const newer = await createTrack(trackInput({ title: "Nova" }));
    const first = await createStep(older.id, stepInput());
    await createStep(older.id, stepInput({ status: "IN_PROGRESS" }));
    await setStepStatus(first.id, "DONE");

    const tracks = await listTracks();

    expect(tracks.map((track) => track.id)).toEqual([newer.id, older.id]);
    expect(tracks[1]).toMatchObject({
      goal: { id: linked.id, title: "Objetivo A" },
      counts: { total: 2, done: 1, inProgress: 1 },
    });
  });

  it("filters tracks by goal", async () => {
    const linked = await goal();
    const mine = await createTrack(trackInput({ goalId: linked.id }));
    await createTrack(trackInput());

    const tracks = await listTracks({ goalId: linked.id });

    expect(tracks.map((track) => track.id)).toEqual([mine.id]);
  });

  it("updates a track and can clear its goal", async () => {
    const linked = await goal();
    const track = await createTrack(trackInput({ goalId: linked.id }));

    const updated = await updateTrack(track.id, trackInput({ title: "Renomeada", goalId: null }));

    expect(updated).toMatchObject({ title: "Renomeada", goal: null });
  });

  it.each([MISSING_ID, "not-a-uuid"])("throws TrackNotFoundError for %j", async (id) => {
    await expect(getTrack(id)).rejects.toBeInstanceOf(TrackNotFoundError);
    await expect(updateTrack(id, trackInput())).rejects.toBeInstanceOf(TrackNotFoundError);
    await expect(deleteTrack(id)).rejects.toBeInstanceOf(TrackNotFoundError);
  });

  it("deletes a track together with its steps", async () => {
    const { track } = await trackWithSteps("A", "B");

    await deleteTrack(track.id);

    await expect(getTrack(track.id)).rejects.toBeInstanceOf(TrackNotFoundError);
    expect(await db.trackStep.count()).toBe(0);
  });

  it("keeps the track and clears the link when its goal is deleted", async () => {
    const linked = await goal();
    const track = await createTrack(trackInput({ goalId: linked.id }));

    await deleteGoal(linked.id);

    expect((await getTrack(track.id)).goal).toBeNull();
  });
});

describe("steps", () => {
  it("appends new steps at the end", async () => {
    const { track } = await trackWithSteps("A", "B", "C");

    expect(await stepTitlesInOrder(track.id)).toEqual(["1:A", "2:B", "3:C"]);
  });

  it("stores the optional fields", async () => {
    const { track } = await trackWithSteps();

    const step = await createStep(
      track.id,
      stepInput({
        dueDate: "2026-12-31",
        resourceUrl: "https://nextjs.org/docs",
        notes: "Ler com calma",
      }),
    );

    expect(step).toMatchObject({
      trackId: track.id,
      order: 1,
      dueDate: "2026-12-31",
      resourceUrl: "https://nextjs.org/docs",
      notes: "Ler com calma",
    });
  });

  it("throws TrackNotFoundError when adding a step to a missing track", async () => {
    await expect(createStep(MISSING_ID, stepInput())).rejects.toBeInstanceOf(TrackNotFoundError);
  });

  it("moves a step up and down", async () => {
    const { track, steps } = await trackWithSteps("A", "B", "C");

    await moveStep(steps[2]!.id, "up");
    expect(await stepTitlesInOrder(track.id)).toEqual(["1:A", "2:C", "3:B"]);

    await moveStep(steps[0]!.id, "down");
    expect(await stepTitlesInOrder(track.id)).toEqual(["1:C", "2:A", "3:B"]);
  });

  it("does nothing when moving past either end", async () => {
    const { track, steps } = await trackWithSteps("A", "B");

    await moveStep(steps[0]!.id, "up");
    await moveStep(steps[1]!.id, "down");

    expect(await stepTitlesInOrder(track.id)).toEqual(["1:A", "2:B"]);
  });

  it("closes the gap when a step is deleted", async () => {
    const { track, steps } = await trackWithSteps("A", "B", "C", "D");

    await deleteStep(steps[1]!.id);

    expect(await stepTitlesInOrder(track.id)).toEqual(["1:A", "2:C", "3:D"]);
  });

  it("updates a step without changing its position", async () => {
    const { steps } = await trackWithSteps("A", "B");

    const updated = await updateStep(steps[1]!.id, stepInput({ title: "B2", status: "DONE" }));

    expect(updated).toMatchObject({ title: "B2", status: "DONE", order: 2 });
  });

  it("changes only the status with setStepStatus", async () => {
    const { track } = await trackWithSteps();
    const step = await createStep(track.id, stepInput({ title: "Manter", notes: "nota" }));

    const updated = await setStepStatus(step.id, "DONE");

    expect(updated).toMatchObject({ title: "Manter", notes: "nota", status: "DONE" });
  });

  it.each([MISSING_ID, "not-a-uuid"])("throws TrackStepNotFoundError for %j", async (id) => {
    await expect(updateStep(id, stepInput())).rejects.toBeInstanceOf(TrackStepNotFoundError);
    await expect(setStepStatus(id, "DONE")).rejects.toBeInstanceOf(TrackStepNotFoundError);
    await expect(moveStep(id, "up")).rejects.toBeInstanceOf(TrackStepNotFoundError);
    await expect(deleteStep(id)).rejects.toBeInstanceOf(TrackStepNotFoundError);
  });
});

describe("listOpenStepsWithDueDate", () => {
  it("lists the steps not done that have a due date, with their track", async () => {
    const track = await createTrack(trackInput({ title: "Inglês" }));
    const open = await createStep(track.id, stepInput({ title: "Aberta", dueDate: "2026-11-20" }));
    const started = await createStep(
      track.id,
      stepInput({ title: "Começada", status: "IN_PROGRESS", dueDate: "2026-11-10" }),
    );
    await createStep(track.id, stepInput({ title: "Sem prazo" }));
    const done = await createStep(track.id, stepInput({ title: "Feita", dueDate: "2026-11-01" }));
    await setStepStatus(done.id, "DONE");

    const steps = await listOpenStepsWithDueDate();

    expect(steps).toHaveLength(2);
    expect(steps).toEqual(
      expect.arrayContaining([
        {
          id: open.id,
          title: "Aberta",
          dueDate: "2026-11-20",
          track: { id: track.id, title: "Inglês" },
        },
        {
          id: started.id,
          title: "Começada",
          dueDate: "2026-11-10",
          track: { id: track.id, title: "Inglês" },
        },
      ]),
    );
  });
});

describe("archived tracks (plan 024)", () => {
  async function setStatuses(...statuses: ("NOT_STARTED" | "IN_PROGRESS" | "DONE")[]) {
    const { track, steps } = await trackWithSteps(...statuses.map((_, i) => `Etapa ${i + 1}`));
    for (const [index, status] of statuses.entries()) {
      await setStepStatus(steps[index]!.id, status);
    }
    return track;
  }

  it("archives with today's date and unarchives; repeating changes nothing", async () => {
    const { track } = await trackWithSteps("Etapa");

    const archived = await archiveTrack(track.id);
    expect(archived.archivedAt).toBe(todayInAppTimeZone());
    expect((await archiveTrack(track.id)).archivedAt).toBe(archived.archivedAt);

    expect((await unarchiveTrack(track.id)).archivedAt).toBeNull();
    expect((await unarchiveTrack(track.id)).archivedAt).toBeNull();
  });

  it("makes the track and its steps read-only, but lets it be deleted", async () => {
    const { track, steps } = await trackWithSteps("Primeira", "Segunda");
    const step = steps[0]!;
    await archiveTrack(track.id);

    for (const change of [
      () => updateTrack(track.id, trackInput({ title: "Outro" })),
      () => createStep(track.id, stepInput()),
      () => updateStep(step.id, stepInput({ title: "Outra" })),
      () => setStepStatus(step.id, "DONE"),
      () => moveStep(step.id, "down"),
      () => deleteStep(step.id),
    ]) {
      await expect(change()).rejects.toBeInstanceOf(TrackArchivedError);
    }
    expect(await stepTitlesInOrder(track.id)).toEqual(["1:Primeira", "2:Segunda"]);

    await deleteTrack(track.id);
    await expect(getTrack(track.id)).rejects.toBeInstanceOf(TrackNotFoundError);
  });

  it("filters the list by situation, leaving archived tracks out unless asked", async () => {
    const notStarted = await setStatuses("NOT_STARTED");
    const inProgress = await setStatuses("DONE", "NOT_STARTED");
    const done = await setStatuses("DONE");
    const archived = await setStatuses("IN_PROGRESS");
    await archiveTrack(archived.id);
    const ids = async (filter: TrackFilter) =>
      (await listTracks({ filter })).map((track) => track.id).sort();
    const sorted = (...tracks: { id: string }[]) => tracks.map((track) => track.id).sort();

    expect(await ids("ACTIVE")).toEqual(sorted(notStarted, inProgress, done));
    expect(await ids("NOT_STARTED")).toEqual(sorted(notStarted));
    expect(await ids("IN_PROGRESS")).toEqual(sorted(inProgress));
    expect(await ids("DONE")).toEqual(sorted(done));
    expect(await ids("ARCHIVED")).toEqual(sorted(archived));
    expect(await ids("ALL")).toEqual(sorted(notStarted, inProgress, done, archived));
    // Without a filter: the default list.
    expect((await listTracks()).map((track) => track.id).sort()).toEqual(await ids("ACTIVE"));
  });

  it("keeps archived tracks on their goal, still counting toward its progress", async () => {
    const owner = await goal();
    const track = await createTrack(trackInput({ goalId: owner.id }));
    await createStep(track.id, stepInput({ status: "DONE" }));
    await archiveTrack(track.id);

    expect((await listTracks({ goalId: owner.id })).map((item) => item.id)).toEqual([track.id]);
    expect(await getGoalProgress(owner.id)).toMatchObject({ steps: { done: 1, total: 1 } });
  });

  it("leaves the steps of archived tracks out of the upcoming deadlines", async () => {
    const { track } = await trackWithSteps();
    await createStep(track.id, stepInput({ title: "Com prazo", dueDate: "2026-12-01" }));
    expect(await listOpenStepsWithDueDate()).toHaveLength(1);

    await archiveTrack(track.id);

    expect(await listOpenStepsWithDueDate()).toEqual([]);
  });

  it("rejects a track that does not exist", async () => {
    await expect(archiveTrack(MISSING_ID)).rejects.toBeInstanceOf(TrackNotFoundError);
    await expect(unarchiveTrack(MISSING_ID)).rejects.toBeInstanceOf(TrackNotFoundError);
  });
});

describe("duplicating a track (plan 026)", () => {
  it("copies the track and its steps in order, not started and without due dates", async () => {
    const owner = await goal();
    const original = await createTrack(
      trackInput({ title: "Inglês", description: "Do básico ao avançado", goalId: owner.id }),
    );
    await createStep(
      original.id,
      stepInput({
        title: "Gramática",
        status: "DONE",
        dueDate: "2026-10-01",
        resourceUrl: "https://exemplo.com/gramatica",
        notes: "Livro azul",
      }),
    );
    await createStep(original.id, stepInput({ title: "Conversação", status: "IN_PROGRESS" }));
    await createStep(original.id, stepInput({ title: "Prova", dueDate: "2026-12-15" }));

    const copy = await duplicateTrack(original.id);

    expect(copy.id).not.toBe(original.id);
    const detail = await getTrack(copy.id);
    expect(detail).toMatchObject({
      title: "Cópia de Inglês",
      description: "Do básico ao avançado",
      goal: { id: owner.id },
      archivedAt: null,
    });
    expect(
      detail.steps.map(({ order, title, status, dueDate, resourceUrl, notes }) => ({
        order,
        title,
        status,
        dueDate,
        resourceUrl,
        notes,
      })),
    ).toEqual([
      {
        order: 1,
        title: "Gramática",
        status: "NOT_STARTED",
        dueDate: null,
        resourceUrl: "https://exemplo.com/gramatica",
        notes: "Livro azul",
      },
      {
        order: 2,
        title: "Conversação",
        status: "NOT_STARTED",
        dueDate: null,
        resourceUrl: null,
        notes: null,
      },
      {
        order: 3,
        title: "Prova",
        status: "NOT_STARTED",
        dueDate: null,
        resourceUrl: null,
        notes: null,
      },
    ]);

    // The original is untouched.
    const unchanged = await getTrack(original.id);
    expect(unchanged.title).toBe("Inglês");
    expect(unchanged.steps.map((step) => [step.status, step.dueDate])).toEqual([
      ["DONE", "2026-10-01"],
      ["IN_PROGRESS", null],
      ["NOT_STARTED", "2026-12-15"],
    ]);
  });

  it("makes an active copy of an archived track", async () => {
    const { track } = await trackWithSteps("Etapa");
    await archiveTrack(track.id);

    const copy = await duplicateTrack(track.id);

    expect(copy.archivedAt).toBeNull();
    expect((await getTrack(track.id)).archivedAt).not.toBeNull();
  });

  it("copies a track without steps", async () => {
    const { track } = await trackWithSteps();

    const copy = await duplicateTrack(track.id);

    expect(copy.counts.total).toBe(0);
  });

  it("rejects a track that does not exist", async () => {
    await expect(duplicateTrack(MISSING_ID)).rejects.toBeInstanceOf(TrackNotFoundError);
  });
});
