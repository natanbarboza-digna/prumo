import Link from "next/link";

import { TrackStatusBadge } from "@/components/tracks/track-badges";
import { TrackProgress } from "@/components/tracks/track-progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type TrackSummary, deriveTrackStatus } from "@/modules/tracks/service";

type TrackListProps = {
  tracks: TrackSummary[];
  /** Hide the goal line when the list is already shown inside that goal. */
  showGoal?: boolean;
  headingLevel?: "h2" | "h3";
};

export function TrackList({ tracks, showGoal = true, headingLevel = "h2" }: TrackListProps) {
  const Heading = headingLevel;
  return (
    <ul className="grid gap-3" aria-label="Trilhas">
      {tracks.map((track) => (
        <li key={track.id}>
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">
                <Heading className="text-base">
                  <Link href={`/tracks/${track.id}`} className="hover:underline">
                    {track.title}
                  </Link>
                </Heading>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <TrackStatusBadge status={deriveTrackStatus(track.counts)} />
                {showGoal && track.goal && (
                  <span>
                    Objetivo:{" "}
                    <Link
                      href={`/goals/${track.goal.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {track.goal.title}
                    </Link>
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <TrackProgress
                done={track.counts.done}
                total={track.counts.total}
                label={`Progresso da trilha ${track.title}`}
              />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
