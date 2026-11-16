"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type AreaFormValues, areaInputSchema } from "@/modules/pdi/schemas";

type AreaFormProps = {
  action: (
    state: FormState<AreaFormValues>,
    formData: FormData,
  ) => Promise<FormState<AreaFormValues>>;
  defaultValues?: AreaFormValues;
  submitLabel: string;
  cancelHref: string;
};

export function AreaForm({ action, defaultValues, submitLabel, cancelHref }: AreaFormProps) {
  const form = useSchemaForm({
    schema: areaInputSchema,
    action,
    defaultValues: defaultValues ?? { name: "" },
    fieldOrder: ["name", "description", "expectedOutcome"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-6">
      <FormErrorMessage message={form.formError} />
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor={id("name")}>Nome da área ou competência</FieldLabel>
          <Input {...fieldProps("name")} defaultValue={values.name} required maxLength={120} />
          <FieldError id={errorId("name")}>{errors.name?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor={id("description")}>Descrição (opcional)</FieldLabel>
          <Textarea
            {...fieldProps("description")}
            defaultValue={values.description ?? ""}
            rows={3}
            maxLength={2000}
          />
          <FieldError id={errorId("description")}>{errors.description?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!errors.expectedOutcome}>
          <FieldLabel htmlFor={id("expectedOutcome")}>Resultado esperado (opcional)</FieldLabel>
          <Textarea
            {...fieldProps("expectedOutcome")}
            defaultValue={values.expectedOutcome ?? ""}
            rows={3}
            maxLength={2000}
          />
          <FieldError id={errorId("expectedOutcome")}>{errors.expectedOutcome?.[0]}</FieldError>
        </Field>
      </FieldGroup>
      <FormActions pending={form.pending} submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
