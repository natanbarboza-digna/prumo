import { connection } from "next/server";

import { DeadlinesCard } from "@/components/dashboard/deadlines-card";
import { GoalsTracksCard } from "@/components/dashboard/goals-tracks-card";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { PdiCard } from "@/components/dashboard/pdi-card";
import { ReadingCard } from "@/components/dashboard/reading-card";
import { TimeWeekCard } from "@/components/dashboard/time-week-card";
import { TodayCard } from "@/components/dashboard/today-card";
import { Welcome } from "@/components/dashboard/welcome";
import { todayInAppTimeZone } from "@/lib/dates";
import { minutesNowInAppTimeZone } from "@/lib/time-of-day";
import { getDashboard } from "@/modules/dashboard/service";

export default async function HomePage() {
  // "Today" is read before any database access: connection() tells Next to
  // render the page per request instead of prerendering it with a frozen clock.
  await connection();
  const now = new Date();
  const today = todayInAppTimeZone(now);
  // One call for every card: the service fetches them in parallel. The minute
  // is for today's open time day, which counts up to now.
  const dashboard = await getDashboard(today, minutesNowInAppTimeZone(now));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Prumo</h1>
        <p className="text-muted-foreground">Objetivos, trilhas, rotina e PDI no mesmo prumo.</p>
      </div>

      {dashboard.firstUse ? (
        <Welcome />
      ) : (
        <div className="space-y-4">
          <KpiStrip kpis={dashboard.kpis} />
          {/* Wide blocks on the left (2 of 3 columns), narrow ones on the right. */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TodayCard block={dashboard.today} today={today} />
            </div>
            <DeadlinesCard deadlines={dashboard.deadlines} today={today} />
            <div className="lg:col-span-2">
              <TimeWeekCard week={dashboard.timeWeek} />
            </div>
            <PdiCard pdi={dashboard.pdi} today={today} />
            {/* With the reading block (plan 037), goals and tracks take two columns of three. */}
            <div className={dashboard.reading.visible ? "lg:col-span-2" : "lg:col-span-3"}>
              <GoalsTracksCard goals={dashboard.goals} tracks={dashboard.tracks} today={today} />
            </div>
            {dashboard.reading.visible && (
              <ReadingCard reading={dashboard.reading} year={Number(today.slice(0, 4))} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
