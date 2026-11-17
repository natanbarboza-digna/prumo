import type { Metadata } from "next";

import { CheckInForm } from "@/components/pdi/check-in-form";
import { ClosedCycleNotice } from "@/components/pdi/closed-cycle-notice";
import { todayInAppTimeZone } from "@/lib/dates";
import { createCheckInAction } from "@/modules/pdi/actions";

import { loadCycle } from "../../load";

export const metadata: Metadata = { title: "Novo check-in" };

export default async function NewCheckInPage({ params }: PageProps<"/pdi/[id]/check-ins/new">) {
  const cycle = await loadCycle((await params).id);
  if (cycle.status === "CLOSED") {
    return <ClosedCycleNotice cycleId={cycle.id} heading="Novo check-in" />;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Novo check-in</h1>
      <p className="text-muted-foreground">Ciclo: {cycle.title}</p>
      <CheckInForm
        action={createCheckInAction.bind(null, cycle.id)}
        defaultValues={{ date: todayInAppTimeZone(), summary: "" }}
        submitLabel="Registrar check-in"
        cancelHref={`/pdi/${cycle.id}`}
      />
    </div>
  );
}
