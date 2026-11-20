"use server";
// Every exported function in a "use server" file becomes a Server Action: the
// browser calls it like an endpoint, so inputs are untrusted and validated here.

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/components/forms/use-schema-form";
import { requireSession } from "@/modules/auth/session";
import { isValidDateOnly, todayInAppTimeZone } from "@/lib/dates";
import { GoalNotFoundError } from "@/modules/goals/service";
import { routineBlockerText } from "@/modules/pdi/labels";
import {
  ActionFinishedError,
  CategoryDisallowsRoutineError,
  CycleClosedError,
  PdiActionNotFoundError,
} from "@/modules/pdi/service";
import {
  type LinkExistingRoutineValues,
  type RoutineFieldErrors,
  type RoutineFormValues,
  linkExistingRoutineSchema,
  readRoutineForm,
  routineInputSchema,
  routineLinkSchema,
  routineLogInputSchema,
} from "@/modules/routines/schemas";
import {
  FutureDateError,
  RoutineAlreadyLinkedError,
  RoutineEndedError,
  RoutineNotFoundError,
  RoutineNotScheduledError,
  RoutineNotStartedError,
  clearLog,
  createRoutine,
  deleteRoutine,
  endRoutine,
  linkRoutine,
  logRoutine,
  unlinkRoutine,
  updateRoutine,
} from "@/modules/routines/service";

export type RoutineFormState = {
  errors?: RoutineFieldErrors;
  formError?: string;
  values?: RoutineFormValues;
};

const goalGone: RoutineFieldErrors = { goalId: ["Este objetivo não existe mais."] };

/** Logs show up on "Hoje", on the dashboard, on the routine pages and on goal pages. */
function revalidateRoutineScreens() {
  revalidatePath("/today");
  revalidatePath("/");
  revalidatePath("/routines", "layout");
  revalidatePath("/goals", "layout");
  // Logs of linked routines are evidence on the PDI pages.
  revalidatePath("/pdi", "layout");
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

/** Why a routine could not be linked to the PDI action, for the form. */
function linkError(error: unknown): string | null {
  if (error instanceof PdiActionNotFoundError) return "Esta ação de PDI não existe mais.";
  if (error instanceof CycleClosedError) return routineBlockerText.CYCLE_CLOSED;
  if (error instanceof ActionFinishedError) return routineBlockerText.ACTION_FINISHED;
  if (error instanceof CategoryDisallowsRoutineError) return routineBlockerText.CATEGORY;
  return null;
}

export async function createRoutineAction(
  _previous: RoutineFormState,
  formData: FormData,
): Promise<RoutineFormState> {
  await requireSession();
  const values = readRoutineForm(formData);
  const parsed = routineInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  const link = routineLinkSchema.safeParse({ pdiActionId: formData.get("pdiActionId") ?? "" });
  if (!link.success) return { formError: "Esta ação de PDI não existe mais.", values };

  let destination: string;
  try {
    const routine = await createRoutine(parsed.data, link.data.pdiActionId);
    // Created from a PDI action: back to the action, where it shows as evidence.
    destination = routine.pdiAction
      ? `/pdi/${routine.pdiAction.cycleId}/actions/${routine.pdiAction.id}`
      : `/routines/${routine.id}`;
  } catch (error) {
    if (error instanceof GoalNotFoundError) return { errors: goalGone, values };
    const formError = linkError(error);
    if (formError) return { formError, values };
    throw error;
  }
  revalidateRoutineScreens();
  redirect(destination);
}

export async function updateRoutineAction(
  id: string,
  _previous: RoutineFormState,
  formData: FormData,
): Promise<RoutineFormState> {
  await requireSession();
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
  await requireSession();
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
  await requireSession();
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
// Link to a PDI action (plan 020)
// ---------------------------------------------------------------------------

/** "Vincular rotina existente" on a PDI action page. */
export async function linkRoutineAction(
  actionId: string,
  _previous: FormState<LinkExistingRoutineValues>,
  formData: FormData,
): Promise<FormState<LinkExistingRoutineValues>> {
  await requireSession();
  const values = { routineId: String(formData.get("routineId") ?? "") };
  const parsed = linkExistingRoutineSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await linkRoutine(actionId, parsed.data.routineId, todayInAppTimeZone());
  } catch (error) {
    const routineError = linkedRoutineError(error);
    if (routineError) return { errors: { routineId: [routineError] }, values };
    const formError = linkError(error);
    if (formError) return { formError, values };
    throw error;
  }
  revalidateRoutineScreens();
  refresh();
  return {};
}

/** Why the chosen routine cannot be linked (another tab changed it meanwhile). */
function linkedRoutineError(error: unknown): string | null {
  if (error instanceof RoutineNotFoundError) return "Esta rotina não existe mais.";
  if (error instanceof RoutineAlreadyLinkedError) {
    return "Esta rotina já está vinculada a uma ação.";
  }
  if (error instanceof RoutineEndedError) return "Esta rotina já foi encerrada.";
  return null;
}

export async function unlinkRoutineAction(routineId: string): Promise<void> {
  await requireSession();
  try {
    await unlinkRoutine(routineId);
  } catch (error) {
    // The button is hidden for these cases; a stale page just gets refreshed.
    if (!(error instanceof RoutineNotFoundError || error instanceof CycleClosedError)) {
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
  await requireSession();
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
  await requireSession();
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
