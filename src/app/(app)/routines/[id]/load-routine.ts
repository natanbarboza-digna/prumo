import { notFound } from "next/navigation";

import { RoutineNotFoundError, getRoutine } from "@/modules/routines/service";

/** Loads a routine for a page, turning "not found" into the segment's 404 page. */
export async function loadRoutine(id: string) {
  try {
    return await getRoutine(id);
  } catch (error) {
    if (error instanceof RoutineNotFoundError) notFound();
    throw error;
  }
}
