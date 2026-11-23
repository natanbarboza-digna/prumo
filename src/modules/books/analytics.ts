// Reading analytics and the annual goal (plan 037). Pure: the service reads
// the books and logs, this file does the sums, so they are tested alone.

import type { BookFormat, BookStatus } from "@/generated/prisma/enums";
import { addDays, daysBetween, mondayOf } from "@/lib/dates";
import { normalizeActivity } from "@/modules/time/analytics";

/** What the analytics need from a book. Dates are "YYYY-MM-DD". */
export type AnalyticsBook = {
  id: string;
  title: string;
  authors: string;
  genre: string | null;
  format: BookFormat;
  pages: number | null;
  status: BookStatus;
  startedOn: string | null;
  finishedOn: string | null;
  rating: number | null;
};

export type AnalyticsLog = { bookId: string; date: string; position: number };

const yearOf = (date: string | null) => (date === null ? null : Number(date.slice(0, 4)));

// ---------------------------------------------------------------------------
// Annual goal
// ---------------------------------------------------------------------------

export type ReadingGoalProgress = {
  target: number;
  read: number;
  /** Books the days so far call for (one decimal); null for a past year. */
  expected: number | null;
  /** Whole books ahead (+) or behind (−) of that; null for a past year. */
  ahead: number | null;
  met: boolean;
};

function daysInYear(year: number): number {
  return daysBetween(`${year}-01-01`, `${year + 1}-01-01`);
}

/** Read books against the goal; the current year also against the share its days call for. */
export function goalProgress(
  goal: { target: number; read: number; year: number },
  today: string,
): ReadingGoalProgress {
  const { target, read, year } = goal;
  const met = read >= target;
  const thisYear = Number(today.slice(0, 4));
  if (year < thisYear) return { target, read, expected: null, ahead: null, met };
  const day = year > thisYear ? 0 : daysBetween(`${year}-01-01`, today) + 1;
  const exact = (target * day) / daysInYear(year);
  // `|| 0` turns a −0 (just behind, under one book) into 0.
  return {
    target,
    read,
    expected: Math.round(exact * 10) / 10,
    ahead: Math.trunc(read - exact) || 0,
    met,
  };
}

// ---------------------------------------------------------------------------
// Pages and minutes from the reading logs
// ---------------------------------------------------------------------------

export type DayAmount = { date: string; pages: number; minutes: number };

/**
 * What each day added, summed over the books: pages for physical books and
 * e-books with pages (percentage × pages ÷ 100), minutes for audiobooks. A
 * position lower than the one before means the book was read again, so that
 * log counts from zero. Days come out in date order.
 */
export function dailyAmounts(
  books: readonly AnalyticsBook[],
  logs: readonly AnalyticsLog[],
): DayAmount[] {
  const byDate = new Map<string, DayAmount>();
  for (const book of books) {
    const own = logs
      .filter((log) => log.bookId === book.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    let previous = 0;
    for (const log of own) {
      const added = log.position >= previous ? log.position - previous : log.position;
      previous = log.position;
      const day = byDate.get(log.date) ?? { date: log.date, pages: 0, minutes: 0 };
      if (book.format === "PHYSICAL") day.pages += added;
      else if (book.format === "EBOOK" && book.pages !== null)
        day.pages += (added * book.pages) / 100;
      else if (book.format === "AUDIOBOOK") day.minutes += added;
      byDate.set(log.date, day);
    }
  }
  return [...byDate.values()]
    .map((day) => ({ ...day, pages: Math.round(day.pages) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// The year's analytics
// ---------------------------------------------------------------------------

export type Ranked = { name: string; books: number };
export type BookDays = { title: string; days: number };

export type ReadingAnalytics = {
  read: number;
  abandoned: number;
  pages: number;
  minutes: number;
  /** One decimal; null when no read book of the year has a rating. */
  averageRating: number | null;
  /** Read books per month, January to December, by the end date. */
  byMonth: number[];
  /** The 12 weeks up to today (or to the year's last day, for a past year). */
  weeklyPages: { monday: string; pages: number }[];
  duration: { average: number | null; fastest: BookDays | null; slowest: BookDays | null };
  topAuthors: Ranked[];
  topGenres: Ranked[];
};

export const TOP_RANKED = 5;
export const WEEKS_SHOWN = 12;

/** The most read names, regardless of case, accents and spaces; the latest spelling wins. */
function rank(names: readonly string[]): Ranked[] {
  const groups = new Map<string, Ranked>();
  // `names` go oldest first, so the last spelling seen is the most recent.
  for (const raw of names) {
    const name = raw.trim();
    if (name === "") continue;
    const key = normalizeActivity(name);
    const group = groups.get(key) ?? { name, books: 0 };
    group.name = name;
    group.books += 1;
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.books - a.books || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, TOP_RANKED);
}

export function readingAnalytics(
  books: readonly AnalyticsBook[],
  logs: readonly AnalyticsLog[],
  year: number,
  today: string,
): ReadingAnalytics {
  const inYear = (book: AnalyticsBook) => yearOf(book.finishedOn) === year;
  const read = books
    .filter((book) => book.status === "READ" && inYear(book))
    .sort((a, b) => (a.finishedOn ?? "").localeCompare(b.finishedOn ?? ""));
  const abandoned = books.filter((book) => book.status === "ABANDONED" && inYear(book));

  const days = dailyAmounts(books, logs);
  const yearDays = days.filter((day) => yearOf(day.date) === year);

  const byMonth = Array.from({ length: 12 }, () => 0);
  for (const book of read) byMonth[Number(book.finishedOn!.slice(5, 7)) - 1]! += 1;

  const lastDay = year === Number(today.slice(0, 4)) ? today : `${year}-12-31`;
  const lastMonday = mondayOf(lastDay);
  const weeklyPages = Array.from({ length: WEEKS_SHOWN }, (_, index) => {
    const monday = addDays(lastMonday, (index - (WEEKS_SHOWN - 1)) * 7);
    const sunday = addDays(monday, 6);
    const pages = days
      .filter((day) => day.date >= monday && day.date <= sunday && day.date <= lastDay)
      .reduce((total, day) => total + day.pages, 0);
    return { monday, pages };
  });

  const timed: BookDays[] = read.flatMap((book) =>
    book.startedOn === null || book.finishedOn === null
      ? []
      : [{ title: book.title, days: daysBetween(book.startedOn, book.finishedOn) + 1 }],
  );
  const rated = read.flatMap((book) => (book.rating === null ? [] : [book.rating]));
  const average = (values: number[]) =>
    values.length === 0
      ? null
      : Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;

  return {
    read: read.length,
    abandoned: abandoned.length,
    pages: yearDays.reduce((total, day) => total + day.pages, 0),
    minutes: yearDays.reduce((total, day) => total + day.minutes, 0),
    averageRating: average(rated),
    byMonth,
    weeklyPages,
    duration: {
      average: average(timed.map((book) => book.days)),
      // Ties go to the first finished.
      fastest: timed.reduce<BookDays | null>(
        (best, book) => (best === null || book.days < best.days ? book : best),
        null,
      ),
      slowest: timed.reduce<BookDays | null>(
        (best, book) => (best === null || book.days > best.days ? book : best),
        null,
      ),
    },
    topAuthors: rank(read.map((book) => book.authors)),
    topGenres: rank(read.flatMap((book) => (book.genre ? [book.genre] : []))),
  };
}
