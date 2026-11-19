import Link from "next/link";

import { DashboardCard, EmptyCardText } from "@/components/dashboard/dashboard-card";
import { LogControls } from "@/components/routines/log-controls";
import { formatLongDate } from "@/lib/dates";
import { recentAdherenceText } from "@/modules/dashboard/labels";
import type { Dashboard } from "@/modules/dashboard/service";
import { doneTodayText, weekProgressText } from "@/modules/routines/labels";

/** Today's routines with the same log buttons as the "Hoje" screen. */
export function TodayCard({ block, today }: { block: Dashboard["today"]; today: string }) {
  return (
    <DashboardCard id="hoje" title="Hoje" more={{ href: "/today", label: "Abrir Hoje" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="text-muted-foreground first-letter:uppercase">{formatLongDate(today)}</p>
        {block.items.length > 0 && (
          <p className="font-medium" role="status">
            {doneTodayText(block.done, block.items.length)}
          </p>
        )}
      </div>

      {block.items.length === 0 ? (
        <EmptyCardText text="Nenhuma rotina para hoje." href="/routines/new" label="Criar rotina" />
      ) : (
        <ul className="grid gap-3" aria-label="Rotinas de hoje">
          {block.items.map(({ routine, log, week }) => (
            <li key={routine.id} className="space-y-2 rounded-md border p-3">
              <h3 className="font-medium break-words">
                <Link href={`/routines/${routine.id}`} className="hover:underline">
                  {routine.title}
                </Link>
                {routine.timeOfDay && (
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    {routine.timeOfDay}
                  </span>
                )}
              </h3>
              {week && <p className="text-muted-foreground text-sm">{weekProgressText(week)}</p>}
              <LogControls
                routineId={routine.id}
                date={today}
                log={log}
                label={routine.title}
                allowSkip={week === null}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-sm">{recentAdherenceText(block.adherence)}</p>
    </DashboardCard>
  );
}
