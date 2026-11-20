import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ActionEvidence } from "@/components/pdi/action-evidence";
import { LinkRoutineForm } from "@/components/pdi/link-routine-form";
import { ActionOverdueBadge, ActionStatusBadge } from "@/components/pdi/pdi-badges";
import { Button } from "@/components/ui/button";
import { formatDateForDisplay, todayInAppTimeZone } from "@/lib/dates";
import { routineBlockerText } from "@/modules/pdi/labels";
import { isActionOverdue, routineBlocker } from "@/modules/pdi/service";
import { linkRoutineAction } from "@/modules/routines/actions";
import { listLinkableRoutines } from "@/modules/routines/service";

import { loadActionDetail } from "../../load";

export const metadata: Metadata = { title: "Ação de PDI" };

function Text({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="break-words whitespace-pre-line">{value}</dd>
    </div>
  );
}

export default async function ActionPage({ params }: PageProps<"/pdi/[id]/actions/[actionId]">) {
  const { id, actionId } = await params;
  // "Today" is read before any database access, so tell Next this page renders
  // per request (otherwise it would try to prerender it with a frozen clock).
  await connection();
  const today = todayInAppTimeZone();
  const detail = await loadActionDetail(id, actionId, today);
  const { action, cycle } = detail;
  const editable = cycle.status !== "CLOSED";
  const blocker = routineBlocker(action, cycle.status);
  // Only looked up when the action takes routines: otherwise the form is hidden.
  const linkable = blocker === null ? await listLinkableRoutines(today) : [];

  return (
    <article className="max-w-3xl space-y-8">
      <div className="space-y-4">
        <Link href={`/pdi/${cycle.id}`} className="text-muted-foreground text-sm hover:underline">
          ← {cycle.title}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight break-words">{action.title}</h1>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <ActionStatusBadge status={action.status} />
          {isActionOverdue(action, today) && <ActionOverdueBadge />}
          <span>{action.category.name}</span>
          <span>Área: {detail.areaName}</span>
          {action.dueDate && <span>Prazo: {formatDateForDisplay(action.dueDate)}</span>}
          {action.goal && (
            <span>
              Objetivo:{" "}
              <Link
                href={`/goals/${action.goal.id}`}
                className="underline-offset-4 hover:underline"
              >
                {action.goal.title}
              </Link>
            </span>
          )}
        </div>
        {!editable && (
          <p role="note" className="bg-muted rounded-md p-3 text-sm">
            Ciclo encerrado: somente leitura. Reabra o ciclo para fazer alterações.
          </p>
        )}
        {editable && (
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={`/pdi/${cycle.id}/actions/${action.id}/edit`}>Editar ação</Link>
            </Button>
            {blocker === null && (
              <Button asChild>
                <Link href={`/routines/new?pdiActionId=${action.id}`}>Criar rotina</Link>
              </Button>
            )}
          </div>
        )}
        {linkable.length > 0 && (
          <LinkRoutineForm
            action={linkRoutineAction.bind(null, action.id)}
            routines={linkable.map(({ id, title }) => ({ id, title }))}
          />
        )}
        <dl className="space-y-4">
          <Text label="Descrição" value={action.description} />
          <Text label="Resultado esperado" value={action.expectedResult} />
          <Text label="Evidência" value={action.evidence} />
          <Text label="Comentário do gestor" value={action.managerComment} />
        </dl>
      </div>

      <ActionEvidence
        detail={detail}
        today={today}
        canUnlink={editable}
        emptyText={
          blocker === null
            ? "Nenhuma rotina vinculada. Use “Criar rotina” para praticar esta ação no dia a dia."
            : `Nenhuma rotina vinculada. ${routineBlockerText[blocker]}`
        }
      />
    </article>
  );
}
