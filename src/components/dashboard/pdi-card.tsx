import Link from "next/link";

import { DashboardCard, EmptyCardText } from "@/components/dashboard/dashboard-card";
import { ActionProgressBar } from "@/components/pdi/action-progress";
import { AdherenceMeter } from "@/components/routines/adherence-meter";
import { formatDateForDisplay } from "@/lib/dates";
import { cycleTimeText, daysAgoText } from "@/modules/dashboard/labels";
import type { DashboardPdi } from "@/modules/dashboard/service";

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
          <ActionProgressBar
            done={pdi.cycle.progress.done}
            total={pdi.cycle.progress.total}
            label={`Progresso do ciclo ${pdi.cycle.title}`}
          />
          {pdi.overdueActions > 0 && (
            <p className="text-destructive text-sm">
              {pdi.overdueActions === 1
                ? "1 ação atrasada"
                : `${pdi.overdueActions} ações atrasadas`}
            </p>
          )}
          {pdi.routineAdherence && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Rotinas vinculadas</p>
              <AdherenceMeter
                adherence={pdi.routineAdherence}
                label={`Adesão das rotinas do ciclo ${pdi.cycle.title}`}
                periodText="no ciclo, até hoje"
              />
            </div>
          )}
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
