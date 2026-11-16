import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { LogControls } from "@/components/routines/log-controls";
import { Button } from "@/components/ui/button";
import { formatLongDate, todayInAppTimeZone } from "@/lib/dates";
import { doneTodayText } from "@/modules/routines/labels";
import { listRoutinesForDay } from "@/modules/routines/service";

export const metadata: Metadata = { title: "Hoje" };

export default async function TodayPage() {
  // "Today" changes at midnight and the logs change all the time: render on
  // every request. connection() also lets us read the clock (new Date()),
  // which Next does not allow in a prerendered page.
  await connection();
  const today = todayInAppTimeZone();
  const items = await listRoutinesForDay(today);
  const done = items.filter((item) => item.log?.status === "DONE").length;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Hoje</h1>
          <p className="text-muted-foreground first-letter:uppercase">{formatLongDate(today)}</p>
        </div>
        {items.length > 0 && (
          <p className="text-sm font-medium" role="status">
            {doneTodayText(done, items.length)}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="space-y-4 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Nenhuma rotina para hoje.</p>
          <Button asChild>
            <Link href="/routines/new">Criar rotina</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3" aria-label="Rotinas de hoje">
          {items.map(({ routine, log }) => (
            <li key={routine.id} className="bg-card space-y-3 rounded-lg border p-4">
              <div className="space-y-1">
                <h2 className="font-medium break-words">
                  <Link href={`/routines/${routine.id}`} className="hover:underline">
                    {routine.title}
                  </Link>
                </h2>
                <p className="text-muted-foreground flex flex-wrap gap-x-3 text-sm">
                  {routine.timeOfDay && <span>{routine.timeOfDay}</span>}
                  {routine.goal && <span>Objetivo: {routine.goal.title}</span>}
                </p>
              </div>
              <LogControls routineId={routine.id} date={today} log={log} label={routine.title} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
