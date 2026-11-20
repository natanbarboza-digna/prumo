import Link from "next/link";
import type { ReactNode } from "react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { MoveButtons } from "@/components/move-buttons";
import { ActionOverdueBadge, ActionStatusBadge } from "@/components/pdi/pdi-badges";
import { Button } from "@/components/ui/button";
import { formatDateForDisplay } from "@/lib/dates";
import { deleteActionAction, moveActionAction } from "@/modules/pdi/actions";
import { routineEvidenceText } from "@/modules/pdi/labels";
import {
  type PdiAction,
  type RoutineEvidence,
  isActionFinished,
  isActionOverdue,
} from "@/modules/pdi/service";

type ActionListProps<T extends PdiAction> = {
  actions: T[];
  today: string;
  /** False on a closed cycle: no edit or delete buttons. */
  editable: boolean;
  headingLevel: "h3" | "h4";
  /** Hide the goal line when the list is already shown inside that goal. */
  showGoal?: boolean;
  /** Extra line per action, e.g. "PDI 2026 · Comunicação" on a goal page. */
  context?: (action: T) => ReactNode;
  /** Linked routines per action id, for the "Rotina: 80% de adesão" line. */
  evidence?: Record<string, RoutineEvidence>;
  /** Arrows to change the manual order (the cycle page, when editable; plan 021). */
  reorderable?: boolean;
};

// Generic so a list of richer actions (with cycle and area, on a goal page)
// hands that same type to `context`.
export function ActionList<T extends PdiAction>({
  actions,
  today,
  editable,
  headingLevel,
  showGoal = true,
  context,
  evidence = {},
  reorderable = false,
}: ActionListProps<T>) {
  const Heading = headingLevel;
  return (
    <ul className="grid gap-3" aria-label="Ações">
      {actions.map((action, index) => {
        const routines = evidence[action.id];
        // editable already means "the cycle is open"; the rest of the rule is
        // routineBlocker's, checked again by the service on creation.
        const canCreateRoutine =
          editable && action.category.allowsRoutine && !isActionFinished(action.status);
        return (
          <li key={action.id} className="bg-card space-y-2 rounded-lg border p-4">
            <Heading className="font-medium break-words">
              <Link
                href={`/pdi/${action.cycleId}/actions/${action.id}`}
                className="hover:underline"
              >
                {action.title}
              </Link>
            </Heading>
            {context?.(action)}
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <ActionStatusBadge status={action.status} />
              {isActionOverdue(action, today) && <ActionOverdueBadge />}
              <span>{action.category.name}</span>
              {action.dueDate && <span>Prazo: {formatDateForDisplay(action.dueDate)}</span>}
              {showGoal && action.goal && (
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
            {action.expectedResult && (
              <p className="text-sm break-words">
                <span className="text-muted-foreground">Resultado esperado: </span>
                {action.expectedResult}
              </p>
            )}
            {action.evidence && (
              <p className="text-sm break-words whitespace-pre-line">
                <span className="text-muted-foreground">Evidência: </span>
                {action.evidence}
              </p>
            )}
            {routines && <p className="text-sm">{routineEvidenceText(routines)}</p>}
            {action.managerComment && (
              <p className="text-sm break-words whitespace-pre-line">
                <span className="text-muted-foreground">Comentário do gestor: </span>
                {action.managerComment}
              </p>
            )}
            {editable && (
              <div className="flex flex-wrap gap-2 pt-1">
                {reorderable && (
                  <MoveButtons
                    moveUp={moveActionAction.bind(null, action.id, "up")}
                    moveDown={moveActionAction.bind(null, action.id, "down")}
                    label={action.title}
                    isFirst={index === 0}
                    isLast={index === actions.length - 1}
                  />
                )}
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/pdi/${action.cycleId}/actions/${action.id}/edit`}
                    aria-label={`Editar ação: ${action.title}`}
                  >
                    Editar
                  </Link>
                </Button>
                {canCreateRoutine && (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/routines/new?pdiActionId=${action.id}`}
                      aria-label={`Criar rotina para: ${action.title}`}
                    >
                      Criar rotina
                    </Link>
                  </Button>
                )}
                <ConfirmDeleteButton
                  action={deleteActionAction.bind(null, action.id)}
                  title="Excluir ação?"
                  description={`“${action.title}” será excluída${routines ? "; as rotinas vinculadas continuam, sem vínculo" : ""}. Essa ação não pode ser desfeita.`}
                  triggerLabel={`Excluir ação: ${action.title}`}
                  size="sm"
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
