"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type TrackFormValues, trackInputSchema } from "@/modules/tracks/schemas";

export type GoalOption = { id: string; title: string };

type TrackFormProps = {
  action: (
    state: FormState<TrackFormValues>,
    formData: FormData,
  ) => Promise<FormState<TrackFormValues>>;
  goals: GoalOption[];
  defaultValues?: TrackFormValues;
  submitLabel: string;
  cancelHref: string;
};

export function TrackForm({
  action,
  goals,
  defaultValues,
  submitLabel,
  cancelHref,
}: TrackFormProps) {
  const form = useSchemaForm({
    schema: trackInputSchema,
    action,
    defaultValues: defaultValues ?? { title: "" },
    fieldOrder: ["title", "description", "goalId"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-6">
      <FormErrorMessage message={form.formError} />
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

        <Field data-invalid={!!errors.goalId}>
          <FieldLabel htmlFor={id("goalId")}>Objetivo (opcional)</FieldLabel>
          <NativeSelect
            {...fieldProps("goalId")}
            defaultValue={values.goalId ?? ""}
            className="w-full"
          >
            <NativeSelectOption value="">Nenhum</NativeSelectOption>
            {goals.map((goal) => (
              <NativeSelectOption key={goal.id} value={goal.id}>
                {goal.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>
            O progresso das etapas desta trilha aparece no objetivo escolhido.
          </FieldDescription>
          <FieldError id={errorId("goalId")}>{errors.goalId?.[0]}</FieldError>
        </Field>
      </FieldGroup>

      <FormActions pending={form.pending} submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
