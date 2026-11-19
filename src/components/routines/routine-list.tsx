import Link from "next/link";

import { AdherenceMeter } from "@/components/routines/adherence-meter";
import { RoutineStateBadge } from "@/components/routines/routine-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { scheduleText, streakShortText } from "@/modules/routines/labels";
import type { RoutineSummary } from "@/modules/routines/service";

type RoutineListProps = {
  routines: RoutineSummary[];
  today: string;
  /** Hide the goal line when the list is already shown inside that goal. */
  showGoal?: boolean;
  headingLevel?: "h2" | "h3";
};

export function RoutineList({
  routines,
  today,
  showGoal = true,
  headingLevel = "h2",
}: RoutineListProps) {
  const Heading = headingLevel;
  return (
    <ul className="grid gap-3" aria-label="Rotinas">
      {routines.map((routine) => (
        <li key={routine.id}>
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">
                <Heading className="text-base">
                  <Link href={`/routines/${routine.id}`} className="hover:underline">
                    {routine.title}
                  </Link>
                </Heading>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <span>{scheduleText(routine)}</span>
                {streakShortText(routine.streak) && <span>{streakShortText(routine.streak)}</span>}
                <RoutineStateBadge routine={routine} today={today} />
                {routine.pdiAction && <Badge variant="outline">PDI</Badge>}
                {showGoal && routine.goal && (
                  <span>
                    Objetivo:{" "}
                    <Link
                      href={`/goals/${routine.goal.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {routine.goal.title}
                    </Link>
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <AdherenceMeter
                adherence={routine.adherence}
                label={`Adesão da rotina ${routine.title}`}
              />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
