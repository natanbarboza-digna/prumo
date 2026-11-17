import type { Metadata } from "next";

import { AreaForm } from "@/components/pdi/area-form";
import { ClosedCycleNotice } from "@/components/pdi/closed-cycle-notice";
import { updateAreaAction } from "@/modules/pdi/actions";

import { loadArea, loadCycle } from "../../../load";

export const metadata: Metadata = { title: "Editar área" };

export default async function EditAreaPage({ params }: PageProps<"/pdi/[id]/areas/[areaId]/edit">) {
  const { id, areaId } = await params;
  const [cycle, area] = await Promise.all([loadCycle(id), loadArea(id, areaId)]);
  if (cycle.status === "CLOSED") {
    return <ClosedCycleNotice cycleId={cycle.id} heading="Editar área" />;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Editar área</h1>
      <AreaForm
        action={updateAreaAction.bind(null, area.id)}
        defaultValues={{
          name: area.name,
          description: area.description ?? "",
          expectedOutcome: area.expectedOutcome ?? "",
        }}
        submitLabel="Salvar alterações"
        cancelHref={`/pdi/${cycle.id}`}
      />
    </div>
  );
}
