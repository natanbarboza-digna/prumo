import type { Metadata } from "next";

import { RoutineForm } from "@/components/routines/routine-form";
import { todayInAppTimeZone } from "@/lib/dates";
import { goalOptions } from "@/modules/goals/options";
import { createRoutineAction } from "@/modules/routines/actions";

export const metadata: Metadata = { title: "Nova rotina" };

export default async function NewRoutinePage({ searchParams }: PageProps<"/routines/new">) {
  // "Criar rotina" on a goal page links here with ?goalId= to preselect it.
  const { goalId } = await searchParams;
  const goals = await goalOptions();
  const preselected = goals.find((goal) => goal.id === goalId)?.id ?? "";

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nova rotina</h1>
      <RoutineForm
        action={createRoutineAction}
        goals={goals}
        defaultValues={{
          title: "",
          weekdays: [],
          startDate: todayInAppTimeZone(),
          goalId: preselected,
        }}
        submitLabel="Criar rotina"
        cancelHref="/routines"
      />
    </div>
  );
}
