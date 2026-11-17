import type { Metadata } from "next";

import { ActionForm } from "@/components/pdi/action-form";
import { ClosedCycleNotice } from "@/components/pdi/closed-cycle-notice";
import { categoryOptions } from "@/modules/categories/options";
import { goalOptions } from "@/modules/goals/options";
import { createActionAction } from "@/modules/pdi/actions";

import { loadCycle } from "../../load";

export const metadata: Metadata = { title: "Nova ação" };

export default async function NewActionPage({
  params,
  searchParams,
}: PageProps<"/pdi/[id]/actions/new">) {
  const cycle = await loadCycle((await params).id);
  if (cycle.status === "CLOSED") {
    return <ClosedCycleNotice cycleId={cycle.id} heading="Nova ação" />;
  }

  // "Adicionar ação" on an area links here with ?areaId= to preselect it.
  const { areaId } = await searchParams;
  const [categories, goals] = await Promise.all([categoryOptions(), goalOptions()]);
  const areas = cycle.areas.map((area) => ({ id: area.id, label: area.name }));
  const preselected = areas.find((area) => area.id === areaId)?.id ?? "";

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Nova ação</h1>
      <p className="text-muted-foreground">Ciclo: {cycle.title}</p>
      <ActionForm
        action={createActionAction.bind(null, cycle.id)}
        areas={areas}
        categories={categories}
        goals={goals}
        defaultValues={{
          areaId: preselected,
          categoryId: "",
          title: "",
          status: "NOT_STARTED",
        }}
        submitLabel="Adicionar ação"
        cancelHref={`/pdi/${cycle.id}`}
      />
    </div>
  );
}
