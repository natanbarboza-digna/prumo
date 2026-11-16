import type { Metadata } from "next";

import { AreaForm } from "@/components/pdi/area-form";
import { ClosedCycleNotice } from "@/components/pdi/closed-cycle-notice";
import { createAreaAction } from "@/modules/pdi/actions";

import { loadCycle } from "../../load";

export const metadata: Metadata = { title: "Nova área" };

export default async function NewAreaPage({ params }: PageProps<"/pdi/[id]/areas/new">) {
  const cycle = await loadCycle((await params).id);
  if (cycle.status === "CLOSED") {
    return <ClosedCycleNotice cycleId={cycle.id} heading="Nova área" />;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nova área</h1>
      <p className="text-muted-foreground">Ciclo: {cycle.title}</p>
      <AreaForm
        action={createAreaAction.bind(null, cycle.id)}
        submitLabel="Adicionar área"
        cancelHref={`/pdi/${cycle.id}`}
      />
    </div>
  );
}
