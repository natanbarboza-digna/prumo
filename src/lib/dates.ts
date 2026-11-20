// Date-only values (no time of day) travel through the app as "YYYY-MM-DD"
// strings. In the database they are `@db.Date` columns, which Prisma reads and
// writes as a Date at midnight UTC.

import type { Weekday } from "@/generated/prisma/enums";

export const APP_TIME_ZONE = "America/Fortaleza";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date in the app time zone. Never derive "today" from UTC. */
export function todayInAppTimeZone(now: Date = new Date()): string {
  // The "en-CA" locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30). */
export function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Converts "YYYY-MM-DD" to the Date Prisma expects for a `@db.Date` column. */
export function parseDateOnly(value: string): Date {
  if (!isValidDateOnly(value)) {
    throw new Error(`Invalid date: "${value}". Expected YYYY-MM-DD.`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

/** Converts a `@db.Date` value read by Prisma back to "YYYY-MM-DD". */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "2026-03-05" → "05/03/2026". */
export function formatDateForDisplay(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

// getUTCDay() order: Sunday is 0.
const WEEKDAYS_FROM_SUNDAY: readonly Weekday[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Day of the week of a "YYYY-MM-DD" date, independent of the machine's time zone. */
export function weekdayOf(value: string): Weekday {
  return WEEKDAYS_FROM_SUNDAY[parseDateOnly(value).getUTCDay()]!;
}

/** The Monday of the week of a date (weeks go from Monday to Sunday). */
export function mondayOf(value: string): string {
  // getUTCDay: Sunday is 0, so Monday-based it is (day + 6) % 7.
  return addDays(value, -((parseDateOnly(value).getUTCDay() + 6) % 7));
}

/** "2026-12-31" + 1 → "2027-01-01". Negative values go back in time. */
export function addDays(value: string, days: number): string {
  return formatDateOnly(new Date(parseDateOnly(value).getTime() + days * DAY_IN_MS));
}

/** Days from `from` to `to` ("2026-11-16" → "2026-11-30" is 14); negative when `to` comes first. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateOnly(to).getTime() - parseDateOnly(from).getTime()) / DAY_IN_MS);
}

/** Every date from `from` to `to`, both included; empty when from > to. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  // "YYYY-MM-DD" strings compare in calendar order.
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

const longDateFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "2026-11-16" → "segunda-feira, 16 de novembro". */
export function formatLongDate(value: string): string {
  return longDateFormat.format(parseDateOnly(value));
}
