import type { Metadata } from "next";

import { GoalForm } from "@/components/goals/goal-form";
import { updateGoalAction } from "@/modules/goals/actions";

import { loadGoal } from "../load-goal";

export const metadata: Metadata = { title: "Editar objetivo" };

export default async function EditGoalPage({ params }: PageProps<"/goals/[id]/edit">) {
  const goal = await loadGoal((await params).id);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Editar objetivo</h1>
      <GoalForm
        action={updateGoalAction.bind(null, goal.id)}
        defaultValues={{
          title: goal.title,
          description: goal.description ?? "",
          status: goal.status,
          targetDate: goal.targetDate ?? "",
        }}
        submitLabel="Salvar alterações"
        cancelHref={`/goals/${goal.id}`}
      />
    </div>
  );
}
