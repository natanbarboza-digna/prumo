"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { GoalOption } from "@/modules/goals/options";
import { actionStatusLabels, actionStatusOrder } from "@/modules/pdi/labels";
import { type ActionFormValues, actionInputSchema } from "@/modules/pdi/schemas";

export type Option = { id: string; label: string };

type ActionFormProps = {
  action: (
    state: FormState<ActionFormValues>,
    formData: FormData,
  ) => Promise<FormState<ActionFormValues>>;
  areas: Option[];
  categories: Option[];
  goals: GoalOption[];
  defaultValues: ActionFormValues;
  submitLabel: string;
  cancelHref: string;
};

const longFields = [
  ["description", "Descrição (opcional)", 5000],
  ["expectedResult", "Resultado esperado (opcional)", 2000],
  ["evidence", "Evidência (opcional)", 5000],
  ["managerComment", "Comentário do gestor (opcional)", 5000],
] as const;

export function ActionForm({
  action,
  areas,
  categories,
  goals,
  defaultValues,
  submitLabel,
  cancelHref,
}: ActionFormProps) {
  const form = useSchemaForm({
    schema: actionInputSchema,
    action,
    defaultValues,
    fieldOrder: [
      "title",
      "areaId",
      "categoryId",
      "status",
      "dueDate",
      "description",
      "expectedResult",
      "evidence",
      "managerComment",
      "goalId",
    ],
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
          <Field data-invalid={!!errors.areaId}>
            <FieldLabel htmlFor={id("areaId")}>Área</FieldLabel>
            <NativeSelect {...fieldProps("areaId")} defaultValue={values.areaId} className="w-full">
              <NativeSelectOption value="">Escolha…</NativeSelectOption>
              {areas.map((area) => (
                <NativeSelectOption key={area.id} value={area.id}>
                  {area.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id={errorId("areaId")}>{errors.areaId?.[0]}</FieldError>
          </Field>
          <Field data-invalid={!!errors.categoryId}>
            <FieldLabel htmlFor={id("categoryId")}>Categoria</FieldLabel>
            <NativeSelect
              {...fieldProps("categoryId")}
              defaultValue={values.categoryId}
              className="w-full"
            >
              <NativeSelectOption value="">Escolha…</NativeSelectOption>
              {categories.map((category) => (
                <NativeSelectOption key={category.id} value={category.id}>
                  {category.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id={errorId("categoryId")}>{errors.categoryId?.[0]}</FieldError>
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.status}>
            <FieldLabel htmlFor={id("status")}>Status</FieldLabel>
            <NativeSelect
              {...fieldProps("status")}
              defaultValue={values.status ?? "NOT_STARTED"}
              className="w-full"
            >
              {actionStatusOrder.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {actionStatusLabels[status]}
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

        {longFields.map(([name, label, max]) => (
          <Field key={name} data-invalid={!!errors[name]}>
            <FieldLabel htmlFor={id(name)}>{label}</FieldLabel>
            <Textarea
              {...fieldProps(name)}
              defaultValue={values[name] ?? ""}
              rows={3}
              maxLength={max}
            />
            <FieldError id={errorId(name)}>{errors[name]?.[0]}</FieldError>
          </Field>
        ))}

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
            A ação passa a contar no progresso do objetivo escolhido.
          </FieldDescription>
          <FieldError id={errorId("goalId")}>{errors.goalId?.[0]}</FieldError>
        </Field>
      </FieldGroup>

      <FormActions pending={form.pending} submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
