import type { Metadata } from "next";

import { GoalForm } from "@/components/goals/goal-form";
import { createGoalAction } from "@/modules/goals/actions";

export const metadata: Metadata = { title: "Novo objetivo" };

export default function NewGoalPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Novo objetivo</h1>
      <GoalForm action={createGoalAction} submitLabel="Criar objetivo" cancelHref="/goals" />
    </div>
  );
}
