"use server";
// Every exported function in a "use server" file becomes a Server Action: the
// browser calls it like an endpoint, so inputs are untrusted and validated here.

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isValidDateOnly, todayInAppTimeZone } from "@/lib/dates";
import { GoalNotFoundError } from "@/modules/goals/service";
import {
  type RoutineFieldErrors,
  type RoutineFormValues,
  readRoutineForm,
  routineInputSchema,
  routineLogInputSchema,
} from "@/modules/routines/schemas";
import {
  FutureDateError,
  RoutineNotFoundError,
  RoutineNotScheduledError,
  RoutineNotStartedError,
  clearLog,
  createRoutine,
  deleteRoutine,
  endRoutine,
  logRoutine,
  updateRoutine,
} from "@/modules/routines/service";

export type RoutineFormState = {
  errors?: RoutineFieldErrors;
  formError?: string;
  values?: RoutineFormValues;
};

const goalGone: RoutineFieldErrors = { goalId: ["Este objetivo não existe mais."] };

/** Logs show up on "Hoje", on the routine pages and on goal pages. */
function revalidateRoutineScreens() {
  revalidatePath("/today");
  revalidatePath("/routines", "layout");
  revalidatePath("/goals", "layout");
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

export async function createRoutineAction(
  _previous: RoutineFormState,
  formData: FormData,
): Promise<RoutineFormState> {
  const values = readRoutineForm(formData);
  const parsed = routineInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  let routineId: string;
  try {
    routineId = (await createRoutine(parsed.data)).id;
  } catch (error) {
    if (error instanceof GoalNotFoundError) return { errors: goalGone, values };
    throw error;
  }
  revalidateRoutineScreens();
  redirect(`/routines/${routineId}`);
}

export async function updateRoutineAction(
  id: string,
  _previous: RoutineFormState,
  formData: FormData,
): Promise<RoutineFormState> {
  const values = readRoutineForm(formData);
  const parsed = routineInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await updateRoutine(id, parsed.data);
  } catch (error) {
    if (error instanceof GoalNotFoundError) return { errors: goalGone, values };
    if (error instanceof RoutineNotFoundError) {
      return { formError: "Esta rotina não existe mais.", values };
    }
    throw error;
  }
  revalidateRoutineScreens();
  redirect(`/routines/${id}`);
}

export async function deleteRoutineAction(id: string): Promise<void> {
  try {
    await deleteRoutine(id);
  } catch (error) {
    // Already gone: the outcome the user asked for, so carry on to the list.
    if (!(error instanceof RoutineNotFoundError)) throw error;
  }
  revalidateRoutineScreens();
  redirect("/routines");
}

export async function endRoutineAction(id: string): Promise<void> {
  try {
    await endRoutine(id, todayInAppTimeZone());
  } catch (error) {
    // The button is hidden for these cases; a stale page just gets refreshed.
    if (!(error instanceof RoutineNotFoundError || error instanceof RoutineNotStartedError)) {
      throw error;
    }
  }
  revalidateRoutineScreens();
  refresh();
}

// ---------------------------------------------------------------------------
// Daily logs
// ---------------------------------------------------------------------------

/** "Feito" and "Pular" submit the same form; the clicked button sends `status`. */
export async function logRoutineAction(
  routineId: string,
  date: string,
  formData: FormData,
): Promise<void> {
  const parsed = routineLogInputSchema.safeParse({
    status: formData.get("status"),
    note: formData.get("note") ?? undefined,
  });
  if (parsed.success && isValidDateOnly(date)) {
    await ignoreStaleLog(() => logRoutine(routineId, date, parsed.data, todayInAppTimeZone()));
  }
  revalidateRoutineScreens();
  refresh();
}

export async function clearLogAction(routineId: string, date: string): Promise<void> {
  if (isValidDateOnly(date)) await ignoreStaleLog(() => clearLog(routineId, date));
  revalidateRoutineScreens();
  refresh();
}

/**
 * The buttons only exist for valid days, so these errors mean the page is
 * stale (routine deleted or edited in another tab, or a page left open past
 * midnight): refreshing shows the current state instead of a crash page.
 */
async function ignoreStaleLog(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!(
      error instanceof RoutineNotFoundError ||
      error instanceof RoutineNotScheduledError ||
      error instanceof FutureDateError
    )) {
      throw error;
    }
  }
}
