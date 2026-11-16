import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SubmitButton } from "@/components/submit-button";
import { StepOverdueBadge, StepStatusBadge } from "@/components/tracks/track-badges";
import { Button } from "@/components/ui/button";
import { formatDateForDisplay } from "@/lib/dates";
import { deleteStepAction, moveStepAction, setStepStatusAction } from "@/modules/tracks/actions";
import { type TrackStep, isStepOverdue } from "@/modules/tracks/service";

type StepListProps = {
  trackId: string;
  steps: TrackStep[];
  today: string;
};

// Server Component: each button is a tiny <form> whose action is a Server
// Action with its arguments bound, so it works even before JavaScript loads.
export function StepList({ trackId, steps, today }: StepListProps) {
  if (steps.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhuma etapa ainda. Adicione a primeira para começar a acompanhar o progresso.
      </p>
    );
  }

  return (
    <ol className="grid gap-3" aria-label="Etapas">
      {steps.map((step, index) => {
        const isFirst = index === 0;
        const isLast = index === steps.length - 1;
        const done = step.status === "DONE";
        return (
          <li key={step.id} className="bg-card space-y-3 rounded-lg border p-4">
            <div className="space-y-2">
              <h3 className="font-medium break-words">
                <span className="text-muted-foreground mr-2">{step.order}.</span>
                {step.title}
              </h3>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                <StepStatusBadge status={step.status} />
                {isStepOverdue(step, today) && <StepOverdueBadge />}
                {step.dueDate && <span>Prazo: {formatDateForDisplay(step.dueDate)}</span>}
              </div>
              {step.resourceUrl && (
                <a
                  href={step.resourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-sm break-all underline underline-offset-4"
                >
                  {step.resourceUrl}
                  <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              )}
              {step.notes && (
                <p className="text-sm whitespace-pre-line break-words">{step.notes}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form action={setStepStatusAction.bind(null, step.id, done ? "NOT_STARTED" : "DONE")}>
                <SubmitButton
                  size="sm"
                  variant={done ? "outline" : "default"}
                  aria-label={`${done ? "Reabrir" : "Concluir"}: ${step.title}`}
                >
                  {done ? "Reabrir" : "Concluir"}
                </SubmitButton>
              </form>
              <form action={moveStepAction.bind(null, step.id, "up")}>
                <SubmitButton
                  size="icon-sm"
                  variant="outline"
                  disabled={isFirst}
                  aria-label={`Mover para cima: ${step.title}`}
                >
                  <ArrowUp aria-hidden="true" />
                </SubmitButton>
              </form>
              <form action={moveStepAction.bind(null, step.id, "down")}>
                <SubmitButton
                  size="icon-sm"
                  variant="outline"
                  disabled={isLast}
                  aria-label={`Mover para baixo: ${step.title}`}
                >
                  <ArrowDown aria-hidden="true" />
                </SubmitButton>
              </form>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/tracks/${trackId}/steps/${step.id}/edit`}
                  aria-label={`Editar: ${step.title}`}
                >
                  Editar
                </Link>
              </Button>
              <ConfirmDeleteButton
                size="sm"
                action={deleteStepAction.bind(null, step.id)}
                title="Excluir etapa?"
                description={`“${step.title}” será excluída. Essa ação não pode ser desfeita.`}
                triggerLabel={`Excluir: ${step.title}`}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
