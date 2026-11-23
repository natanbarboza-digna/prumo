"use client";
// Client Component: the result of the last check (problems or preview), the
// "checking" state and the rules remembered in this browser live here.

import { type FormEvent, startTransition, useActionState, useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateForDisplay } from "@/lib/dates";
import { formatTimeOfDay } from "@/lib/time-of-day";
import { type TimeImportState, importTimeAction } from "@/modules/time/import/actions";

const RULES_KEY = "prumo:time-import-rules";

const sourceLabels = {
  text: "Texto",
  categoryRules: "Regras de categoria",
  projectRules: "Regras de projeto",
  form: "Formulário",
} as const;

type TimeImportFormProps = {
  categories: { id: string; name: string }[];
  defaultYear: number;
};

/** "Conferir" then "Confirmar importação" (plan 033), like the PDI import. */
export function TimeImportForm({ categories, defaultYear }: TimeImportFormProps) {
  const [state, action, pending] = useActionState(importTimeAction, {} as TimeImportState);
  const formRef = useRef<HTMLFormElement>(null);
  const previewRef = useRef<HTMLHeadingElement>(null);
  const categoryRulesRef = useRef<HTMLTextAreaElement>(null);
  const projectRulesRef = useRef<HTMLTextAreaElement>(null);
  const base = useId();
  const id = (name: string) => `${base}-${name}`;

  // The rules typed last time, kept in this browser only (plan 033). Storage
  // may be blocked (private window): then the fields just start empty.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RULES_KEY) ?? "null") as {
        categoryRules?: string;
        projectRules?: string;
      } | null;
      // Uncontrolled fields: the saved text goes straight into them, no state.
      if (saved && categoryRulesRef.current && projectRulesRef.current) {
        categoryRulesRef.current.value = saved.categoryRules ?? "";
        projectRulesRef.current.value = saved.projectRules ?? "";
      }
    } catch {
      // Nothing saved, or storage unavailable.
    }
  }, []);

  useEffect(() => {
    if (state.preview) previewRef.current?.focus();
  }, [state.preview]);

  function send(intent: "preview" | "confirm") {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    data.set("intent", intent);
    try {
      localStorage.setItem(
        RULES_KEY,
        JSON.stringify({
          categoryRules: data.get("categoryRules") ?? "",
          projectRules: data.get("projectRules") ?? "",
        }),
      );
    } catch {
      // Storage unavailable: the rules are just not remembered.
    }
    // The form is never submitted natively, so React does not reset it and
    // the text stays there for the confirmation.
    startTransition(() => action(data));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send("preview");
  }

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={id("text")}>Texto do histórico</Label>
          <Textarea
            id={id("text")}
            name="text"
            rows={12}
            required
            className="font-mono text-sm"
            placeholder={"**16/11**\n08:15 - cheguei\n08:30 - olhei a caixa de e-mail\n…"}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-28 space-y-1">
            <Label htmlFor={id("year")}>Ano</Label>
            <Input id={id("year")} name="year" type="number" defaultValue={defaultYear} required />
          </div>
          <div className="w-44 space-y-1">
            <Label htmlFor={id("slotMinutes")}>Duração dos blocos</Label>
            <NativeSelect id={id("slotMinutes")} name="slotMinutes" defaultValue="30">
              <NativeSelectOption value="15">15 minutos</NativeSelectOption>
              <NativeSelectOption value="30">30 minutos</NativeSelectOption>
              <NativeSelectOption value="60">60 minutos</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="w-52 space-y-1">
            <Label htmlFor={id("defaultCategoryId")}>Categoria padrão</Label>
            <NativeSelect
              id={id("defaultCategoryId")}
              name="defaultCategoryId"
              defaultValue=""
              className="w-full"
            >
              <NativeSelectOption value="">Escolha…</NativeSelectOption>
              {categories.map((category) => (
                <NativeSelectOption key={category.id} value={category.id}>
                  {category.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={id("categoryRules")}>Regras de categoria (opcional)</Label>
            <Textarea
              id={id("categoryRules")}
              name="categoryRules"
              rows={5}
              ref={categoryRulesRef}
              className="font-mono text-sm"
              placeholder={"chamado = Chamados\natend = Atendimento\nconfiguração = Projeto"}
              aria-describedby={id("rulesHelp")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={id("projectRules")}>Regras de projeto (opcional)</Label>
            <Textarea
              id={id("projectRules")}
              name="projectRules"
              rows={5}
              ref={projectRulesRef}
              className="font-mono text-sm"
              placeholder={"digna = Digna\nmáxima = Máxima"}
              aria-describedby={id("rulesHelp")}
            />
          </div>
        </div>
        <p id={id("rulesHelp")} className="text-muted-foreground text-sm">
          Uma regra por linha, no formato <code>palavra = Nome</code>. Vale quando o texto contém a
          palavra (sem diferenciar maiúsculas nem acentos); a primeira que serve vence. Sem regra, o
          registro fica com a categoria padrão e sem projeto. As regras ficam guardadas neste
          navegador.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Conferindo…" : "Conferir"}
        </Button>
      </form>

      {state.issues && state.issues.length > 0 && (
        <section role="alert" className="border-destructive/40 space-y-2 rounded-lg border p-4">
          <h2 className="font-semibold">Nada foi importado. Corrija e confira de novo:</h2>
          <ul className="space-y-1 text-sm" aria-label="Problemas na importação">
            {state.issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">
                  {sourceLabels[issue.source]}
                  {issue.line !== null && `, linha ${issue.line}`}:
                </span>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.preview && (
        <section aria-labelledby={id("preview")} className="space-y-4">
          <h2
            id={id("preview")}
            ref={previewRef}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight outline-none"
          >
            Confira antes de importar
          </h2>
          <p role="status">
            Serão criados {state.preview.counts.days}{" "}
            {state.preview.counts.days === 1 ? "dia" : "dias"} e{" "}
            {state.preview.counts.work + state.preview.counts.breaks} registros (
            {state.preview.counts.work} de trabalho e {state.preview.counts.breaks}{" "}
            {state.preview.counts.breaks === 1 ? "pausa" : "pausas"}).
          </p>
          {state.preview.newProjects.length > 0 && (
            <p className="text-sm">Projetos novos: {state.preview.newProjects.join(", ")}.</p>
          )}
          <ul className="grid gap-2" aria-label="Dias do histórico">
            {state.preview.days.map((day) => (
              <li key={day.date} className="rounded-lg border p-3">
                <details>
                  <summary className="cursor-pointer font-medium">
                    {formatDateForDisplay(day.date)} · {formatTimeOfDay(day.startMinute)} a{" "}
                    {formatTimeOfDay(day.endMinute)} · {day.entries.length} registros
                  </summary>
                  <ul className="mt-2 grid gap-1 text-sm">
                    {day.entries.map((entry) => (
                      <li key={entry.startMinute} className="break-words">
                        <span className="text-muted-foreground tabular-nums">
                          {formatTimeOfDay(entry.startMinute)}–
                          {formatTimeOfDay(entry.startMinute + entry.minutes)}
                        </span>{" "}
                        {entry.kind === "BREAK" ? "Pausa" : entry.description}
                        <span className="text-muted-foreground">
                          {entry.categoryName && ` · ${entry.categoryName}`}
                          {entry.projectName && ` · ${entry.projectName}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
          <Button type="button" disabled={pending} onClick={() => send("confirm")}>
            {pending ? "Importando…" : "Confirmar importação"}
          </Button>
        </section>
      )}
    </div>
  );
}
