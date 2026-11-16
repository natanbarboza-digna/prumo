"use server";
// Every exported function in a "use server" file becomes a Server Action: the
// browser calls it like an endpoint, so inputs are untrusted and validated here.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  type GoalFieldErrors,
  type GoalFormValues,
  goalInputSchema,
} from "@/modules/goals/schemas";
import { GoalNotFoundError, createGoal, deleteGoal, updateGoal } from "@/modules/goals/service";

export type GoalFormState = {
  errors?: GoalFieldErrors;
  formError?: string;
  /** What was typed, so the form can show it again after a server-side error. */
  values?: GoalFormValues;
};

function readGoalForm(formData: FormData): GoalFormValues {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    title: text("title"),
    description: text("description"),
    status: text("status") as GoalFormValues["status"],
    targetDate: text("targetDate"),
  };
}

/** Goals show up on their own pages and on the dashboard. */
function revalidateGoalScreens() {
  revalidatePath("/goals");
  revalidatePath("/");
}

export async function createGoalAction(
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const values = readGoalForm(formData);
  const parsed = goalInputSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const goal = await createGoal(parsed.data);
  revalidateGoalScreens();
  redirect(`/goals/${goal.id}`);
}

export async function updateGoalAction(
  id: string,
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const values = readGoalForm(formData);
  const parsed = goalInputSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  try {
    await updateGoal(id, parsed.data);
  } catch (error) {
    if (error instanceof GoalNotFoundError) {
      return { formError: "Este objetivo não existe mais.", values };
    }
    throw error;
  }
  revalidateGoalScreens();
  redirect(`/goals/${id}`);
}

export async function deleteGoalAction(id: string): Promise<void> {
  try {
    await deleteGoal(id);
  } catch (error) {
    // Already gone: the outcome the user asked for, so carry on to the list.
    if (!(error instanceof GoalNotFoundError)) throw error;
  }
  revalidateGoalScreens();
  redirect("/goals");
}
