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
  TrackArchivedError,
  TrackNotFoundError,
  TrackStepNotFoundError,
  archiveTrack,
  createStep,
  createTrack,
  deleteStep,
  deleteTrack,
  duplicateTrack,
  getStep,
  moveStep,
  setStepStatus,
  unarchiveTrack,
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

/** Archived in another tab while the form was open (plan 024). */
const ARCHIVED_MESSAGE = "Esta trilha está arquivada. Desarquive para fazer alterações.";

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

/** Tracks show up on their own pages, on goal pages and on the dashboard. */
function revalidateTrackScreens() {
  revalidatePath("/tracks", "layout");
  revalidatePath("/goals", "layout");
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
    if (error instanceof TrackArchivedError) return { formError: ARCHIVED_MESSAGE, values };
    throw error;
  }
  revalidateTrackScreens();
  redirect(`/tracks/${id}`);
}

/** "Arquivar trilha" and "Desarquivar" on the track page (plan 024). */
export async function archiveTrackAction(id: string): Promise<void> {
  await requireSession();
  await ignoreMissingTrack(() => archiveTrack(id));
  revalidateTrackScreens();
  refresh();
}

export async function unarchiveTrackAction(id: string): Promise<void> {
  await requireSession();
  await ignoreMissingTrack(() => unarchiveTrack(id));
  revalidateTrackScreens();
  refresh();
}

/** "Duplicar trilha" (plan 026): creates the copy and opens it. */
export async function duplicateTrackAction(id: string): Promise<void> {
  await requireSession();
  let copyId: string;
  try {
    copyId = (await duplicateTrack(id)).id;
  } catch (error) {
    // Deleted in another tab: refreshing shows the not-found page.
    if (error instanceof TrackNotFoundError) {
      refresh();
      return;
    }
    throw error;
  }
  revalidateTrackScreens();
  redirect(`/tracks/${copyId}`);
}

/** Deleted in another tab: refreshing shows the not-found page. */
async function ignoreMissingTrack(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof TrackNotFoundError)) throw error;
  }
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
    if (error instanceof TrackArchivedError) return { formError: ARCHIVED_MESSAGE, values };
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
    if (error instanceof TrackArchivedError) return { formError: ARCHIVED_MESSAGE, values };
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
    // Gone or archived meanwhile (the button is hidden then): show the current state.
    if (error instanceof TrackStepNotFoundError || error instanceof TrackArchivedError) {
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

/**
 * A step deleted, or its track archived, in another tab is not an error worth a
 * crash page: just refresh.
 */
async function ignoreMissingStep(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof TrackStepNotFoundError || error instanceof TrackArchivedError)) {
      throw error;
    }
  }
}
