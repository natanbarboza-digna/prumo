import type { Metadata } from "next";

import { ActionForm } from "@/components/pdi/action-form";
import { ClosedCycleNotice } from "@/components/pdi/closed-cycle-notice";
import { categoryOptions } from "@/modules/categories/options";
import { goalOptions } from "@/modules/goals/options";
import { todayInAppTimeZone } from "@/lib/dates";
import { updateActionAction } from "@/modules/pdi/actions";
import { listRoutinesInEffect } from "@/modules/pdi/service";

import { loadAction, loadCycle } from "../../../load";

export const metadata: Metadata = { title: "Editar ação" };

export default async function EditActionPage({
  params,
}: PageProps<"/pdi/[id]/actions/[actionId]/edit">) {
  const { id, actionId } = await params;
  const [cycle, action] = await Promise.all([loadCycle(id), loadAction(id, actionId)]);
  if (cycle.status === "CLOSED") {
    return <ClosedCycleNotice cycleId={cycle.id} heading="Editar ação" />;
  }

  const [categories, goals, routinesInEffect] = await Promise.all([
    categoryOptions(action.category.id),
    goalOptions(action.goal),
    listRoutinesInEffect(action.id, todayInAppTimeZone()),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Editar ação</h1>
      <ActionForm
        action={updateActionAction.bind(null, action.id)}
        areas={cycle.areas.map((area) => ({ id: area.id, label: area.name }))}
        categories={categories}
        goals={goals}
        defaultValues={{
          areaId: action.areaId,
          categoryId: action.category.id,
          title: action.title,
          description: action.description ?? "",
          expectedResult: action.expectedResult ?? "",
          dueDate: action.dueDate ?? "",
          status: action.status,
          evidence: action.evidence ?? "",
          managerComment: action.managerComment ?? "",
          goalId: action.goal?.id ?? "",
        }}
        routinesInEffect={routinesInEffect}
        submitLabel="Salvar alterações"
        cancelHref={`/pdi/${cycle.id}`}
      />
    </div>
  );
}
