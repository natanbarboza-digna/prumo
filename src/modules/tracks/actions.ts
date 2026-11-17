"use server";
// Every exported function in a "use server" file becomes a Server Action: the
// browser calls it like an endpoint, so inputs are untrusted and validated here.

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/modules/auth/session";
import type { TrackStepStatus } from "@/generated/prisma/enums";
import { GoalNotFoundError } from "@/modules/goals/service";
import {
  type TrackFieldErrors,
  type TrackFormValues,
  type TrackStepFieldErrors,
  type TrackStepFormValues,
  trackInputSchema,
  trackStepInputSchema,
} from "@/modules/tracks/schemas";
import {
  TrackNotFoundError,
  TrackStepNotFoundError,
  createStep,
  createTrack,
  deleteStep,
  deleteTrack,
  getStep,
  moveStep,
  setStepStatus,
  updateStep,
  updateTrack,
} from "@/modules/tracks/service";

export type TrackFormState = {
  errors?: TrackFieldErrors;
  formError?: string;
  values?: TrackFormValues;
};

export type TrackStepFormState = {
  errors?: TrackStepFieldErrors;
  formError?: string;
  values?: TrackStepFormValues;
};

const statusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE"]);
const directionSchema = z.enum(["up", "down"]);

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readTrackForm(formData: FormData): TrackFormValues {
  return {
    title: readText(formData, "title"),
    description: readText(formData, "description"),
    goalId: readText(formData, "goalId"),
  };
}

function readStepForm(formData: FormData): TrackStepFormValues {
  return {
    title: readText(formData, "title"),
    status: readText(formData, "status") as TrackStepFormValues["status"],
    dueDate: readText(formData, "dueDate"),
    resourceUrl: readText(formData, "resourceUrl"),
    notes: readText(formData, "notes"),
  };
}

const goalGone: TrackFieldErrors = { goalId: ["Este objetivo não existe mais."] };

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

/** Tracks show up on their own pages and on the dashboard. */
function revalidateTrackScreens() {
  revalidatePath("/tracks");
  revalidatePath("/");
}

export async function createTrackAction(
  _previous: TrackFormState,
  formData: FormData,
): Promise<TrackFormState> {
  await requireSession();
  const values = readTrackForm(formData);
  const parsed = trackInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  let trackId: string;
  try {
    trackId = (await createTrack(parsed.data)).id;
  } catch (error) {
    if (error instanceof GoalNotFoundError) return { errors: goalGone, values };
    throw error;
  }
  revalidateTrackScreens();
  redirect(`/tracks/${trackId}`);
}

export async function updateTrackAction(
  id: string,
  _previous: TrackFormState,
  formData: FormData,
): Promise<TrackFormState> {
  await requireSession();
  const values = readTrackForm(formData);
  const parsed = trackInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await updateTrack(id, parsed.data);
  } catch (error) {
    if (error instanceof GoalNotFoundError) return { errors: goalGone, values };
    if (error instanceof TrackNotFoundError) {
      return { formError: "Esta trilha não existe mais.", values };
    }
    throw error;
  }
  revalidateTrackScreens();
  redirect(`/tracks/${id}`);
}

export async function deleteTrackAction(id: string): Promise<void> {
  await requireSession();
  try {
    await deleteTrack(id);
  } catch (error) {
    // Already gone: the outcome the user asked for, so carry on to the list.
    if (!(error instanceof TrackNotFoundError)) throw error;
  }
  revalidateTrackScreens();
  redirect("/tracks");
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export async function createStepAction(
  trackId: string,
  _previous: TrackStepFormState,
  formData: FormData,
): Promise<TrackStepFormState> {
  await requireSession();
  const values = readStepForm(formData);
  const parsed = trackStepInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await createStep(trackId, parsed.data);
  } catch (error) {
    if (error instanceof TrackNotFoundError) {
      return { formError: "Esta trilha não existe mais.", values };
    }
    throw error;
  }
  revalidateTrackScreens();
  redirect(`/tracks/${trackId}`);
}

export async function updateStepAction(
  stepId: string,
  _previous: TrackStepFormState,
  formData: FormData,
): Promise<TrackStepFormState> {
  await requireSession();
  const values = readStepForm(formData);
  const parsed = trackStepInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  let trackId: string;
  try {
    trackId = (await updateStep(stepId, parsed.data)).trackId;
  } catch (error) {
    if (error instanceof TrackStepNotFoundError) {
      return { formError: "Esta etapa não existe mais.", values };
    }
    throw error;
  }
  revalidateTrackScreens();
  redirect(`/tracks/${trackId}`);
}

export async function deleteStepAction(stepId: string): Promise<void> {
  await requireSession();
  let trackId: string;
  try {
    trackId = (await getStep(stepId)).trackId;
    await deleteStep(stepId);
  } catch (error) {
    if (error instanceof TrackStepNotFoundError) {
      refresh();
      return;
    }
    throw error;
  }
  revalidateTrackScreens();
  redirect(`/tracks/${trackId}`);
}

export async function setStepStatusAction(stepId: string, status: TrackStepStatus): Promise<void> {
  await requireSession();
  await ignoreMissingStep(() => setStepStatus(stepId, statusSchema.parse(status)));
  revalidateTrackScreens();
  // Stay on the same page and re-render it with the new data.
  refresh();
}

export async function moveStepAction(stepId: string, direction: "up" | "down"): Promise<void> {
  await requireSession();
  await ignoreMissingStep(() => moveStep(stepId, directionSchema.parse(direction)));
  refresh();
}

/** A step deleted in another tab is not an error worth a crash page: just refresh. */
async function ignoreMissingStep(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof TrackStepNotFoundError)) throw error;
  }
}
