import { notFound } from "next/navigation";

import {
  PdiActionNotFoundError,
  PdiAreaNotFoundError,
  PdiCheckInNotFoundError,
  PdiCycleNotFoundError,
  getAction,
  getActionDetail,
  getArea,
  getCheckIn,
  getCycle,
} from "@/modules/pdi/service";

// Loaders for the PDI pages: "not found" becomes the segment's 404 page, and
// so does an area, action or check-in that belongs to a different cycle.

export async function loadCycle(id: string) {
  try {
    return await getCycle(id);
  } catch (error) {
    if (error instanceof PdiCycleNotFoundError) notFound();
    throw error;
  }
}

export async function loadArea(cycleId: string, areaId: string) {
  return inCycle(cycleId, () => getArea(areaId), PdiAreaNotFoundError);
}

export async function loadAction(cycleId: string, actionId: string) {
  return inCycle(cycleId, () => getAction(actionId), PdiActionNotFoundError);
}

/** The action with its routines and logs (the action page). */
export async function loadActionDetail(cycleId: string, actionId: string, today: string) {
  const detail = await inCycle(
    cycleId,
    async () => {
      const value = await getActionDetail(actionId, today);
      return { ...value, cycleId: value.action.cycleId };
    },
    PdiActionNotFoundError,
  );
  return detail;
}

export async function loadCheckIn(cycleId: string, checkInId: string) {
  return inCycle(cycleId, () => getCheckIn(checkInId), PdiCheckInNotFoundError);
}

async function inCycle<T extends { cycleId: string }>(
  cycleId: string,
  load: () => Promise<T>,
  NotFound: new (id: string) => Error,
): Promise<T> {
  try {
    const item = await load();
    if (item.cycleId !== cycleId) notFound();
    return item;
  } catch (error) {
    if (error instanceof NotFound) notFound();
    throw error;
  }
}
