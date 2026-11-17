import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ActionList } from "@/components/pdi/action-list";
import { ActionProgressBar } from "@/components/pdi/action-progress";
import { CycleStatusBadge } from "@/components/pdi/pdi-badges";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { formatDateForDisplay, todayInAppTimeZone } from "@/lib/dates";
import {
  closeCycleAction,
  deleteAreaAction,
  deleteCheckInAction,
  deleteCycleAction,
  reopenCycleAction,
} from "@/modules/pdi/actions";
import { getActiveCycleId, getRoutineEvidenceByAction } from "@/modules/pdi/service";

import { loadCycle } from "./load";

export const metadata: Metadata = { title: "Ciclo de PDI" };

function Text({ value, empty }: { value: string | null; empty: string }) {
  return value ? (
    <p className="break-words whitespace-pre-line">{value}</p>
  ) : (
    <p className="text-muted-foreground">{empty}</p>
  );
}

export default async function CyclePage({ params }: PageProps<"/pdi/[id]">) {
  const cycle = await loadCycle((await params).id);
  const today = todayInAppTimeZone();
  const [activeCycleId, evidence] = await Promise.all([
    getActiveCycleId(),
    getRoutineEvidenceByAction(cycle.id, today),
  ]);
  const editable = cycle.status !== "CLOSED";

  return (
    <article className="max-w-3xl space-y-8">
      <div className="space-y-4">
        <Link href="/pdi" className="text-muted-foreground text-sm hover:underline">
          ← PDI
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight break-words">{cycle.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <CycleStatusBadge status={cycle.status} />
          <span>
            {formatDateForDisplay(cycle.startDate)} a {formatDateForDisplay(cycle.endDate)}
          </span>
          {cycle.managerName && <span>Gestor: {cycle.managerName}</span>}
        </div>
        {!editable && (
          <p role="note" className="bg-muted rounded-md p-3 text-sm">
            Ciclo encerrado: somente leitura. Reabra o ciclo para fazer alterações.
          </p>
        )}
        <ActionProgressBar
          done={cycle.progress.done}
          total={cycle.progress.total}
          label={`Progresso do ciclo ${cycle.title}`}
        />
        <div className="flex flex-wrap gap-3">
          {editable ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/pdi/${cycle.id}/edit`}>Editar ciclo</Link>
              </Button>
              <ConfirmActionButton
                action={closeCycleAction.bind(null, cycle.id)}
                triggerLabel="Encerrar ciclo"
                title="Encerrar ciclo?"
                description={`“${cycle.title}” ficará somente leitura: áreas, ações e check-ins não poderão ser alterados até você reabri-lo.`}
                confirmLabel="Encerrar"
                pendingLabel="Encerrando…"
              />
              <ConfirmDeleteButton
                action={deleteCycleAction.bind(null, cycle.id)}
                title="Excluir ciclo?"
                description={`“${cycle.title}” será excluído junto com todas as áreas, ações e check-ins. Essa ação não pode ser desfeita.`}
                triggerLabel="Excluir ciclo"
              />
            </>
          ) : activeCycleId === null ? (
            <form action={reopenCycleAction.bind(null, cycle.id)}>
              <SubmitButton variant="outline" pendingContent="Reabrindo…">
                Reabrir ciclo
              </SubmitButton>
            </form>
          ) : (
            <p className="text-muted-foreground text-sm">
              Para reabrir este ciclo, encerre antes o{" "}
              <Link href={`/pdi/${activeCycleId}`} className="underline underline-offset-4">
                ciclo ativo
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="titulo-objetivo-carreira" className="space-y-2">
        <h2 id="titulo-objetivo-carreira" className="text-xl font-semibold tracking-tight">
          Objetivo de carreira
        </h2>
        <Text value={cycle.careerObjective} empty="Não informado." />
      </section>

      <section aria-labelledby="titulo-areas" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="titulo-areas" className="text-xl font-semibold tracking-tight">
            Áreas de desenvolvimento
          </h2>
          {editable && (
            <Button asChild>
              <Link href={`/pdi/${cycle.id}/areas/new`}>Adicionar área</Link>
            </Button>
          )}
        </div>
        {cycle.areas.length === 0 ? (
          <p className="text-muted-foreground">
            Nenhuma área ainda.{editable && " Adicione uma área para cadastrar as ações."}
          </p>
        ) : (
          <ul className="grid gap-6" aria-label="Áreas">
            {cycle.areas.map((area) => (
              <li key={area.id} className="space-y-3 rounded-lg border p-4">
                <h3 className="text-lg font-medium break-words">{area.name}</h3>
                {area.description && (
                  <p className="text-sm break-words whitespace-pre-line">{area.description}</p>
                )}
                {area.expectedOutcome && (
                  <p className="text-sm break-words">
                    <span className="text-muted-foreground">Resultado esperado: </span>
                    {area.expectedOutcome}
                  </p>
                )}
                {editable && (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link
                        href={`/pdi/${cycle.id}/actions/new?areaId=${area.id}`}
                        aria-label={`Adicionar ação em ${area.name}`}
                      >
                        Adicionar ação
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/pdi/${cycle.id}/areas/${area.id}/edit`}
                        aria-label={`Editar área: ${area.name}`}
                      >
                        Editar área
                      </Link>
                    </Button>
                    <ConfirmDeleteButton
                      action={deleteAreaAction.bind(null, area.id)}
                      title="Excluir área?"
                      description={`“${area.name}” e todas as suas ações serão excluídas. Essa ação não pode ser desfeita.`}
                      triggerLabel={`Excluir área: ${area.name}`}
                      size="sm"
                    />
                  </div>
                )}
                {area.actions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma ação nesta área.</p>
                ) : (
                  <ActionList
                    actions={area.actions}
                    today={today}
                    editable={editable}
                    headingLevel="h4"
                    evidence={evidence}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-check-ins" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="titulo-check-ins" className="text-xl font-semibold tracking-tight">
            Check-ins
          </h2>
          {editable && (
            <Button asChild variant="outline">
              <Link href={`/pdi/${cycle.id}/check-ins/new`}>Registrar check-in</Link>
            </Button>
          )}
        </div>
        {cycle.checkIns.length === 0 ? (
          <p className="text-muted-foreground">Nenhum check-in registrado.</p>
        ) : (
          <ol className="grid gap-3" aria-label="Check-ins">
            {cycle.checkIns.map((checkIn) => {
              const date = formatDateForDisplay(checkIn.date);
              return (
                <li key={checkIn.id} className="bg-card space-y-2 rounded-lg border p-4">
                  <h3 className="font-medium">{date}</h3>
                  <p className="break-words whitespace-pre-line">{checkIn.summary}</p>
                  {checkIn.nextSteps && (
                    <p className="text-sm break-words whitespace-pre-line">
                      <span className="text-muted-foreground">Próximos passos: </span>
                      {checkIn.nextSteps}
                    </p>
                  )}
                  {checkIn.managerNotes && (
                    <p className="text-sm break-words whitespace-pre-line">
                      <span className="text-muted-foreground">Anotações do gestor: </span>
                      {checkIn.managerNotes}
                    </p>
                  )}
                  {editable && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/pdi/${cycle.id}/check-ins/${checkIn.id}/edit`}
                          aria-label={`Editar check-in de ${date}`}
                        >
                          Editar
                        </Link>
                      </Button>
                      <ConfirmDeleteButton
                        action={deleteCheckInAction.bind(null, checkIn.id)}
                        title="Excluir check-in?"
                        description={`O check-in de ${date} será excluído. Essa ação não pode ser desfeita.`}
                        triggerLabel={`Excluir check-in de ${date}`}
                        size="sm"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="titulo-avaliacao" className="space-y-4">
        <h2 id="titulo-avaliacao" className="text-xl font-semibold tracking-tight">
          Avaliação
        </h2>
        <dl className="space-y-4">
          <div className="space-y-1">
            <dt className="text-muted-foreground text-sm">Autoavaliação</dt>
            <dd>
              <Text value={cycle.selfAssessment} empty="Não preenchida." />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-sm">Feedback do gestor</dt>
            <dd>
              <Text value={cycle.managerFeedback} empty="Não preenchido." />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-sm">Avaliação final</dt>
            <dd>
              <Text value={cycle.finalRating} empty="Não preenchida." />
            </dd>
          </div>
        </dl>
      </section>
    </article>
  );
}
