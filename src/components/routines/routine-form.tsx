"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { GoalOption } from "@/modules/goals/options";
import { weekdayLongLabels } from "@/modules/routines/labels";
import {
  type RoutineFormValues,
  readRoutineForm,
  routineInputSchema,
  weekdayOrder,
} from "@/modules/routines/schemas";

type RoutineFormProps = {
  action: (
    state: FormState<RoutineFormValues>,
    formData: FormData,
  ) => Promise<FormState<RoutineFormValues>>;
  goals: GoalOption[];
  defaultValues: RoutineFormValues;
  submitLabel: string;
  cancelHref: string;
};

export function RoutineForm({
  action,
  goals,
  defaultValues,
  submitLabel,
  cancelHref,
}: RoutineFormProps) {
  const form = useSchemaForm({
    schema: routineInputSchema,
    action,
    defaultValues,
    fieldOrder: ["title", "description", "weekdays", "timeOfDay", "startDate", "endDate", "goalId"],
    readForm: readRoutineForm,
  });
  const { errors, values, fieldProps, id, errorId } = form;
  const checkedDays = toList(values.weekdays);

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
            rows={3}
            maxLength={2000}
          />
          <FieldError id={errorId("description")}>{errors.description?.[0]}</FieldError>
        </Field>

        {/* A group of checkboxes: the fieldset/legend names the group, and the
            group (not each box) carries the error. */}
        <FieldSet
          data-invalid={!!errors.weekdays}
          aria-invalid={!!errors.weekdays}
          aria-describedby={errors.weekdays ? errorId("weekdays") : undefined}
        >
          <FieldLegend variant="label">Dias da semana</FieldLegend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {weekdayOrder.map((day, index) => {
              // The first box gets the field id, so focus can land on the group.
              const boxId = index === 0 ? id("weekdays") : `${id("weekdays")}-${day}`;
              const checked = checkedDays.includes(day);
              return (
                // React resets the form after each submit, and Radix restores
                // the box to its *first* defaultChecked. The key remounts a box
                // whose default changed, so values sent back after a server
                // error are shown.
                <Field key={`${day}-${checked}`} orientation="horizontal">
                  <Checkbox id={boxId} name="weekdays" value={day} defaultChecked={checked} />
                  <FieldLabel htmlFor={boxId} className="font-normal">
                    {weekdayLongLabels[day]}
                  </FieldLabel>
                </Field>
              );
            })}
          </div>
          <FieldError id={errorId("weekdays")}>{errors.weekdays?.[0]}</FieldError>
        </FieldSet>

        <Field data-invalid={!!errors.timeOfDay}>
          <FieldLabel htmlFor={id("timeOfDay")}>Horário (opcional)</FieldLabel>
          <Input
            {...fieldProps("timeOfDay")}
            type="time"
            defaultValue={values.timeOfDay ?? ""}
            className="w-40"
          />
          <FieldDescription>Define a ordem das rotinas na tela Hoje.</FieldDescription>
          <FieldError id={errorId("timeOfDay")}>{errors.timeOfDay?.[0]}</FieldError>
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
            <FieldLabel htmlFor={id("endDate")}>Fim (opcional)</FieldLabel>
            <Input {...fieldProps("endDate")} type="date" defaultValue={values.endDate ?? ""} />
            <FieldError id={errorId("endDate")}>{errors.endDate?.[0]}</FieldError>
          </Field>
        </div>

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
          <FieldError id={errorId("goalId")}>{errors.goalId?.[0]}</FieldError>
        </Field>
      </FieldGroup>

      <FormActions pending={form.pending} submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}

function toList(value: RoutineFormValues["weekdays"]): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
