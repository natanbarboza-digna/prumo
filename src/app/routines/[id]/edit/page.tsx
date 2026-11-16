import type { Metadata } from "next";

import { RoutineForm } from "@/components/routines/routine-form";
import { goalOptions } from "@/modules/goals/options";
import { updateRoutineAction } from "@/modules/routines/actions";

import { loadRoutine } from "../load-routine";

export const metadata: Metadata = { title: "Editar rotina" };

export default async function EditRoutinePage({ params }: PageProps<"/routines/[id]/edit">) {
  const routine = await loadRoutine((await params).id);
  const goals = await goalOptions(routine.goal);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Editar rotina</h1>
      <RoutineForm
        action={updateRoutineAction.bind(null, routine.id)}
        goals={goals}
        defaultValues={{
          title: routine.title,
          description: routine.description ?? "",
          weekdays: routine.weekdays,
          timeOfDay: routine.timeOfDay ?? "",
          startDate: routine.startDate,
          endDate: routine.endDate ?? "",
          goalId: routine.goal?.id ?? "",
        }}
        submitLabel="Salvar alterações"
        cancelHref={`/routines/${routine.id}`}
      />
    </div>
  );
}
