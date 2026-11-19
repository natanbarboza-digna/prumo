import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { AdherenceMeter } from "@/components/routines/adherence-meter";
import { EndRoutineButton } from "@/components/routines/end-routine-button";
import { LogControls } from "@/components/routines/log-controls";
import { RoutineStateBadge } from "@/components/routines/routine-badges";
import { RoutineCalendar } from "@/components/routines/routine-calendar";
import { Button } from "@/components/ui/button";
import { formatDateForDisplay, formatLongDate, todayInAppTimeZone } from "@/lib/dates";
import { deleteRoutineAction, endRoutineAction } from "@/modules/routines/actions";
import { scheduleText } from "@/modules/routines/labels";
import { HISTORY_DAYS, monthRange, parseMonth, routineStateOn } from "@/modules/routines/rules";
import { getAdherence, getRoutineHistory, getRoutineMonth } from "@/modules/routines/service";

import { loadRoutine } from "./load-routine";

export const metadata: Metadata = { title: "Rotina" };

export default async function RoutinePage({ params, searchParams }: PageProps<"/routines/[id]">) {
  const routine = await loadRoutine((await params).id);
  const today = todayInAppTimeZone();
  // ?mes=AAAA-MM picks the calendar month; anything invalid shows the current one.
  const { mes } = await searchParams;
  const range = monthRange(routine, today);
  const month = parseMonth(typeof mes === "string" ? mes : undefined, range);
  const [history, adherence, calendar] = await Promise.all([
    getRoutineHistory(routine.id, today),
    getAdherence(routine.id, today),
    getRoutineMonth(routine.id, month, today),
  ]);
  const state = routineStateOn(routine, today);

  return (
    <article className="max-w-3xl space-y-8">
      <div className="space-y-4">
        <Link href="/routines" className="text-muted-foreground text-sm hover:underline">
          ← Rotinas
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight break-words">{routine.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <RoutineStateBadge routine={routine} today={today} />
          {routine.goal ? (
            <span>
              Objetivo:{" "}
              <Link href={`/goals/${routine.goal.id}`} className="underline underline-offset-4">
                {routine.goal.title}
              </Link>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem objetivo vinculado</span>
          )}
          {routine.pdiAction && (
            <span>
              Ação de PDI:{" "}
              <Link
                href={`/pdi/${routine.pdiAction.cycleId}/actions/${routine.pdiAction.id}`}
                className="underline underline-offset-4"
              >
                {routine.pdiAction.title}
              </Link>
            </span>
          )}
        </div>

        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground text-sm">Quando</dt>
          <dd>{scheduleText(routine)}</dd>
          <dt className="text-muted-foreground text-sm">Período</dt>
          <dd>
            {routine.endDate
              ? `De ${formatDateForDisplay(routine.startDate)} a ${formatDateForDisplay(routine.endDate)}`
              : `Desde ${formatDateForDisplay(routine.startDate)}, sem data de fim`}
          </dd>
        </dl>

        {routine.description && (
          <p className="break-words whitespace-pre-line">{routine.description}</p>
        )}

        <AdherenceMeter adherence={adherence} label={`Adesão da rotina ${routine.title}`} />

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={`/routines/${routine.id}/edit`}>Editar rotina</Link>
          </Button>
          {state === "ACTIVE" && (
            <EndRoutineButton
              action={endRoutineAction.bind(null, routine.id)}
              routineTitle={routine.title}
            />
          )}
          <ConfirmDeleteButton
            action={deleteRoutineAction.bind(null, routine.id)}
            title="Excluir rotina?"
            description={`“${routine.title}” e todo o seu histórico de registros serão excluídos${routine.pdiAction ? ", e os registros deixam de contar como evidência da ação de PDI" : ""}. Essa ação não pode ser desfeita.`}
            triggerLabel="Excluir rotina"
          />
        </div>
      </div>

      <RoutineCalendar routineId={routine.id} calendar={calendar} range={range} />

      <section aria-labelledby="titulo-historico" className="space-y-4">
        <div className="space-y-1">
          <h2 id="titulo-historico" className="text-xl font-semibold tracking-tight">
            Histórico
          </h2>
          <p className="text-muted-foreground text-sm">
            Dias programados nos últimos {HISTORY_DAYS} dias. Marque ou corrija um dia esquecido.
          </p>
        </div>
        {history.length === 0 ? (
          <p className="text-muted-foreground">
            Nenhum dia programado nos últimos {HISTORY_DAYS} dias.
          </p>
        ) : (
          <ol className="grid gap-3" aria-label="Dias programados">
            {history.map(({ date, log }) => {
              const label = date === today ? `hoje, ${formatLongDate(date)}` : formatLongDate(date);
              return (
                <li key={date} className="bg-card space-y-3 rounded-lg border p-4">
                  <h3 className="font-medium first-letter:uppercase">{label}</h3>
                  <LogControls
                    routineId={routine.id}
                    date={date}
                    log={log}
                    label={label}
                    allowSkip={!routine.timesPerWeek}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </article>
  );
}
