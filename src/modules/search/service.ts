// The single search page (plan 027): one term, looked up at once in goals,
// tracks and steps, routines and the PDI. Read only, like the dashboard.
//
// The comparison is `unaccent(lower(column)) LIKE unaccent(lower(pattern))`,
// so neither case nor accents matter. Prisma's `contains` cannot drop accents,
// hence raw SQL; the term always goes in as a bound parameter, never as text in
// the query, and its own % and _ are escaped (likePattern).

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDateForDisplay, formatDateOnly } from "@/lib/dates";
import { goalStatusLabels } from "@/modules/goals/labels";
import type { SearchGroupKey } from "@/modules/search/labels";
import { likePattern } from "@/modules/search/schemas";

/** Items shown per group; `total` still counts every match. */
export const SEARCH_GROUP_LIMIT = 20;

export type SearchItem = {
  id: string;
  title: string;
  href: string;
  /** One line under the title: the step's track, the action's cycle and area… */
  context: string | null;
  /** Put away: archived goal or track, ended routine, closed cycle. */
  stored: boolean;
};

export type SearchGroup = { items: SearchItem[]; total: number };

export type SearchResults = Record<SearchGroupKey, SearchGroup>;

/** Every query returns these, plus its own columns; `total` comes from COUNT(*) OVER (). */
type Counted = { total: bigint };

export async function search(term: string, today: string): Promise<SearchResults> {
  const pattern = likePattern(term);
  // Column names come from the fixed lists below, never from input.
  const matches = (...columns: string[]) =>
    Prisma.join(
      columns.map(
        (column) =>
          Prisma.sql`unaccent(lower(${Prisma.raw(column)})) LIKE unaccent(lower(${pattern})) ESCAPE '!'`,
      ),
      " OR ",
    );
  const limit = SEARCH_GROUP_LIMIT;

  const [goals, tracks, steps, routines, cycles, actions] = await Promise.all([
    db.$queryRaw<
      (Counted & { id: string; title: string; status: keyof typeof goalStatusLabels })[]
    >`
      SELECT id, title, status, COUNT(*) OVER () AS total
      FROM goals
      WHERE ${matches("title", "description")}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}`,
    db.$queryRaw<
      (Counted & { id: string; title: string; archived: boolean; goal: string | null })[]
    >`
      SELECT t.id, t.title, t.archived_at IS NOT NULL AS archived, g.title AS goal,
             COUNT(*) OVER () AS total
      FROM tracks t
      LEFT JOIN goals g ON g.id = t.goal_id
      WHERE ${matches("t.title", "t.description")}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${limit}`,
    db.$queryRaw<
      (Counted & {
        id: string;
        title: string;
        track_id: string;
        track: string;
        archived: boolean;
      })[]
    >`
      SELECT s.id, s.title, s.track_id, t.title AS track, t.archived_at IS NOT NULL AS archived,
             COUNT(*) OVER () AS total
      FROM track_steps s
      JOIN tracks t ON t.id = s.track_id
      WHERE ${matches("s.title", "s.notes")}
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT ${limit}`,
    db.$queryRaw<(Counted & { id: string; title: string; ended: boolean })[]>`
      SELECT id, title, (end_date IS NOT NULL AND end_date < ${today}::date) AS ended,
             COUNT(*) OVER () AS total
      FROM routines
      WHERE ${matches("title", "description")}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}`,
    db.$queryRaw<
      (Counted & { id: string; title: string; start_date: Date; end_date: Date; closed: boolean })[]
    >`
      SELECT id, title, start_date, end_date, status = 'CLOSED' AS closed,
             COUNT(*) OVER () AS total
      FROM pdi_cycles
      WHERE ${matches("title")}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}`,
    db.$queryRaw<
      (Counted & {
        id: string;
        title: string;
        cycle_id: string;
        cycle: string;
        area: string;
        closed: boolean;
      })[]
    >`
      SELECT a.id, a.title, ar.cycle_id, c.title AS cycle, ar.name AS area,
             c.status = 'CLOSED' AS closed, COUNT(*) OVER () AS total
      FROM pdi_actions a
      JOIN pdi_areas ar ON ar.id = a.area_id
      JOIN pdi_cycles c ON c.id = ar.cycle_id
      WHERE ${matches("a.title", "a.description", "a.expected_result")}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${limit}`,
  ]);

  return {
    GOALS: group(goals, (row) => ({
      id: row.id,
      title: row.title,
      href: `/goals/${row.id}`,
      context: goalStatusLabels[row.status],
      stored: row.status === "ARCHIVED",
    })),
    TRACKS: group(tracks, (row) => ({
      id: row.id,
      title: row.title,
      href: `/tracks/${row.id}`,
      context: row.goal ? `Objetivo: ${row.goal}` : null,
      stored: row.archived,
    })),
    STEPS: group(steps, (row) => ({
      id: row.id,
      title: row.title,
      href: `/tracks/${row.track_id}`,
      context: `Trilha: ${row.track}`,
      stored: row.archived,
    })),
    ROUTINES: group(routines, (row) => ({
      id: row.id,
      title: row.title,
      href: `/routines/${row.id}`,
      context: null,
      stored: row.ended,
    })),
    CYCLES: group(cycles, (row) => ({
      id: row.id,
      title: row.title,
      href: `/pdi/${row.id}`,
      context: `${formatDateForDisplay(formatDateOnly(row.start_date))} a ${formatDateForDisplay(formatDateOnly(row.end_date))}`,
      stored: row.closed,
    })),
    ACTIONS: group(actions, (row) => ({
      id: row.id,
      title: row.title,
      href: `/pdi/${row.cycle_id}/actions/${row.id}`,
      context: `Ciclo: ${row.cycle} · Área: ${row.area}`,
      stored: row.closed,
    })),
  };
}

function group<Row extends Counted>(rows: Row[], toItem: (row: Row) => SearchItem): SearchGroup {
  // Every row carries the same total; Postgres returns COUNT as a bigint.
  return { items: rows.map(toItem), total: rows.length === 0 ? 0 : Number(rows[0]!.total) };
}
