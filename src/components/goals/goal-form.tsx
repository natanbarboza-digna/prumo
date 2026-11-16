"use client";
// Client Component: it keeps validation errors and the "saving" state in the
// browser, and validates with the same Zod schema before calling the server.

import Link from "next/link";
import {
  type FormEvent,
  useActionState,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { GoalFormState } from "@/modules/goals/actions";
import { goalStatusLabels, goalStatusOrder } from "@/modules/goals/labels";
import {
  type GoalFieldErrors,
  type GoalFormValues,
  goalInputSchema,
} from "@/modules/goals/schemas";

type GoalFormProps = {
  action: (state: GoalFormState, formData: FormData) => Promise<GoalFormState>;
  defaultValues?: GoalFormValues;
  submitLabel: string;
  cancelHref: string;
};

type FieldName = keyof GoalFormValues;

const FIELD_ORDER: readonly FieldName[] = ["title", "description", "status", "targetDate"];

export function GoalForm({ action, defaultValues, submitLabel, cancelHref }: GoalFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [clientErrors, setClientErrors] = useState<GoalFieldErrors | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  // Next keeps recently visited pages in the DOM (hidden), so the same form can
  // exist twice at once. useId gives each instance unique ids, keeping every
  // <label htmlFor> pointing at its own field.
  const baseId = useId();
  const id = (name: FieldName) => `${baseId}-${name}`;
  const errorId = (name: FieldName) => `${baseId}-${name}-error`;

  const errors = clientErrors ?? state.errors ?? {};
  const values = state.values ?? defaultValues ?? { title: "" };

  // After the server answers with errors, move focus to the first invalid field.
  useEffect(() => {
    if (state.errors) {
      submitted.current = false;
      focusFirstInvalid(formRef.current, state.errors);
    }
  }, [state]);

  // When this page gets hidden after a successful save, clear the form so that
  // coming back to "Novo objetivo" starts fresh. Unsaved drafts are kept.
  useLayoutEffect(() => {
    const form = formRef.current;
    return () => {
      if (submitted.current) {
        submitted.current = false;
        form?.reset();
        setClientErrors(null);
      }
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = goalInputSchema.safeParse(data);
    if (!result.success) {
      // Stop here: the server would reject it anyway, and this is instant.
      event.preventDefault();
      const fieldErrors = z.flattenError(result.error).fieldErrors;
      setClientErrors(fieldErrors);
      focusFirstInvalid(event.currentTarget, fieldErrors);
      return;
    }
    setClientErrors(null);
    submitted.current = true;
  }

  const fieldProps = (name: FieldName) => ({
    id: id(name),
    name,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? errorId(name) : undefined,
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      {state.formError && (
        <p role="alert" className="text-destructive text-sm">
          {state.formError}
        </p>
      )}
      <FieldGroup>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor={id("title")}>Título</FieldLabel>
          <Input {...fieldProps("title")} defaultValue={values.title} required maxLength={120} />
          <FieldError id={errorId("title")}>{errors.title?.[0]}</FieldError>
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor={id("description")}>Descrição (opcional)</FieldLabel>
          <Textarea
            {...fieldProps("description")}
            defaultValue={values.description ?? ""}
            rows={4}
            maxLength={2000}
          />
          <FieldError id={errorId("description")}>{errors.description?.[0]}</FieldError>
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.status}>
            <FieldLabel htmlFor={id("status")}>Status</FieldLabel>
            <NativeSelect
              {...fieldProps("status")}
              defaultValue={values.status ?? "NOT_STARTED"}
              className="w-full"
            >
              {goalStatusOrder.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {goalStatusLabels[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id={errorId("status")}>{errors.status?.[0]}</FieldError>
          </Field>

          <Field data-invalid={!!errors.targetDate}>
            <FieldLabel htmlFor={id("targetDate")}>Data-alvo (opcional)</FieldLabel>
            <Input
              {...fieldProps("targetDate")}
              type="date"
              defaultValue={values.targetDate ?? ""}
            />
            <FieldError id={errorId("targetDate")}>{errors.targetDate?.[0]}</FieldError>
          </Field>
        </div>
      </FieldGroup>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}

function focusFirstInvalid(form: HTMLFormElement | null, errors: GoalFieldErrors) {
  const name = FIELD_ORDER.find((field) => errors[field]?.length);
  if (!form || !name) return;
  const element = form.elements.namedItem(name);
  if (element instanceof HTMLElement) element.focus();
}
