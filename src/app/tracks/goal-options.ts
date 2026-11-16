import type { GoalOption } from "@/components/tracks/track-form";
import { listGoals } from "@/modules/goals/service";

/**
 * Goals offered in the track form: every goal that is not archived, plus the
 * current goal of the track when it was archived later (so it is not lost).
 */
export async function goalOptions(current?: GoalOption | null): Promise<GoalOption[]> {
  const goals = (await listGoals()).map(({ id, title }) => ({ id, title }));
  if (current && !goals.some((goal) => goal.id === current.id)) {
    goals.push({ id: current.id, title: `${current.title} (arquivado)` });
  }
  return goals;
}
