"use server";
// Every exported function in a "use server" file becomes a Server Action: the
// browser calls it like an endpoint, so inputs are untrusted and validated here.

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { CategoryNotFoundError } from "@/modules/categories/service";
import { GoalNotFoundError } from "@/modules/goals/service";
import {
  type ActionFieldErrors,
  type ActionFormValues,
  type AreaFieldErrors,
  type AreaFormValues,
  type CheckInFieldErrors,
  type CheckInFormValues,
  type CycleFieldErrors,
  type CycleFormValues,
  actionInputSchema,
  areaInputSchema,
  checkInInputSchema,
  cycleInputSchema,
} from "@/modules/pdi/schemas";
import {
  ActiveCycleExistsError,
  AreaNotInCycleError,
  CategoryArchivedError,
  CycleClosedError,
  CycleNotClosedError,
  PdiActionNotFoundError,
  PdiAreaNotFoundError,
  PdiCheckInNotFoundError,
  PdiCycleNotFoundError,
  closeCycle,
  createAction,
  createArea,
  createCheckIn,
  createCycle,
  deleteAction,
  deleteArea,
  deleteCheckIn,
  deleteCycle,
  getAction,
  getArea,
  getCheckIn,
  reopenCycle,
  updateAction,
  updateArea,
  updateCheckIn,
  updateCycle,
} from "@/modules/pdi/service";

type State<Values, Errors> = { errors?: Errors; formError?: string; values?: Values };

export type CycleFormState = State<CycleFormValues, CycleFieldErrors>;
export type AreaFormState = State<AreaFormValues, AreaFieldErrors>;
export type ActionFormState = State<ActionFormValues, ActionFieldErrors>;
export type CheckInFormState = State<CheckInFormValues, CheckInFieldErrors>;

const CLOSED_MESSAGE = "Este ciclo está encerrado e não pode ser alterado.";

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Reads the named text fields of a form into an object. */
function readFields<Values>(formData: FormData, names: readonly (keyof Values & string)[]) {
  return Object.fromEntries(names.map((name) => [name, readText(formData, name)])) as Values;
}

/** PDI data shows up on its own pages and on goal pages. */
function revalidatePdiScreens() {
  revalidatePath("/pdi", "layout");
  revalidatePath("/goals", "layout");
}

/**
 * Turns the errors every PDI form can hit into a form state, or rethrows.
 * `notFound` is the message for the record being edited having been deleted.
 */
function commonErrors<Values>(error: unknown, values: Values, notFound: string) {
  if (error instanceof CycleClosedError) return { formError: CLOSED_MESSAGE, values };
  if (
    error instanceof PdiCycleNotFoundError ||
    error instanceof PdiAreaNotFoundError ||
    error instanceof PdiActionNotFoundError ||
    error instanceof PdiCheckInNotFoundError
  ) {
    return { formError: notFound, values };
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------

const cycleFields = [
  "title",
  "startDate",
  "endDate",
  "status",
  "managerName",
  "careerObjective",
  "selfAssessment",
  "managerFeedback",
  "finalRating",
] as const;

const activeExists: CycleFieldErrors = {
  status: ["Já existe um ciclo ativo. Encerre-o antes de ativar outro."],
};

export async function createCycleAction(
  _previous: CycleFormState,
  formData: FormData,
): Promise<CycleFormState> {
  const values = readFields<CycleFormValues>(formData, cycleFields);
  const parsed = cycleInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  let cycleId: string;
  try {
    cycleId = (await createCycle(parsed.data)).id;
  } catch (error) {
    if (error instanceof ActiveCycleExistsError) return { errors: activeExists, values };
    throw error;
  }
  revalidatePdiScreens();
  redirect(`/pdi/${cycleId}`);
}

export async function updateCycleAction(
  id: string,
  _previous: CycleFormState,
  formData: FormData,
): Promise<CycleFormState> {
  const values = readFields<CycleFormValues>(formData, cycleFields);
  const parsed = cycleInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await updateCycle(id, parsed.data);
  } catch (error) {
    if (error instanceof ActiveCycleExistsError) return { errors: activeExists, values };
    return commonErrors(error, values, "Este ciclo não existe mais.");
  }
  revalidatePdiScreens();
  redirect(`/pdi/${id}`);
}

export async function deleteCycleAction(id: string): Promise<void> {
  try {
    await deleteCycle(id);
  } catch (error) {
    // Closed meanwhile (the button is hidden then): show the current state.
    if (error instanceof CycleClosedError) {
      refresh();
      return;
    }
    if (!(error instanceof PdiCycleNotFoundError)) throw error;
  }
  revalidatePdiScreens();
  redirect("/pdi");
}

export async function closeCycleAction(id: string): Promise<void> {
  await ignoreStale(() => closeCycle(id));
  revalidatePdiScreens();
  refresh();
}

export async function reopenCycleAction(id: string): Promise<void> {
  await ignoreStale(() => reopenCycle(id));
  revalidatePdiScreens();
  refresh();
}

/**
 * Status buttons only show when they apply, so these errors mean the page is
 * stale (changed in another tab): refreshing shows the current state.
 */
async function ignoreStale(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!(
      error instanceof CycleClosedError ||
      error instanceof CycleNotClosedError ||
      error instanceof ActiveCycleExistsError ||
      error instanceof PdiCycleNotFoundError
    )) {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

const areaFields = ["name", "description", "expectedOutcome"] as const;

export async function createAreaAction(
  cycleId: string,
  _previous: AreaFormState,
  formData: FormData,
): Promise<AreaFormState> {
  const values = readFields<AreaFormValues>(formData, areaFields);
  const parsed = areaInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await createArea(cycleId, parsed.data);
  } catch (error) {
    return commonErrors(error, values, "Este ciclo não existe mais.");
  }
  revalidatePdiScreens();
  redirect(`/pdi/${cycleId}`);
}

export async function updateAreaAction(
  areaId: string,
  _previous: AreaFormState,
  formData: FormData,
): Promise<AreaFormState> {
  const values = readFields<AreaFormValues>(formData, areaFields);
  const parsed = areaInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  let cycleId: string;
  try {
    cycleId = (await updateArea(areaId, parsed.data)).cycleId;
  } catch (error) {
    return commonErrors(error, values, "Esta área não existe mais.");
  }
  revalidatePdiScreens();
  redirect(`/pdi/${cycleId}`);
}

export async function deleteAreaAction(areaId: string): Promise<void> {
  await deleteInCycle(async () => {
    const { cycleId } = await getArea(areaId);
    await deleteArea(areaId);
    return cycleId;
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const actionFields = [
  "areaId",
  "categoryId",
  "title",
  "description",
  "expectedResult",
  "dueDate",
  "status",
  "evidence",
  "managerComment",
  "goalId",
] as const;

function actionReferenceErrors(error: unknown): ActionFieldErrors | null {
  if (error instanceof AreaNotInCycleError) return { areaId: ["Escolha uma área deste ciclo."] };
  if (error instanceof CategoryArchivedError) {
    return { categoryId: ["Esta categoria está arquivada. Escolha outra."] };
  }
  if (error instanceof CategoryNotFoundError) {
    return { categoryId: ["Esta categoria não existe mais."] };
  }
  if (error instanceof GoalNotFoundError) return { goalId: ["Este objetivo não existe mais."] };
  return null;
}

export async function createActionAction(
  cycleId: string,
  _previous: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const values = readFields<ActionFormValues>(formData, actionFields);
  const parsed = actionInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await createAction(cycleId, parsed.data);
  } catch (error) {
    const errors = actionReferenceErrors(error);
    if (errors) return { errors, values };
    return commonErrors(error, values, "Este ciclo não existe mais.");
  }
  revalidatePdiScreens();
  redirect(`/pdi/${cycleId}`);
}

export async function updateActionAction(
  actionId: string,
  _previous: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const values = readFields<ActionFormValues>(formData, actionFields);
  const parsed = actionInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  let cycleId: string;
  try {
    cycleId = (await updateAction(actionId, parsed.data)).cycleId;
  } catch (error) {
    const errors = actionReferenceErrors(error);
    if (errors) return { errors, values };
    return commonErrors(error, values, "Esta ação não existe mais.");
  }
  revalidatePdiScreens();
  redirect(`/pdi/${cycleId}`);
}

export async function deleteActionAction(actionId: string): Promise<void> {
  await deleteInCycle(async () => {
    const { cycleId } = await getAction(actionId);
    await deleteAction(actionId);
    return cycleId;
  });
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

const checkInFields = ["date", "summary", "nextSteps", "managerNotes"] as const;

export async function createCheckInAction(
  cycleId: string,
  _previous: CheckInFormState,
  formData: FormData,
): Promise<CheckInFormState> {
  const values = readFields<CheckInFormValues>(formData, checkInFields);
  const parsed = checkInInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await createCheckIn(cycleId, parsed.data);
  } catch (error) {
    return commonErrors(error, values, "Este ciclo não existe mais.");
  }
  revalidatePdiScreens();
  redirect(`/pdi/${cycleId}`);
}

export async function updateCheckInAction(
  checkInId: string,
  _previous: CheckInFormState,
  formData: FormData,
): Promise<CheckInFormState> {
  const values = readFields<CheckInFormValues>(formData, checkInFields);
  const parsed = checkInInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  let cycleId: string;
  try {
    cycleId = (await updateCheckIn(checkInId, parsed.data)).cycleId;
  } catch (error) {
    return commonErrors(error, values, "Este check-in não existe mais.");
  }
  revalidatePdiScreens();
  redirect(`/pdi/${cycleId}`);
}

export async function deleteCheckInAction(checkInId: string): Promise<void> {
  await deleteInCycle(async () => {
    const { cycleId } = await getCheckIn(checkInId);
    await deleteCheckIn(checkInId);
    return cycleId;
  });
}

/**
 * Runs a delete of something inside a cycle and goes back to that cycle. Gone
 * already, or the cycle closed meanwhile: just refresh the current page.
 */
async function deleteInCycle(operation: () => Promise<string>): Promise<void> {
  let cycleId: string;
  try {
    cycleId = await operation();
  } catch (error) {
    if (
      error instanceof CycleClosedError ||
      error instanceof PdiAreaNotFoundError ||
      error instanceof PdiActionNotFoundError ||
      error instanceof PdiCheckInNotFoundError
    ) {
      refresh();
      return;
    }
    throw error;
  }
  revalidatePdiScreens();
  redirect(`/pdi/${cycleId}`);
}
