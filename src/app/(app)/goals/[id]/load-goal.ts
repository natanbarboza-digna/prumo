import { notFound } from "next/navigation";

import { GoalNotFoundError, getGoal } from "@/modules/goals/service";

/** Loads a goal for a page, turning "not found" into the segment's 404 page. */
export async function loadGoal(id: string) {
  try {
    return await getGoal(id);
  } catch (error) {
    if (error instanceof GoalNotFoundError) notFound();
    throw error;
  }
}
