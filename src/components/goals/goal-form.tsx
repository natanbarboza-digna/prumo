"use client";
// Client Component: it keeps validation errors and the "saving" state in the
// browser, and validates with the same Zod schema before calling the server.

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { goalStatusLabels, goalStatusOrder } from "@/modules/goals/labels";
import { type GoalFormValues, goalInputSchema } from "@/modules/goals/schemas";

type GoalFormProps = {
  action: (
    state: FormState<GoalFormValues>,
    formData: FormData,
  ) => Promise<FormState<GoalFormValues>>;
  defaultValues?: GoalFormValues;
  submitLabel: string;
  cancelHref: string;
};

export function GoalForm({ action, defaultValues, submitLabel, cancelHref }: GoalFormProps) {
  const form = useSchemaForm({
    schema: goalInputSchema,
    action,
    defaultValues: defaultValues ?? { title: "" },
    fieldOrder: ["title", "description", "status", "targetDate"],
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

      <FormActions pending={form.pending} submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
