import Link from "next/link";

import { DashboardCard, EmptyCardText } from "@/components/dashboard/dashboard-card";
import { OverdueBadge } from "@/components/goals/goal-status-badge";
import { Progress } from "@/components/ui/progress";
import { formatDateForDisplay } from "@/lib/dates";
import type { Dashboard } from "@/modules/dashboard/service";
import { isGoalOverdue } from "@/modules/goals/service";
import { itemProgressText } from "@/modules/pdi/labels";
import { progressPercent } from "@/modules/tracks/service";

/** Goals in progress with the aggregated progress of their steps and actions. */
export function GoalsCard({ goals, today }: { goals: Dashboard["goals"]; today: string }) {
  return (
    <DashboardCard
      id="objetivos"
      title="Objetivos em andamento"
      more={{ href: "/goals", label: "Ver todos" }}
    >
      {goals.items.length === 0 ? (
        <EmptyCardText text="Nenhum objetivo em andamento." href="/goals" label="Ver objetivos" />
      ) : (
        <ul className="grid gap-3" aria-label="Objetivos em andamento">
          {goals.items.map(({ goal, progress }) => {
            const text = itemProgressText(progress.done, progress.total);
            const percent = progressPercent(progress.done, progress.total);
            return (
              <li key={goal.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium break-words">
                    <Link href={`/goals/${goal.id}`} className="hover:underline">
                      {goal.title}
                    </Link>
                  </h3>
                  {isGoalOverdue(goal, today) && <OverdueBadge />}
                </div>
                {goal.targetDate && (
                  <p className="text-muted-foreground text-sm">
                    Data-alvo: {formatDateForDisplay(goal.targetDate)}
                  </p>
                )}
                <Progress
                  value={percent}
                  aria-label={`Progresso do objetivo ${goal.title}`}
                  aria-valuetext={`${percent}%: ${text}`}
                />
                <p className="text-muted-foreground text-sm">{text}</p>
              </li>
            );
          })}
        </ul>
      )}
      {goals.total > goals.items.length && (
        <p className="text-muted-foreground text-sm">e mais {goals.total - goals.items.length}</p>
      )}
    </DashboardCard>
  );
}
