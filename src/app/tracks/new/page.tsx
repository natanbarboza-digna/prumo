import type { Metadata } from "next";

import { TrackForm } from "@/components/tracks/track-form";
import { createTrackAction } from "@/modules/tracks/actions";

import { goalOptions } from "../goal-options";

export const metadata: Metadata = { title: "Nova trilha" };

export default async function NewTrackPage({ searchParams }: PageProps<"/tracks/new">) {
  // "Criar trilha" on a goal page links here with ?goalId= to preselect it.
  const { goalId } = await searchParams;
  const goals = await goalOptions();
  const preselected = goals.find((goal) => goal.id === goalId)?.id ?? "";

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nova trilha</h1>
      <TrackForm
        action={createTrackAction}
        goals={goals}
        defaultValues={{ title: "", goalId: preselected }}
        submitLabel="Criar trilha"
        cancelHref="/tracks"
      />
    </div>
  );
}
