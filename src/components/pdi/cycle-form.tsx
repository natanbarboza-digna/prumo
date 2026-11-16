"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type CycleFormValues, cycleInputSchema } from "@/modules/pdi/schemas";

type CycleFormProps = {
  action: (
    state: FormState<CycleFormValues>,
    formData: FormData,
  ) => Promise<FormState<CycleFormValues>>;
  defaultValues: CycleFormValues;
  submitLabel: string;
  cancelHref: string;
};

const longFields = [
  ["careerObjective", "Objetivo de carreira (opcional)", 5000],
  ["selfAssessment", "Autoavaliação (opcional)", 10000],
  ["managerFeedback", "Feedback do gestor (opcional)", 10000],
] as const;

export function CycleForm({ action, defaultValues, submitLabel, cancelHref }: CycleFormProps) {
  const form = useSchemaForm({
    schema: cycleInputSchema,
    action,
    defaultValues,
    fieldOrder: [
      "title",
      "startDate",
      "endDate",
      "status",
      "managerName",
      "careerObjective",
      "selfAssessment",
      "managerFeedback",
      "finalRating",
    ],
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

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.startDate}>
            <FieldLabel htmlFor={id("startDate")}>Início</FieldLabel>
            <Input
              {...fieldProps("startDate")}
              type="date"
              defaultValue={values.startDate}
              required
            />
            <FieldError id={errorId("startDate")}>{errors.startDate?.[0]}</FieldError>
          </Field>
          <Field data-invalid={!!errors.endDate}>
            <FieldLabel htmlFor={id("endDate")}>Fim</FieldLabel>
            <Input {...fieldProps("endDate")} type="date" defaultValue={values.endDate} required />
            <FieldError id={errorId("endDate")}>{errors.endDate?.[0]}</FieldError>
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.status}>
            <FieldLabel htmlFor={id("status")}>Status</FieldLabel>
            <NativeSelect
              {...fieldProps("status")}
              defaultValue={values.status ?? "PLANNED"}
              className="w-full"
            >
              <NativeSelectOption value="PLANNED">Planejado</NativeSelectOption>
              <NativeSelectOption value="ACTIVE">Ativo</NativeSelectOption>
            </NativeSelect>
            <FieldDescription>Para encerrar, use o botão no ciclo.</FieldDescription>
            <FieldError id={errorId("status")}>{errors.status?.[0]}</FieldError>
          </Field>
          <Field data-invalid={!!errors.managerName}>
            <FieldLabel htmlFor={id("managerName")}>Gestor (opcional)</FieldLabel>
            <Input
              {...fieldProps("managerName")}
              defaultValue={values.managerName ?? ""}
              maxLength={120}
            />
            <FieldError id={errorId("managerName")}>{errors.managerName?.[0]}</FieldError>
          </Field>
        </div>

        {longFields.map(([name, label, max]) => (
          <Field key={name} data-invalid={!!errors[name]}>
            <FieldLabel htmlFor={id(name)}>{label}</FieldLabel>
            <Textarea
              {...fieldProps(name)}
              defaultValue={values[name] ?? ""}
              rows={4}
              maxLength={max}
            />
            <FieldError id={errorId(name)}>{errors[name]?.[0]}</FieldError>
          </Field>
        ))}

        <Field data-invalid={!!errors.finalRating}>
          <FieldLabel htmlFor={id("finalRating")}>Avaliação final (opcional)</FieldLabel>
          <Input
            {...fieldProps("finalRating")}
            defaultValue={values.finalRating ?? ""}
            maxLength={60}
          />
          <FieldDescription>Ex.: “Atende plenamente”.</FieldDescription>
          <FieldError id={errorId("finalRating")}>{errors.finalRating?.[0]}</FieldError>
        </Field>
      </FieldGroup>

      <FormActions pending={form.pending} submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
