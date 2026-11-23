"use server";
// Every exported function in a "use server" file becomes a Server Action: the
// browser calls it like an endpoint, so inputs are untrusted and validated here.

import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormState } from "@/components/forms/use-schema-form";
import { isValidDateOnly } from "@/lib/dates";
import { isValidTimeOfDay } from "@/lib/time-of-day";
import { requireSession } from "@/modules/auth/session";
import {
  type DayTimesValues,
  type EndDayValues,
  type EntryValues,
  type StartDayValues,
  type TimeCategoryValues,
  type TimeProjectValues,
  dayTimesSchema,
  endDaySchema,
  entrySchema,
  startDaySchema,
  timeCategorySchema,
  timeProjectSchema,
} from "@/modules/time/schemas";
import {
  CannotSplitError,
  DayAlreadyStartedError,
  DayNotStartedError,
  EntryOutsideDayError,
  FutureDayError,
  type Half,
  JoinConflictError,
  NothingToRepeatError,
  SlotNotFoundError,
  TimeCategoryArchivedError,
  TimeCategoryInUseError,
  TimeCategoryNameTakenError,
  TimeCategoryNotFoundError,
  TimeProjectArchivedError,
  TimeProjectNameTakenError,
  TimeProjectNotFoundError,
  clearSlot,
  createTimeCategory,
  deleteTimeCategory,
  endDay,
  joinSlot,
  renameTimeProject,
  repeatPrevious,
  saveEntry,
  setDayTimes,
  setTimeCategoryArchived,
  setTimeProjectArchived,
  splitSlot,
  startDay,
  updateTimeCategory,
} from "@/modules/time/service";

/** The time pages, and the dashboard (rule of the project, even before it shows time). */
function revalidateTimeScreens() {
  revalidatePath("/time", "layout");
  revalidatePath("/");
}

const read = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const halfSchema = z.enum(["FIRST", "SECOND"]).nullable();

/** Arguments bound on the server page; checked again because the browser sends them. */
function assertBlock(date: string, slotStart: string, half: Half | null) {
  if (
    !isValidDateOnly(date) ||
    !isValidTimeOfDay(slotStart) ||
    !halfSchema.safeParse(half).success
  ) {
    throw new Error("Invalid block.");
  }
}

const outsideMessage = (error: EntryOutsideDayError) =>
  `Os blocos ${error.startTimes.join(", ")} ficariam fora do expediente. Limpe-os antes.`;

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

export async function startDayAction(
  date: string,
  _previous: FormState<StartDayValues>,
  formData: FormData,
): Promise<FormState<StartDayValues>> {
  await requireSession();
  const values = {
    startTime: read(formData, "startTime"),
    slotMinutes: read(formData, "slotMinutes") as StartDayValues["slotMinutes"],
    endTime: read(formData, "endTime"),
  };
  const parsed = startDaySchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  if (!isValidDateOnly(date)) return { formError: "Data inválida.", values };
  try {
    await startDay(date, parsed.data);
  } catch (error) {
    if (error instanceof FutureDayError) {
      return { formError: "Não dá para registrar um dia que ainda não chegou.", values };
    }
    // Started in another tab: showing the day is what the user wanted.
    if (!(error instanceof DayAlreadyStartedError)) throw error;
  }
  revalidateTimeScreens();
  refresh();
  return {};
}

export async function endDayAction(
  date: string,
  _previous: FormState<EndDayValues>,
  formData: FormData,
): Promise<FormState<EndDayValues>> {
  await requireSession();
  const values = { endTime: read(formData, "endTime") };
  const parsed = endDaySchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    await endDay(date, parsed.data.endTime);
  } catch (error) {
    if (error instanceof EntryOutsideDayError) return { formError: outsideMessage(error), values };
    if (error instanceof DayNotStartedError)
      return { formError: "Este dia não foi começado.", values };
    throw error;
  }
  revalidateTimeScreens();
  refresh();
  return {};
}

export async function setDayTimesAction(
  date: string,
  _previous: FormState<DayTimesValues>,
  formData: FormData,
): Promise<FormState<DayTimesValues>> {
  await requireSession();
  const values = { startTime: read(formData, "startTime"), endTime: read(formData, "endTime") };
  const parsed = dayTimesSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    await setDayTimes(date, parsed.data);
  } catch (error) {
    if (error instanceof EntryOutsideDayError) return { formError: outsideMessage(error), values };
    if (error instanceof DayNotStartedError)
      return { formError: "Este dia não foi começado.", values };
    throw error;
  }
  revalidateTimeScreens();
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export async function saveEntryAction(
  date: string,
  slotStart: string,
  half: Half | null,
  _previous: FormState<EntryValues>,
  formData: FormData,
): Promise<FormState<EntryValues>> {
  await requireSession();
  assertBlock(date, slotStart, half);
  const values = {
    kind: "WORK" as const,
    description: read(formData, "description"),
    categoryId: read(formData, "categoryId"),
    projectName: read(formData, "projectName"),
  };
  const parsed = entrySchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    await saveEntry(date, slotStart, half, parsed.data);
  } catch (error) {
    if (error instanceof TimeCategoryArchivedError || error instanceof TimeCategoryNotFoundError) {
      return {
        errors: { categoryId: ["Esta categoria não pode receber registros novos."] },
        values,
      };
    }
    if (error instanceof TimeProjectArchivedError) {
      return {
        errors: { projectName: ["Este projeto está arquivado. Desarquive em Projetos."] },
        values,
      };
    }
    if (error instanceof SlotNotFoundError || error instanceof DayNotStartedError) {
      return { formError: "Este bloco não está mais no dia. Atualize a página.", values };
    }
    throw error;
  }
  revalidateTimeScreens();
  refresh();
  return {};
}

/**
 * The block's small buttons (Pausa, Repetir o anterior, Dividir, Juntar,
 * Limpar). A stale page (block gone, halves changed in another tab) just gets
 * refreshed; the expected refusals come back as a message.
 */
async function blockOperation(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!(
      error instanceof SlotNotFoundError ||
      error instanceof DayNotStartedError ||
      error instanceof NothingToRepeatError ||
      error instanceof JoinConflictError ||
      error instanceof CannotSplitError
    )) {
      throw error;
    }
  }
  revalidateTimeScreens();
  refresh();
}

export async function pauseAction(date: string, slotStart: string, half: Half | null) {
  await requireSession();
  assertBlock(date, slotStart, half);
  await blockOperation(() =>
    saveEntry(date, slotStart, half, {
      kind: "BREAK",
      description: null,
      categoryId: null,
      projectName: null,
    }),
  );
}

export async function repeatPreviousAction(date: string, slotStart: string, half: Half | null) {
  await requireSession();
  assertBlock(date, slotStart, half);
  await blockOperation(() => repeatPrevious(date, slotStart, half));
}

export async function splitSlotAction(date: string, slotStart: string) {
  await requireSession();
  assertBlock(date, slotStart, null);
  await blockOperation(() => splitSlot(date, slotStart));
}

export async function joinSlotAction(date: string, slotStart: string) {
  await requireSession();
  assertBlock(date, slotStart, null);
  await blockOperation(() => joinSlot(date, slotStart));
}

export async function clearSlotAction(date: string, slotStart: string, half: Half | null) {
  await requireSession();
  assertBlock(date, slotStart, half);
  await blockOperation(() => clearSlot(date, slotStart, half));
}

// ---------------------------------------------------------------------------
// Categories and projects
// ---------------------------------------------------------------------------

export async function createTimeCategoryAction(
  _previous: FormState<TimeCategoryValues>,
  formData: FormData,
): Promise<FormState<TimeCategoryValues>> {
  await requireSession();
  const values = { name: read(formData, "name") };
  const parsed = timeCategorySchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    await createTimeCategory(parsed.data);
  } catch (error) {
    if (error instanceof TimeCategoryNameTakenError) {
      return { errors: { name: ["Já existe uma categoria com esse nome."] }, values };
    }
    throw error;
  }
  revalidateTimeScreens();
  refresh();
  return {};
}

export async function updateTimeCategoryAction(
  id: string,
  _previous: FormState<TimeCategoryValues>,
  formData: FormData,
): Promise<FormState<TimeCategoryValues>> {
  await requireSession();
  const values = { name: read(formData, "name") };
  const parsed = timeCategorySchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    await updateTimeCategory(id, parsed.data);
  } catch (error) {
    if (error instanceof TimeCategoryNameTakenError) {
      return { errors: { name: ["Já existe uma categoria com esse nome."] }, values };
    }
    if (error instanceof TimeCategoryNotFoundError) {
      return { formError: "Esta categoria não existe mais.", values };
    }
    throw error;
  }
  revalidateTimeScreens();
  refresh();
  return {};
}

export async function setTimeCategoryArchivedAction(id: string, archived: boolean) {
  await requireSession();
  try {
    await setTimeCategoryArchived(id, archived);
  } catch (error) {
    if (!(error instanceof TimeCategoryNotFoundError)) throw error;
  }
  revalidateTimeScreens();
  refresh();
}

export async function deleteTimeCategoryAction(id: string) {
  await requireSession();
  try {
    await deleteTimeCategory(id);
  } catch (error) {
    // In use (the button is hidden then) or already gone: show the current state.
    if (!(error instanceof TimeCategoryInUseError || error instanceof TimeCategoryNotFoundError)) {
      throw error;
    }
  }
  revalidateTimeScreens();
  refresh();
}

export async function renameTimeProjectAction(
  id: string,
  _previous: FormState<TimeProjectValues>,
  formData: FormData,
): Promise<FormState<TimeProjectValues>> {
  await requireSession();
  const values = { name: read(formData, "name") };
  const parsed = timeProjectSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    await renameTimeProject(id, parsed.data);
  } catch (error) {
    if (error instanceof TimeProjectNameTakenError) {
      return { errors: { name: ["Já existe um projeto com esse nome."] }, values };
    }
    if (error instanceof TimeProjectNotFoundError) {
      return { formError: "Este projeto não existe mais.", values };
    }
    throw error;
  }
  revalidateTimeScreens();
  refresh();
  return {};
}

export async function setTimeProjectArchivedAction(id: string, archived: boolean) {
  await requireSession();
  try {
    await setTimeProjectArchived(id, archived);
  } catch (error) {
    if (!(error instanceof TimeProjectNotFoundError)) throw error;
  }
  revalidateTimeScreens();
  refresh();
}
