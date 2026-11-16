import type { Metadata } from "next";
import Link from "next/link";

import { DeleteGoalButton } from "@/components/goals/delete-goal-button";
import { GoalProgressSummary } from "@/components/goals/goal-progress";
import { GoalStatusBadge, OverdueBadge } from "@/components/goals/goal-status-badge";
import { ActionList } from "@/components/pdi/action-list";
import { RoutineList } from "@/components/routines/routine-list";
import { TrackList } from "@/components/tracks/track-list";
import { Button } from "@/components/ui/button";
import { formatDateForDisplay, todayInAppTimeZone } from "@/lib/dates";
import { getGoalProgress, isGoalOverdue } from "@/modules/goals/service";
import { listActionsForGoal } from "@/modules/pdi/service";
import { listRoutines } from "@/modules/routines/service";
import { listTracks } from "@/modules/tracks/service";

import { loadGoal } from "./load-goal";

export const metadata: Metadata = { title: "Objetivo" };

export default async function GoalPage({ params }: PageProps<"/goals/[id]">) {
  const goal = await loadGoal((await params).id);
  const today = todayInAppTimeZone();
  const [tracks, progress, routines, actions] = await Promise.all([
    listTracks({ goalId: goal.id }),
    getGoalProgress(goal.id),
    listRoutines({ goalId: goal.id, today }),
    listActionsForGoal(goal.id),
  ]);

  return (
    <article className="max-w-2xl space-y-6">
      <div className="space-y-3">
        <Link href="/goals" className="text-muted-foreground text-sm hover:underline">
          ← Objetivos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight break-words">{goal.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <GoalStatusBadge status={goal.status} />
          {isGoalOverdue(goal, today) && <OverdueBadge />}
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground text-sm">Data-alvo</dt>
        <dd>{goal.targetDate ? formatDateForDisplay(goal.targetDate) : "Sem data-alvo"}</dd>
        <dt className="text-muted-foreground text-sm">Descrição</dt>
        <dd className="whitespace-pre-line break-words">
          {goal.description ?? <span className="text-muted-foreground">Sem descrição.</span>}
        </dd>
      </dl>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`/goals/${goal.id}/edit`}>Editar</Link>
        </Button>
        <DeleteGoalButton goalId={goal.id} goalTitle={goal.title} />
      </div>

      <GoalProgressSummary progress={progress} goalTitle={goal.title} />

      <section aria-labelledby="titulo-trilhas" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="titulo-trilhas" className="text-xl font-semibold tracking-tight">
            Trilhas
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href={`/tracks/new?goalId=${goal.id}`}>Criar trilha</Link>
          </Button>
        </div>
        {tracks.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma trilha vinculada a este objetivo.</p>
        ) : (
          <TrackList tracks={tracks} showGoal={false} headingLevel="h3" />
        )}
      </section>

      <section aria-labelledby="titulo-acoes-pdi" className="space-y-4">
        <h2 id="titulo-acoes-pdi" className="text-xl font-semibold tracking-tight">
          Ações de PDI
        </h2>
        {actions.length === 0 ? (
          <p className="text-muted-foreground">
            Nenhuma ação de PDI vinculada. Vincule pelo formulário da ação, no ciclo de PDI.
          </p>
        ) : (
          <ActionList
            actions={actions}
            today={today}
            editable={false}
            showGoal={false}
            headingLevel="h3"
            context={(action) => (
              <p className="text-muted-foreground text-sm">
                <Link href={`/pdi/${action.cycle.id}`} className="underline underline-offset-4">
                  {action.cycle.title}
                </Link>{" "}
                · {action.areaName}
              </p>
            )}
          />
        )}
      </section>

      {/* Routines repeat and have no "done", so they show adherence instead of
          counting toward the progress above. */}
      <section aria-labelledby="titulo-rotinas" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="titulo-rotinas" className="text-xl font-semibold tracking-tight">
            Rotinas
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href={`/routines/new?goalId=${goal.id}`}>Criar rotina</Link>
          </Button>
        </div>
        {routines.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma rotina vinculada a este objetivo.</p>
        ) : (
          <RoutineList routines={routines} today={today} showGoal={false} headingLevel="h3" />
        )}
      </section>
    </article>
  );
}
