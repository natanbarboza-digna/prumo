import type { Metadata } from "next";

import { TrackForm } from "@/components/tracks/track-form";
import { updateTrackAction } from "@/modules/tracks/actions";

import { goalOptions } from "../../goal-options";
import { loadTrack } from "../load-track";

export const metadata: Metadata = { title: "Editar trilha" };

export default async function EditTrackPage({ params }: PageProps<"/tracks/[id]/edit">) {
  const track = await loadTrack((await params).id);
  const goals = await goalOptions(track.goal);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Editar trilha</h1>
      <TrackForm
        action={updateTrackAction.bind(null, track.id)}
        goals={goals}
        defaultValues={{
          title: track.title,
          description: track.description ?? "",
          goalId: track.goal?.id ?? "",
        }}
        submitLabel="Salvar alterações"
        cancelHref={`/tracks/${track.id}`}
      />
    </div>
  );
}
