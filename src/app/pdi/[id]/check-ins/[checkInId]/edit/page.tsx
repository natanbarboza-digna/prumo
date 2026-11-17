import type { Metadata } from "next";

import { CheckInForm } from "@/components/pdi/check-in-form";
import { ClosedCycleNotice } from "@/components/pdi/closed-cycle-notice";
import { updateCheckInAction } from "@/modules/pdi/actions";

import { loadCheckIn, loadCycle } from "../../../load";

export const metadata: Metadata = { title: "Editar check-in" };

export default async function EditCheckInPage({
  params,
}: PageProps<"/pdi/[id]/check-ins/[checkInId]/edit">) {
  const { id, checkInId } = await params;
  const [cycle, checkIn] = await Promise.all([loadCycle(id), loadCheckIn(id, checkInId)]);
  if (cycle.status === "CLOSED") {
    return <ClosedCycleNotice cycleId={cycle.id} heading="Editar check-in" />;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Editar check-in</h1>
      <CheckInForm
        action={updateCheckInAction.bind(null, checkIn.id)}
        defaultValues={{
          date: checkIn.date,
          summary: checkIn.summary,
          nextSteps: checkIn.nextSteps ?? "",
          managerNotes: checkIn.managerNotes ?? "",
        }}
        submitLabel="Salvar alterações"
        cancelHref={`/pdi/${cycle.id}`}
      />
    </div>
  );
}
