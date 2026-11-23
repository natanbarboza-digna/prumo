import { formatTimeOfDay } from "@/lib/time-of-day";
import type { Slot } from "@/modules/time/rules";

/** 450 → "7h30", 45 → "45min", 60 → "1h". */
export function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

/** "08:15–08:30". */
export function slotLabel(slot: Slot): string {
  return `${formatTimeOfDay(slot.start)}–${formatTimeOfDay(slot.end)}`;
}
