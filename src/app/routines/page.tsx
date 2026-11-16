import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { RoutineFilter } from "@/components/routines/routine-filter";
import { RoutineList } from "@/components/routines/routine-list";
import { Button } from "@/components/ui/button";
import { todayInAppTimeZone } from "@/lib/dates";
import { listRoutines } from "@/modules/routines/service";

export const metadata: Metadata = { title: "Rotinas" };

export default async function RoutinesPage({ searchParams }: PageProps<"/routines">) {
  // Anything other than ?state=ended falls back to the default filter.
  const state = (await searchParams).state === "ended" ? "ended" : "active";
  // Reading the clock (for "today") needs request time: Next refuses new Date()
  // while prerendering, and this page reads it before touching the database.
  await connection();
  const today = todayInAppTimeZone();
  const routines = await listRoutines({ state, today });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Rotinas</h1>
        <Button asChild>
          <Link href="/routines/new">Nova rotina</Link>
        </Button>
      </div>
      <RoutineFilter current={state} />
      {routines.length === 0 ? (
        <div className="space-y-4 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {state === "ended" ? "Nenhuma rotina encerrada." : "Você ainda não tem rotinas ativas."}
          </p>
          {state === "active" && (
            <Button asChild>
              <Link href="/routines/new">Criar rotina</Link>
            </Button>
          )}
        </div>
      ) : (
        <RoutineList routines={routines} today={today} />
      )}
    </div>
  );
}
