import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { StepList } from "@/components/tracks/step-list";
import { TrackStatusBadge } from "@/components/tracks/track-badges";
import { TrackProgress } from "@/components/tracks/track-progress";
import { Button } from "@/components/ui/button";
import { todayInAppTimeZone } from "@/lib/dates";
import { deleteTrackAction } from "@/modules/tracks/actions";
import { deriveTrackStatus } from "@/modules/tracks/service";

import { loadTrack } from "./load-track";

export const metadata: Metadata = { title: "Trilha" };

export default async function TrackPage({ params }: PageProps<"/tracks/[id]">) {
  const track = await loadTrack((await params).id);

  return (
    <article className="max-w-3xl space-y-8">
      <div className="space-y-4">
        <Link href="/tracks" className="text-muted-foreground text-sm hover:underline">
          ← Trilhas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight break-words">{track.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <TrackStatusBadge status={deriveTrackStatus(track.counts)} />
          {track.goal ? (
            <span>
              Objetivo:{" "}
              <Link href={`/goals/${track.goal.id}`} className="underline underline-offset-4">
                {track.goal.title}
              </Link>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem objetivo vinculado</span>
          )}
        </div>
        {track.description && (
          <p className="whitespace-pre-line break-words">{track.description}</p>
        )}
        <TrackProgress
          done={track.counts.done}
          total={track.counts.total}
          label={`Progresso da trilha ${track.title}`}
        />
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={`/tracks/${track.id}/edit`}>Editar trilha</Link>
          </Button>
          <ConfirmDeleteButton
            action={deleteTrackAction.bind(null, track.id)}
            title="Excluir trilha?"
            description={`“${track.title}” e todas as suas etapas serão excluídas. Essa ação não pode ser desfeita.`}
            triggerLabel="Excluir trilha"
          />
        </div>
      </div>

      <section aria-labelledby="titulo-etapas" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="titulo-etapas" className="text-xl font-semibold tracking-tight">
            Etapas
          </h2>
          <Button asChild>
            <Link href={`/tracks/${track.id}/steps/new`}>Adicionar etapa</Link>
          </Button>
        </div>
        <StepList trackId={track.id} steps={track.steps} today={todayInAppTimeZone()} />
      </section>
    </article>
  );
}
