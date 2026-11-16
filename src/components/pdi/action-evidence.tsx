import Link from "next/link";

import { AdherenceMeter } from "@/components/routines/adherence-meter";
import { RoutineStateBadge } from "@/components/routines/routine-badges";
import { formatDateForDisplay, formatLongDate } from "@/lib/dates";
import type { ActionDetail } from "@/modules/pdi/service";
import { logStatusLabels, scheduleText } from "@/modules/routines/labels";

type ActionEvidenceProps = {
  detail: ActionDetail;
  today: string;
  /** What to say when there is no linked routine (e.g. how to create one). */
  emptyText: string;
};

/** The linked routines with their adherence in the cycle, and their logs. */
export function ActionEvidence({ detail, today, emptyText }: ActionEvidenceProps) {
  return (
    <>
      <section aria-labelledby="titulo-rotinas-vinculadas" className="space-y-4">
        <div className="space-y-1">
          <h2 id="titulo-rotinas-vinculadas" className="text-xl font-semibold tracking-tight">
            Rotinas vinculadas
          </h2>
          <p className="text-muted-foreground text-sm">
            A adesão conta só os dias dentro do ciclo (
            {formatDateForDisplay(detail.cycle.startDate)} a{" "}
            {formatDateForDisplay(detail.cycle.endDate)}), até hoje.
          </p>
        </div>
        {detail.routines.length === 0 ? (
          <p className="text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="grid gap-3" aria-label="Rotinas vinculadas">
            {detail.routines.map(({ routine, period, adherence }) => (
              <li key={routine.id} className="bg-card space-y-3 rounded-lg border p-4">
                <div className="space-y-1">
                  <h3 className="font-medium break-words">
                    <Link href={`/routines/${routine.id}`} className="hover:underline">
                      {routine.title}
                    </Link>
                  </h3>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                    <span>{scheduleText(routine.weekdays, routine.timeOfDay)}</span>
                    <RoutineStateBadge routine={routine} today={today} />
                  </div>
                </div>
                {period === null ? (
                  <p className="text-muted-foreground text-sm">
                    Ainda não há dias desta rotina dentro do ciclo.
                  </p>
                ) : (
                  <AdherenceMeter
                    adherence={adherence}
                    label={`Adesão da rotina ${routine.title} no ciclo`}
                    periodText={`${formatDateForDisplay(period.from)} a ${formatDateForDisplay(period.to)}`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail.routines.length > 0 && (
        <section aria-labelledby="titulo-registros" className="space-y-4">
          <h2 id="titulo-registros" className="text-xl font-semibold tracking-tight">
            Registros
          </h2>
          {detail.logs.length === 0 ? (
            <p className="text-muted-foreground">
              Nenhum registro no período. Marque a rotina na tela Hoje.
            </p>
          ) : (
            <ol className="grid gap-2" aria-label="Registros">
              {detail.logs.map((log) => (
                <li key={`${log.routineId}-${log.date}`} className="rounded-lg border p-3 text-sm">
                  <p>
                    <span className="font-medium first-letter:uppercase">
                      {formatLongDate(log.date)}
                    </span>
                    {" · "}
                    {log.routineTitle}
                    {" · "}
                    {logStatusLabels[log.status]}
                  </p>
                  {log.note && (
                    <p className="text-muted-foreground break-words whitespace-pre-line">
                      {log.note}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </>
  );
}
