import type { Metadata } from "next";

import { StepForm } from "@/components/tracks/step-form";
import { createStepAction } from "@/modules/tracks/actions";

import { loadTrack } from "../../load-track";

export const metadata: Metadata = { title: "Nova etapa" };

export default async function NewStepPage({ params }: PageProps<"/tracks/[id]/steps/new">) {
  const track = await loadTrack((await params).id);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Nova etapa</h1>
        <p className="text-muted-foreground">Trilha: {track.title}</p>
      </div>
      <StepForm
        action={createStepAction.bind(null, track.id)}
        submitLabel="Adicionar etapa"
        cancelHref={`/tracks/${track.id}`}
      />
    </div>
  );
}
