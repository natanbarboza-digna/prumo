// The home dashboard only reads: it composes the other modules' services.

import { db } from "@/lib/db";
import {
  DASHBOARD_LIST_LIMIT,
  type Deadline,
  type DeadlineGroups,
  groupDeadlines,
} from "@/modules/dashboard/rules";
import { type Goal, type GoalProgress, getGoalsProgress, listGoals } from "@/modules/goals/service";
import {
  type PdiCycleSummary,
  getLastCheckInDate,
  getRoutineEvidenceByAction,
  listCycles,
  listOpenActionsWithDueDate,
} from "@/modules/pdi/service";
import { type Adherence, combineAdherence } from "@/modules/routines/rules";
import { type RoutineDay, listRoutines, listRoutinesForDay } from "@/modules/routines/service";
import {
  type TrackSummary,
  deriveTrackStatus,
  listOpenStepsWithDueDate,
  listTracks,
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

export type Dashboard = {
  /** Nothing created yet: the page shows a welcome instead of the cards. */
  firstUse: boolean;
  today: { items: RoutineDay[]; done: number; adherence: Adherence };
  deadlines: DeadlineGroups;
  pdi: DashboardPdi;
  goals: { items: { goal: Goal; progress: GoalProgress }[]; total: number };
  tracks: { items: TrackSummary[]; total: number };
};

export async function getDashboard(today: string): Promise<Dashboard> {
  const [todayItems, activeRoutines, routineCount, goals, tracks, cycles, steps, actions] =
    await Promise.all([
      listRoutinesForDay(today),
      listRoutines({ today, state: "active" }),
      db.routine.count(),
      listGoals(),
      listTracks(),
      listCycles(),
      listOpenStepsWithDueDate(),
      listOpenActionsWithDueDate(),
    ]);

  const goalsInProgress = goals
    .filter((goal) => goal.status === "IN_PROGRESS")
    .sort(byTargetDate)
    .slice(0, DASHBOARD_LIST_LIMIT);
  const tracksInProgress = tracks.filter(
    (track) => deriveTrackStatus(track.counts) === "IN_PROGRESS",
  );

  const [progress, pdi] = await Promise.all([
    getGoalsProgress(goalsInProgress.map((goal) => goal.id)),
    summarizePdi(cycles, actions, today),
  ]);

  const deadlines: Deadline[] = [
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
  ];

  return {
    firstUse:
      routineCount === 0 && goals.length === 0 && tracks.length === 0 && cycles.length === 0,
    today: {
      items: todayItems,
      done: todayItems.filter((item) => item.log?.status === "DONE").length,
      adherence: combineAdherence(activeRoutines.map((routine) => routine.adherence)),
    },
    deadlines: groupDeadlines(deadlines, today),
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
