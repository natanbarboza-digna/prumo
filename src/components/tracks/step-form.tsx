"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { trackStepStatusLabels, trackStepStatusOrder } from "@/modules/tracks/labels";
import { type TrackStepFormValues, trackStepInputSchema } from "@/modules/tracks/schemas";

type StepFormProps = {
  action: (
    state: FormState<TrackStepFormValues>,
    formData: FormData,
  ) => Promise<FormState<TrackStepFormValues>>;
  defaultValues?: TrackStepFormValues;
  submitLabel: string;
  cancelHref: string;
};

export function StepForm({ action, defaultValues, submitLabel, cancelHref }: StepFormProps) {
  const form = useSchemaForm({
    schema: trackStepInputSchema,
    action,
    defaultValues: defaultValues ?? { title: "" },
    fieldOrder: ["title", "status", "dueDate", "resourceUrl", "notes"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-6">
      <FormErrorMessage message={form.formError} />
      <FieldGroup>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor={id("title")}>Título</FieldLabel>
          <Input {...fieldProps("title")} defaultValue={values.title} required maxLength={160} />
          <FieldError id={errorId("title")}>{errors.title?.[0]}</FieldError>
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.status}>
            <FieldLabel htmlFor={id("status")}>Status</FieldLabel>
            <NativeSelect
              {...fieldProps("status")}
              defaultValue={values.status ?? "NOT_STARTED"}
              className="w-full"
            >
              {trackStepStatusOrder.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {trackStepStatusLabels[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id={errorId("status")}>{errors.status?.[0]}</FieldError>
          </Field>

          <Field data-invalid={!!errors.dueDate}>
            <FieldLabel htmlFor={id("dueDate")}>Prazo (opcional)</FieldLabel>
            <Input {...fieldProps("dueDate")} type="date" defaultValue={values.dueDate ?? ""} />
            <FieldError id={errorId("dueDate")}>{errors.dueDate?.[0]}</FieldError>
          </Field>
        </div>

        <Field data-invalid={!!errors.resourceUrl}>
          <FieldLabel htmlFor={id("resourceUrl")}>Link do recurso (opcional)</FieldLabel>
          <Input
            {...fieldProps("resourceUrl")}
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={values.resourceUrl ?? ""}
            maxLength={2000}
          />
          <FieldError id={errorId("resourceUrl")}>{errors.resourceUrl?.[0]}</FieldError>
        </Field>

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor={id("notes")}>Anotações (opcional)</FieldLabel>
          <Textarea
            {...fieldProps("notes")}
            defaultValue={values.notes ?? ""}
            rows={4}
            maxLength={5000}
          />
          <FieldError id={errorId("notes")}>{errors.notes?.[0]}</FieldError>
        </Field>
      </FieldGroup>

      <FormActions pending={form.pending} submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
