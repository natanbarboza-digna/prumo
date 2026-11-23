import Link from "next/link";

import { DashboardCard, EmptyCardText } from "@/components/dashboard/dashboard-card";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { formatDateForDisplay } from "@/lib/dates";
import { cycleTimeText, daysAgoText } from "@/modules/dashboard/labels";
import type { DashboardPdi } from "@/modules/dashboard/service";
import { actionProgressText } from "@/modules/pdi/labels";
import { adherenceText } from "@/modules/routines/labels";
import { progressPercent } from "@/modules/tracks/service";

/** The active cycle at a glance, or the next planned one. */
export function PdiCard({ pdi, today }: { pdi: DashboardPdi; today: string }) {
  return (
    <DashboardCard id="pdi" title="PDI" more={{ href: "/pdi", label: "Ver ciclos" }}>
      {pdi.kind === "NONE" && (
        <EmptyCardText text="Nenhum ciclo ativo." href="/pdi/new" label="Criar ciclo" />
      )}

      {pdi.kind === "PLANNED" && (
        <p className="text-sm">
          Nenhum ciclo ativo. Próximo ciclo:{" "}
          <Link href={`/pdi/${pdi.cycle.id}`} className="font-medium underline underline-offset-4">
            {pdi.cycle.title}
          </Link>
          , começa em {formatDateForDisplay(pdi.cycle.startDate)}.
        </p>
      )}

      {pdi.kind === "ACTIVE" && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-medium break-words">
              <Link href={`/pdi/${pdi.cycle.id}`} className="hover:underline">
                {pdi.cycle.title}
              </Link>
            </h3>
            <p className="text-muted-foreground text-sm">
              {formatDateForDisplay(pdi.cycle.startDate)} a{" "}
              {formatDateForDisplay(pdi.cycle.endDate)} · {cycleTimeText(pdi.cycle.endDate, today)}
            </p>
          </div>
          <CycleProgress pdi={pdi} />
          <p className="text-sm">
            {pdi.lastCheckIn === null
              ? "Nenhum check-in ainda."
              : `Último check-in: ${formatDateForDisplay(pdi.lastCheckIn)} (${daysAgoText(pdi.lastCheckIn, today)}).`}{" "}
            <Link
              href={`/pdi/${pdi.cycle.id}/check-ins/new`}
              className="underline underline-offset-4"
            >
              Registrar check-in
            </Link>
          </p>
        </div>
      )}
    </DashboardCard>
  );
}

/** The ring of done actions (cancelled ones left out) and the facts beside it (plan 034). */
function CycleProgress({ pdi }: { pdi: Extract<DashboardPdi, { kind: "ACTIVE" }> }) {
  const { done, total } = pdi.cycle.progress;
  const percent = progressPercent(done, total);
  const adherence = pdi.routineAdherence;
  return (
    <div className="flex items-center gap-4">
      <ProgressRing percent={percent} label={`${percent}% das ações do ciclo concluídas`} />
      <ul className="min-w-0 space-y-1 text-sm">
        <li className="font-medium">{actionProgressText(done, total)}</li>
        {pdi.overdueActions > 0 && (
          <li className="text-destructive">
            {pdi.overdueActions === 1 ? "1 ação atrasada" : `${pdi.overdueActions} ações atrasadas`}
          </li>
        )}
        {adherence && (
          <li className="text-muted-foreground">
            Rotinas vinculadas:{" "}
            {adherence.scheduled === 0
              ? adherenceText(adherence).toLowerCase()
              : `${adherence.rate}% de adesão`}
          </li>
        )}
      </ul>
    </div>
  );
}
