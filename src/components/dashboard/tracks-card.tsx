import Link from "next/link";

import { DashboardCard, EmptyCardText } from "@/components/dashboard/dashboard-card";
import { TrackProgress } from "@/components/tracks/track-progress";
import type { Dashboard } from "@/modules/dashboard/service";

/** Tracks with at least one step started or done, and not all done. */
export function TracksCard({ tracks }: { tracks: Dashboard["tracks"] }) {
  return (
    <DashboardCard
      id="trilhas"
      title="Trilhas em andamento"
      more={{ href: "/tracks", label: "Ver todas" }}
    >
      {tracks.items.length === 0 ? (
        <EmptyCardText text="Nenhuma trilha em andamento." href="/tracks" label="Ver trilhas" />
      ) : (
        <ul className="grid gap-3" aria-label="Trilhas em andamento">
          {tracks.items.map((track) => (
            <li key={track.id} className="space-y-2">
              <div className="space-y-0.5">
                <h3 className="font-medium break-words">
                  <Link href={`/tracks/${track.id}`} className="hover:underline">
                    {track.title}
                  </Link>
                </h3>
                {track.goal && (
                  <p className="text-muted-foreground text-sm">Objetivo: {track.goal.title}</p>
                )}
              </div>
              <TrackProgress
                done={track.counts.done}
                total={track.counts.total}
                label={`Progresso da trilha ${track.title}`}
              />
            </li>
          ))}
        </ul>
      )}
      {tracks.total > tracks.items.length && (
        <p className="text-muted-foreground text-sm">e mais {tracks.total - tracks.items.length}</p>
      )}
    </DashboardCard>
  );
}
