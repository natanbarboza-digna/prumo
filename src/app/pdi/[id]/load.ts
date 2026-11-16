import { notFound } from "next/navigation";

import {
  PdiActionNotFoundError,
  PdiAreaNotFoundError,
  PdiCheckInNotFoundError,
  PdiCycleNotFoundError,
  getAction,
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
