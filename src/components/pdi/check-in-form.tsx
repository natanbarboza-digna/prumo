"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type CheckInFormValues, checkInInputSchema } from "@/modules/pdi/schemas";

type CheckInFormProps = {
  action: (
    state: FormState<CheckInFormValues>,
    formData: FormData,
  ) => Promise<FormState<CheckInFormValues>>;
  defaultValues: CheckInFormValues;
  submitLabel: string;
  cancelHref: string;
};

const longFields = [
  ["summary", "Resumo"],
  ["nextSteps", "Próximos passos (opcional)"],
  ["managerNotes", "Anotações do gestor (opcional)"],
] as const;

export function CheckInForm({ action, defaultValues, submitLabel, cancelHref }: CheckInFormProps) {
  const form = useSchemaForm({
    schema: checkInInputSchema,
    action,
    defaultValues,
    fieldOrder: ["date", "summary", "nextSteps", "managerNotes"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-6">
      <FormErrorMessage message={form.formError} />
      <FieldGroup>
        <Field data-invalid={!!errors.date}>
          <FieldLabel htmlFor={id("date")}>Data</FieldLabel>
          <Input
            {...fieldProps("date")}
            type="date"
            defaultValue={values.date}
            required
            className="w-48"
          />
          <FieldError id={errorId("date")}>{errors.date?.[0]}</FieldError>
        </Field>
        {longFields.map(([name, label]) => (
          <Field key={name} data-invalid={!!errors[name]}>
            <FieldLabel htmlFor={id(name)}>{label}</FieldLabel>
            <Textarea
              {...fieldProps(name)}
              defaultValue={values[name] ?? ""}
              rows={4}
              maxLength={5000}
              required={name === "summary"}
            />
            <FieldError id={errorId(name)}>{errors[name]?.[0]}</FieldError>
          </Field>
        ))}
      </FieldGroup>
      <FormActions pending={form.pending} submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
