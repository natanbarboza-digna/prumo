// The home dashboard only reads: it composes the other modules' services.

import { db } from "@/lib/db";
import { type OpenBook, listOpenBooksWithDueDate } from "@/modules/books/service";
import { mondayOf } from "@/lib/dates";
import { minutesNowInAppTimeZone } from "@/lib/time-of-day";
import {
  type CategoryShare,
  DASHBOARD_LIST_LIMIT,
  type DashboardKpis,
  type Deadline,
  type DeadlineGroups,
  type WeekTimeBar,
  categoryShares,
  groupDeadlines,
  weekTimeBars,
} from "@/modules/dashboard/rules";
import { type Goal, type GoalProgress, getGoalsProgress, listGoals } from "@/modules/goals/service";
import {
  type PdiCycleSummary,
  getLastCheckInDate,
  getRoutineEvidenceByAction,
  listCycles,
  listOpenActionsWithDueDate,
} from "@/modules/pdi/service";
import {
  type Adherence,
  type WeekAdherence,
  combineAdherence,
  combineWeeklyAdherence,
} from "@/modules/routines/rules";
import { type RoutineDay, listRoutines, listRoutinesForDay } from "@/modules/routines/service";
import { computeAnalytics } from "@/modules/time/analytics";
import { listTimeDays } from "@/modules/time/service";
import {
  type TrackSummary,
  deriveTrackStatus,
  listOpenStepsWithDueDate,
  listTracks,
  progressPercent,
} from "@/modules/tracks/service";

export type DashboardPdi =
  | {
      kind: "ACTIVE";
      cycle: PdiCycleSummary;
      /** Open actions of the cycle whose due date has passed. */
      overdueActions: number;
      /** The cycle's linked routines combined; null when it has none. */
      routineAdherence: Adherence | null;
      lastCheckIn: string | null;
    }
  | { kind: "PLANNED"; cycle: PdiCycleSummary }
  | { kind: "NONE" };

/** "Tempo da semana" (plan 034): Monday to today. */
export type DashboardTimeWeek = {
  bars: WeekTimeBar[];
  categories: CategoryShare[];
  /** Minutes worked in the week. */
  worked: number;
  /** Days with a record in the week. */
  days: number;
};

export type Dashboard = {
  /** Nothing created yet: the page shows a welcome instead of the cards. */
  firstUse: boolean;
  kpis: DashboardKpis;
  timeWeek: DashboardTimeWeek;
  today: {
    items: RoutineDay[];
    done: number;
    adherence: Adherence;
    /** The active routines summed week by week (plan 029). */
    weekly: WeekAdherence[];
  };
  deadlines: DeadlineGroups;
  pdi: DashboardPdi;
  goals: { items: { goal: Goal; progress: GoalProgress }[]; total: number };
  tracks: { items: TrackSummary[]; total: number };
};

type OpenStep = Awaited<ReturnType<typeof listOpenStepsWithDueDate>>[number];
type OpenAction = Awaited<ReturnType<typeof listOpenActionsWithDueDate>>[number];

/**
 * Every open item with a date (plan 028): steps of active tracks, actions of
 * cycles that are not closed, goals not started or in progress and required
 * books not finished yet (plan 035). The
 * dashboard groups them in its card; the deadlines page by week.
 */
export async function listDeadlines(): Promise<Deadline[]> {
  const [steps, actions, goals, books] = await Promise.all([
    listOpenStepsWithDueDate(),
    listOpenActionsWithDueDate(),
    listGoals(),
    listOpenBooksWithDueDate(),
  ]);
  return toDeadlines(steps, actions, goals, books);
}

function toDeadlines(
  steps: readonly OpenStep[],
  actions: readonly OpenAction[],
  goals: readonly Goal[],
  books: readonly OpenBook[],
): Deadline[] {
  return [
    ...steps.map((step) => ({
      kind: "STEP" as const,
      id: step.id,
      title: step.title,
      date: step.dueDate,
      href: `/tracks/${step.track.id}`,
      source: step.track.title,
    })),
    ...actions.map((action) => ({
      kind: "ACTION" as const,
      id: action.id,
      title: action.title,
      date: action.dueDate,
      href: `/pdi/${action.cycle.id}/actions/${action.id}`,
      source: action.cycle.title,
    })),
    ...goals.flatMap((goal) =>
      (goal.status === "NOT_STARTED" || goal.status === "IN_PROGRESS") && goal.targetDate !== null
        ? [
            {
              kind: "GOAL" as const,
              id: goal.id,
              title: goal.title,
              date: goal.targetDate,
              href: `/goals/${goal.id}`,
              source: null,
            },
          ]
        : [],
    ),
    ...books.map((book) => ({
      kind: "BOOK" as const,
      id: book.id,
      title: book.title,
      date: book.dueDate,
      href: `/books/${book.id}`,
      source: null,
    })),
  ];
}

/** `nowMinute`: the clock for today's open time day, which counts up to now. */
export async function getDashboard(
  today: string,
  nowMinute: number = minutesNowInAppTimeZone(),
): Promise<Dashboard> {
  const [
    todayItems,
    activeRoutines,
    routineCount,
    goals,
    tracks,
    cycles,
    steps,
    actions,
    timeDays,
    timeDayCount,
    books,
  ] = await Promise.all([
    listRoutinesForDay(today),
    listRoutines({ today, state: "active" }),
    db.routine.count(),
    listGoals(),
    // All of them: archived tracks still mean this is not the first use (plan 024).
    listTracks({ filter: "ALL" }),
    listCycles(),
    listOpenStepsWithDueDate(),
    listOpenActionsWithDueDate(),
    listTimeDays(mondayOf(today), today),
    db.timeDay.count(),
    listOpenBooksWithDueDate(),
  ]);

  const goalsInProgress = goals
    .filter((goal) => goal.status === "IN_PROGRESS")
    .sort(byTargetDate)
    .slice(0, DASHBOARD_LIST_LIMIT);
  const tracksInProgress = tracks.filter(
    (track) => track.archivedAt === null && deriveTrackStatus(track.counts) === "IN_PROGRESS",
  );

  const [progress, pdi] = await Promise.all([
    getGoalsProgress(goalsInProgress.map((goal) => goal.id)),
    summarizePdi(cycles, actions, today),
  ]);

  const deadlines = groupDeadlines(toDeadlines(steps, actions, goals, books), today);
  const done = todayItems.filter((item) => item.log?.status === "DONE").length;
  const adherence = combineAdherence(activeRoutines.map((routine) => routine.adherence));
  const time = computeAnalytics(
    timeDays,
    { categoryId: null, projectId: null },
    { today, nowMinute },
  );

  return {
    firstUse:
      routineCount === 0 &&
      goals.length === 0 &&
      tracks.length === 0 &&
      cycles.length === 0 &&
      timeDayCount === 0,
    kpis: {
      routinesToday: { done, total: todayItems.length },
      adherence: { scheduled: adherence.scheduled, rate: adherence.rate },
      workedThisWeek: time.totals.worked,
      overdue: deadlines.overdue.items.length + deadlines.overdue.hidden,
      pdi:
        pdi.kind === "ACTIVE"
          ? {
              cycleId: pdi.cycle.id,
              percent: progressPercent(pdi.cycle.progress.done, pdi.cycle.progress.total),
            }
          : null,
    },
    timeWeek: {
      bars: weekTimeBars(time.perDay, today),
      categories: categoryShares(time.byCategory),
      worked: time.totals.worked,
      days: time.totals.days,
    },
    today: {
      items: todayItems,
      done,
      adherence,
      weekly: combineWeeklyAdherence(
        activeRoutines.map((routine) => routine.weekly),
        today,
      ),
    },
    deadlines,
    pdi,
    goals: {
      items: goalsInProgress.map((goal) => ({
        goal,
        // getGoalsProgress returns every id it was given.
        progress: progress.get(goal.id) ?? emptyProgress,
      })),
      total: goals.filter((goal) => goal.status === "IN_PROGRESS").length,
    },
    tracks: {
      items: tracksInProgress.slice(0, DASHBOARD_LIST_LIMIT),
      total: tracksInProgress.length,
    },
  };
}

const emptyProgress: GoalProgress = {
  done: 0,
  total: 0,
  steps: { done: 0, total: 0 },
  actions: { done: 0, total: 0 },
  books: { done: 0, total: 0 },
};

/** Target date first (goals without one last), then title. */
function byTargetDate(a: Goal, b: Goal): number {
  if (a.targetDate !== b.targetDate) {
    if (a.targetDate === null) return 1;
    if (b.targetDate === null) return -1;
    return a.targetDate.localeCompare(b.targetDate);
  }
  return a.title.localeCompare(b.title, "pt-BR");
}

async function summarizePdi(
  cycles: PdiCycleSummary[],
  openActions: { dueDate: string; cycle: { id: string } }[],
  today: string,
): Promise<DashboardPdi> {
  const active = cycles.find((cycle) => cycle.status === "ACTIVE");
  if (active) {
    const [evidence, lastCheckIn] = await Promise.all([
      getRoutineEvidenceByAction(active.id, today),
      getLastCheckInDate(active.id),
    ]);
    const perAction = Object.values(evidence);
    return {
      kind: "ACTIVE",
      cycle: active,
      overdueActions: openActions.filter(
        (action) => action.cycle.id === active.id && action.dueDate < today,
      ).length,
      routineAdherence:
        perAction.length === 0 ? null : combineAdherence(perAction.map((item) => item.adherence)),
      lastCheckIn,
    };
  }

  const planned = cycles
    .filter((cycle) => cycle.status === "PLANNED")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  return planned ? { kind: "PLANNED", cycle: planned } : { kind: "NONE" };
}
