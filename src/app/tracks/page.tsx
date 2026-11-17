import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { TrackList } from "@/components/tracks/track-list";
import { Button } from "@/components/ui/button";
import { listTracks } from "@/modules/tracks/service";

export const metadata: Metadata = { title: "Trilhas" };

export default async function TracksPage() {
  // This page reads no URL data, so make it explicit that it renders per
  // request (fresh from the database) instead of being prerendered.
  await connection();
  const tracks = await listTracks();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Trilhas</h1>
        <Button asChild>
          <Link href="/tracks/new">Nova trilha</Link>
        </Button>
      </div>
      {tracks.length === 0 ? (
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
