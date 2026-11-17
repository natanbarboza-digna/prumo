"use client";
// Client Component: useActionState keeps the result of the last upload (the
// list of problems) and tells whether the upload is still running.

import Link from "next/link";
import { useActionState, useId } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type ImportFormState, importPdiAction } from "@/modules/pdi/import/actions";

const initialState: ImportFormState = {};

export function ImportForm() {
  const [state, action, pending] = useActionState(importPdiAction, initialState);
  const fileId = useId();
  const errorId = useId();
  const issuesId = useId();

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor={fileId}>Planilha (.xlsx)</Label>
        <input
          id={fileId}
          name="file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          aria-invalid={state.fileError ? true : undefined}
          aria-describedby={state.fileError ? errorId : undefined}
          className="border-input file:bg-secondary file:text-secondary-foreground focus-visible:ring-ring/50 block w-full rounded-md border text-sm file:mr-3 file:border-0 file:px-3 file:py-2 file:font-medium focus-visible:ring-[3px] focus-visible:outline-none"
        />
        {state.fileError && (
          <p id={errorId} className="text-destructive text-sm">
            {state.fileError}
          </p>
        )}
      </div>

      {state.issues && state.issues.length > 0 && (
        <section
          role="alert"
          aria-labelledby={issuesId}
          className="border-destructive/40 space-y-3 rounded-lg border p-4"
        >
          <h2 id={issuesId} className="font-semibold">
            Nada foi importado. Corrija a planilha e envie de novo:
          </h2>
          <ul className="space-y-1 text-sm" aria-label="Problemas na planilha">
            {state.issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">
                  {[issue.sheet, issue.line !== null ? `linha ${issue.line}` : null, issue.field]
                    .filter(Boolean)
                    .join(", ")}
                  :
                </span>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Importando…" : "Importar"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/pdi">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
