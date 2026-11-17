import type { Metadata } from "next";

import { ClosedCycleNotice } from "@/components/pdi/closed-cycle-notice";
import { CycleForm } from "@/components/pdi/cycle-form";
import { updateCycleAction } from "@/modules/pdi/actions";

import { loadCycle } from "../load";

export const metadata: Metadata = { title: "Editar ciclo" };

export default async function EditCyclePage({ params }: PageProps<"/pdi/[id]/edit">) {
  const cycle = await loadCycle((await params).id);
  if (cycle.status === "CLOSED") {
    return <ClosedCycleNotice cycleId={cycle.id} heading="Editar ciclo" />;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Editar ciclo</h1>
      <CycleForm
        action={updateCycleAction.bind(null, cycle.id)}
        defaultValues={{
          title: cycle.title,
          startDate: cycle.startDate,
          endDate: cycle.endDate,
          status: cycle.status,
          managerName: cycle.managerName ?? "",
          careerObjective: cycle.careerObjective ?? "",
          selfAssessment: cycle.selfAssessment ?? "",
          managerFeedback: cycle.managerFeedback ?? "",
          finalRating: cycle.finalRating ?? "",
        }}
        submitLabel="Salvar alterações"
        cancelHref={`/pdi/${cycle.id}`}
      />
    </div>
  );
}
