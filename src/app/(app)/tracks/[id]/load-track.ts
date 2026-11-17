import { notFound } from "next/navigation";

import { TrackNotFoundError, getTrack } from "@/modules/tracks/service";

/** Loads a track for a page, turning "not found" into the segment's 404 page. */
export async function loadTrack(id: string) {
  try {
    return await getTrack(id);
  } catch (error) {
    if (error instanceof TrackNotFoundError) notFound();
    throw error;
  }
}
