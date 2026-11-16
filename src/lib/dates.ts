// Date-only values (no time of day) travel through the app as "YYYY-MM-DD"
// strings. In the database they are `@db.Date` columns, which Prisma reads and
// writes as a Date at midnight UTC.

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
