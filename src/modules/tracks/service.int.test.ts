import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { GoalNotFoundError, createGoal, deleteGoal } from "@/modules/goals/service";
import type { TrackInput, TrackStepInput } from "@/modules/tracks/schemas";
import {
  TrackNotFoundError,
  TrackStepNotFoundError,
  createStep,
  createTrack,
  deleteStep,
  deleteTrack,
  getTrack,
  listTracks,
  moveStep,
  setStepStatus,
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
