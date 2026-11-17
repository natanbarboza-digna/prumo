import type { Metadata } from "next";

import { CycleForm } from "@/components/pdi/cycle-form";
import { createCycleAction } from "@/modules/pdi/actions";

export const metadata: Metadata = { title: "Novo ciclo de PDI" };

export default function NewCyclePage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Novo ciclo de PDI</h1>
      <CycleForm
        action={createCycleAction}
        defaultValues={{ title: "", startDate: "", endDate: "", status: "PLANNED" }}
        submitLabel="Criar ciclo"
        cancelHref="/pdi"
      />
    </div>
  );
}
