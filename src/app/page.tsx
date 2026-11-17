import { connection } from "next/server";

import { DeadlinesCard } from "@/components/dashboard/deadlines-card";
import { GoalsCard } from "@/components/dashboard/goals-card";
import { PdiCard } from "@/components/dashboard/pdi-card";
import { TodayCard } from "@/components/dashboard/today-card";
import { TracksCard } from "@/components/dashboard/tracks-card";
import { Welcome } from "@/components/dashboard/welcome";
import { todayInAppTimeZone } from "@/lib/dates";
import { getDashboard } from "@/modules/dashboard/service";

export default async function HomePage() {
  // "Today" is read before any database access: connection() tells Next to
  // render the page per request instead of prerendering it with a frozen clock.
  await connection();
  const today = todayInAppTimeZone();
  // One call for every card: the service fetches them in parallel.
  const dashboard = await getDashboard(today);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Prumo</h1>
        <p className="text-muted-foreground">Objetivos, trilhas, rotina e PDI no mesmo prumo.</p>
      </div>

      {dashboard.firstUse ? (
        <Welcome />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <TodayCard block={dashboard.today} today={today} />
          <DeadlinesCard deadlines={dashboard.deadlines} today={today} />
          <PdiCard pdi={dashboard.pdi} today={today} />
          <GoalsCard goals={dashboard.goals} today={today} />
          <TracksCard tracks={dashboard.tracks} />
        </div>
      )}
    </div>
  );
}
