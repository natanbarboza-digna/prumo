import type { Metadata } from "next";
import Link from "next/link";

import { DeleteGoalButton } from "@/components/goals/delete-goal-button";
import { GoalStatusBadge, OverdueBadge } from "@/components/goals/goal-status-badge";
import { TrackList } from "@/components/tracks/track-list";
import { TrackProgress } from "@/components/tracks/track-progress";
import { Button } from "@/components/ui/button";
import { formatDateForDisplay, todayInAppTimeZone } from "@/lib/dates";
import { getGoalProgress, isGoalOverdue } from "@/modules/goals/service";
import { listTracks } from "@/modules/tracks/service";

import { loadGoal } from "./load-goal";

export const metadata: Metadata = { title: "Objetivo" };

export default async function GoalPage({ params }: PageProps<"/goals/[id]">) {
  const goal = await loadGoal((await params).id);
  const [tracks, progress] = await Promise.all([
    listTracks({ goalId: goal.id }),
    getGoalProgress(goal.id),
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
          {isGoalOverdue(goal, todayInAppTimeZone()) && <OverdueBadge />}
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
          <>
            <TrackProgress
              done={progress.done}
              total={progress.total}
              label={`Progresso do objetivo ${goal.title}`}
            />
            <TrackList tracks={tracks} showGoal={false} headingLevel="h3" />
          </>
        )}
      </section>
    </article>
  );
}
