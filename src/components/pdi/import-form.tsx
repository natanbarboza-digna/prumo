"use client";
// Client Component: useActionState keeps the result of the last upload (the
// problems or the preview), and the chosen file stays in the browser between
// "Conferir planilha" and "Confirmar importação" (plan 022).

import Link from "next/link";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { ImportPreview } from "@/components/pdi/import-preview";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type ImportFormState, importPdiAction } from "@/modules/pdi/import/actions";

const initialState: ImportFormState = {};

export function ImportForm() {
  const [state, action, pending] = useActionState(importPdiAction, initialState);
  // The file sent for the preview, sent again on confirmation. React resets a
  // form after its action runs, so the file input alone would lose it.
  const [file, setFile] = useState<File | null>(null);
  // "Escolher outro arquivo" hides the preview without a server round trip.
  const [dismissed, setDismissed] = useState<ImportFormState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const fileId = useId();
  const errorId = useId();
  const issuesId = useId();

  const preview = state.preview && state !== dismissed ? state.preview : null;
  const issues = state !== dismissed ? state.issues : undefined;

  // Move focus to the preview when it appears, so keyboard and screen reader
  // users land on it instead of on a field that just disappeared.
  useEffect(() => {
    if (preview) previewHeadingRef.current?.focus();
  }, [preview]);

  // Next keeps this page hidden in the DOM after leaving it: start fresh on return.
  useLayoutEffect(
    () => () => {
      formRef.current?.reset();
      setFile(null);
      setDismissed(null);
    },
    [],
  );

  function send(intent: "preview" | "confirm", chosen: File | null) {
    const data = new FormData();
    data.set("intent", intent);
    if (chosen) data.set("file", chosen);
    startTransition(() => action(data));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("file");
    const chosen = value instanceof File && value.size > 0 ? value : null;
    setFile(chosen);
    setDismissed(null);
    send("preview", chosen);
  }

  function chooseAnother() {
    setDismissed(state);
    setFile(null);
    formRef.current?.reset();
    // After React shows the field again.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (preview) {
    return (
      <div className="space-y-6">
        <ImportPreview preview={preview} headingRef={previewHeadingRef} />
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={pending} onClick={() => send("confirm", file)}>
            {pending ? "Importando…" : "Confirmar importação"}
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={chooseAnother}>
            Escolher outro arquivo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-6">
      {/* Without JavaScript the form posts directly, and asks for the preview. */}
      <input type="hidden" name="intent" value="preview" />
      <div className="space-y-2">
        <Label htmlFor={fileId}>Planilha (.xlsx)</Label>
        <input
          ref={inputRef}
          id={fileId}
          name="file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          aria-invalid={state.fileError && state !== dismissed ? true : undefined}
          aria-describedby={state.fileError && state !== dismissed ? errorId : undefined}
          className="border-input file:bg-secondary file:text-secondary-foreground focus-visible:ring-ring/50 block w-full rounded-md border text-sm file:mr-3 file:border-0 file:px-3 file:py-2 file:font-medium focus-visible:ring-[3px] focus-visible:outline-none"
        />
        {state.fileError && state !== dismissed && (
          <p id={errorId} className="text-destructive text-sm">
            {state.fileError}
          </p>
        )}
      </div>

      {issues && issues.length > 0 && (
        <section
          role="alert"
          aria-labelledby={issuesId}
          className="border-destructive/40 space-y-3 rounded-lg border p-4"
        >
          <h2 id={issuesId} className="font-semibold">
            Nada foi importado. Corrija a planilha e envie de novo:
          </h2>
          <ul className="space-y-1 text-sm" aria-label="Problemas na planilha">
            {issues.map((issue, index) => (
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
          {pending ? "Conferindo…" : "Conferir planilha"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/pdi">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
