import { listGoals } from "@/modules/goals/service";

/** A goal as offered in the goal select of the track and routine forms. */
export type GoalOption = { id: string; title: string };

/**
 * Goals offered in the track and routine forms: every goal that is not archived, plus the
 * current goal of the item when it was archived later (so it is not lost).
 */
export async function goalOptions(current?: GoalOption | null): Promise<GoalOption[]> {
  const goals = (await listGoals()).map(({ id, title }) => ({ id, title }));
  if (current && !goals.some((goal) => goal.id === current.id)) {
    goals.push({ id: current.id, title: `${current.title} (arquivado)` });
  }
  return goals;
}
