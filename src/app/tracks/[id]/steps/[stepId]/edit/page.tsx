import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StepForm } from "@/components/tracks/step-form";
import { updateStepAction } from "@/modules/tracks/actions";

import { loadTrack } from "../../../load-track";

export const metadata: Metadata = { title: "Editar etapa" };

export default async function EditStepPage({
  params,
}: PageProps<"/tracks/[id]/steps/[stepId]/edit">) {
  const { id, stepId } = await params;
  const track = await loadTrack(id);
  // Only steps of this track are reachable under its URL.
  const step = track.steps.find((candidate) => candidate.id === stepId);
  if (!step) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Editar etapa</h1>
        <p className="text-muted-foreground">Trilha: {track.title}</p>
      </div>
      <StepForm
        action={updateStepAction.bind(null, step.id)}
        defaultValues={{
          title: step.title,
          status: step.status,
          dueDate: step.dueDate ?? "",
          resourceUrl: step.resourceUrl ?? "",
          notes: step.notes ?? "",
        }}
        submitLabel="Salvar alterações"
        cancelHref={`/tracks/${track.id}`}
      />
    </div>
  );
}
