import Link from "next/link";

import { DashboardCard, EmptyCardText } from "@/components/dashboard/dashboard-card";
import { OverdueBadge } from "@/components/goals/goal-status-badge";
import { TrackProgress } from "@/components/tracks/track-progress";
import { Progress } from "@/components/ui/progress";
import { formatDateForDisplay } from "@/lib/dates";
import type { Dashboard } from "@/modules/dashboard/service";
import { isGoalOverdue } from "@/modules/goals/service";
import { itemProgressText } from "@/modules/pdi/labels";
import { progressPercent } from "@/modules/tracks/service";

type GoalsTracksCardProps = {
  goals: Dashboard["goals"];
  tracks: Dashboard["tracks"];
  today: string;
};

/** Goals and tracks in progress side by side (plan 034), each with its progress bar. */
export function GoalsTracksCard({ goals, tracks, today }: GoalsTracksCardProps) {
  return (
    <DashboardCard id="em-andamento" title="Objetivos e trilhas em andamento">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <ColumnTitle title="Objetivos" href="/goals" label="Ver objetivos" />
          {goals.items.length === 0 ? (
            <EmptyCardText
              text="Nenhum objetivo em andamento."
              href="/goals/new"
              label="Criar objetivo"
            />
          ) : (
            <ul className="grid gap-4" aria-label="Objetivos em andamento">
              {goals.items.map(({ goal, progress }) => {
                const text = itemProgressText(progress.done, progress.total);
                const percent = progressPercent(progress.done, progress.total);
                return (
                  <li key={goal.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium break-words">
                        <Link href={`/goals/${goal.id}`} className="hover:underline">
                          {goal.title}
                        </Link>
                      </h4>
                      {isGoalOverdue(goal, today) && <OverdueBadge />}
                    </div>
                    <Progress
                      value={percent}
                      aria-label={`Progresso do objetivo ${goal.title}`}
                      aria-valuetext={`${percent}%: ${text}`}
                    />
                    <p className="text-muted-foreground text-sm">
                      {text}
                      {goal.targetDate && ` · Data-alvo: ${formatDateForDisplay(goal.targetDate)}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <MoreText total={goals.total} shown={goals.items.length} />
        </div>

        <div className="space-y-3">
          <ColumnTitle title="Trilhas" href="/tracks" label="Ver trilhas" />
          {tracks.items.length === 0 ? (
            <EmptyCardText text="Nenhuma trilha em andamento." href="/tracks" label="Ver trilhas" />
          ) : (
            <ul className="grid gap-4" aria-label="Trilhas em andamento">
              {tracks.items.map((track) => (
                <li key={track.id} className="space-y-1.5">
                  <h4 className="font-medium break-words">
                    <Link href={`/tracks/${track.id}`} className="hover:underline">
                      {track.title}
                    </Link>
                  </h4>
                  {track.goal && (
                    <p className="text-muted-foreground text-sm">Objetivo: {track.goal.title}</p>
                  )}
                  <TrackProgress
                    done={track.counts.done}
                    total={track.counts.total}
                    label={`Progresso da trilha ${track.title}`}
                  />
                </li>
              ))}
            </ul>
          )}
          <MoreText total={tracks.total} shown={tracks.items.length} />
        </div>
      </div>
    </DashboardCard>
  );
}

function ColumnTitle({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Link href={href} className="text-sm underline-offset-4 hover:underline">
        {label}
      </Link>
    </div>
  );
}

function MoreText({ total, shown }: { total: number; shown: number }) {
  if (total <= shown) return null;
  return <p className="text-muted-foreground text-sm">e mais {total - shown}</p>;
}
