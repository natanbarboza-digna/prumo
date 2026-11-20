import type { Metadata } from "next";
import Link from "next/link";

import { DevelopmentTabs } from "@/components/development-tabs";
import { TrackFilter } from "@/components/tracks/track-filter";
import { TrackList } from "@/components/tracks/track-list";
import { Button } from "@/components/ui/button";
import { trackFilterEmptyText } from "@/modules/tracks/labels";
import { trackFilterSchema } from "@/modules/tracks/schemas";
import { listTracks } from "@/modules/tracks/service";

export const metadata: Metadata = { title: "Trilhas" };

export default async function TracksPage({ searchParams }: PageProps<"/tracks">) {
  // ?situacao= picks the filter (plan 024); reading it already makes the page
  // render per request, fresh from the database.
  const filter = trackFilterSchema.parse((await searchParams).situacao);
  const tracks = await listTracks({ filter });

  return (
    <div className="space-y-6">
      <DevelopmentTabs current="/tracks" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Trilhas</h1>
        <Button asChild>
          <Link href="/tracks/new">Nova trilha</Link>
        </Button>
      </div>
      <TrackFilter current={filter} />
      {tracks.length === 0 && filter !== "ACTIVE" ? (
        <p className="text-muted-foreground">{trackFilterEmptyText[filter]}</p>
      ) : tracks.length === 0 ? (
        <div className="space-y-4 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Você ainda não tem trilhas cadastradas.</p>
          <Button asChild>
            <Link href="/tracks/new">Criar trilha</Link>
          </Button>
        </div>
      ) : (
        <TrackList tracks={tracks} />
      )}
    </div>
  );
}
