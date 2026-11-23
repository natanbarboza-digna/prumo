// Times of day (plan 031): minutes since midnight in the database and in the
// rules, "HH:MM" on screen and in forms. Always in the app's time zone.

import { APP_TIME_ZONE } from "@/lib/dates";

export const MINUTES_IN_DAY = 24 * 60;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a real time written as HH:MM, from 00:00 to 23:59. */
export function isValidTimeOfDay(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** "08:15" → 495. Throws on anything that is not HH:MM. */
export function parseTimeOfDay(value: string): number {
  const match = TIME_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid time: "${value}". Expected HH:MM.`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 495 → "08:15"; 1440 → "24:00" (the end of the day). */
export function formatTimeOfDay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The current time of day in the app time zone, in minutes. Never from UTC. */
export function minutesNowInAppTimeZone(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: "hour" | "minute") =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value("hour") * 60 + value("minute");
}
