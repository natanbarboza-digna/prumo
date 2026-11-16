"use client";
// Client Component: useId gives the note field a unique id, even when Next keeps
// a hidden copy of this page in the DOM.

import { useId } from "react";

import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clearLogAction, logRoutineAction } from "@/modules/routines/actions";
import { logStatusLabels } from "@/modules/routines/labels";
import type { RoutineLog } from "@/modules/routines/service";

type LogControlsProps = {
  routineId: string;
  date: string;
  log: RoutineLog | null;
  /** What the buttons act on, for screen readers: "Ler" or "segunda-feira, 16 de novembro". */
  label: string;
};

/** Feito / Pular (with an optional note) for a day without a log; Desfazer otherwise. */
export function LogControls({ routineId, date, log, label }: LogControlsProps) {
  const noteId = useId();

  if (log) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <LogStatusBadge status={log.status} />
          <form action={clearLogAction.bind(null, routineId, date)}>
            <SubmitButton size="sm" variant="outline" aria-label={`Desfazer: ${label}`}>
              Desfazer
            </SubmitButton>
          </form>
        </div>
        {log.note && <p className="text-sm break-words whitespace-pre-line">{log.note}</p>}
      </div>
    );
  }

  return (
    // Both buttons submit this form; the one clicked sends its name/value
    // ("status" = DONE or SKIPPED) along with the note.
    <form action={logRoutineAction.bind(null, routineId, date)} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <LogStatusBadge status={null} />
        <SubmitButton size="sm" name="status" value="DONE" aria-label={`Feito: ${label}`}>
          Feito
        </SubmitButton>
        <SubmitButton
          size="sm"
          variant="outline"
          name="status"
          value="SKIPPED"
          aria-label={`Pular: ${label}`}
        >
          Pular
        </SubmitButton>
      </div>
      <details>
        <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 w-fit cursor-pointer rounded-sm text-sm outline-none focus-visible:ring-[3px]">
          Adicionar nota
        </summary>
        <div className="mt-2 space-y-1.5">
          <Label htmlFor={noteId}>Nota (opcional)</Label>
          <Textarea id={noteId} name="note" rows={2} maxLength={500} />
        </div>
      </details>
    </form>
  );
}

export function LogStatusBadge({ status }: { status: RoutineLog["status"] | null }) {
  if (status === null) return <Badge variant="outline">Pendente</Badge>;
  return (
    <Badge variant={status === "DONE" ? "default" : "secondary"}>{logStatusLabels[status]}</Badge>
  );
}
