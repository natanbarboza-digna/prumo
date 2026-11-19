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
  /** Creating from a PDI action: sent along, never edited in the form. */
  pdiActionId?: string;
  submitLabel: string;
  cancelHref: string;
};

export function RoutineForm({
  action,
  goals,
  defaultValues,
  pdiActionId,
  submitLabel,
  cancelHref,
}: RoutineFormProps) {
  const form = useSchemaForm({
    schema: routineInputSchema,
    action,
    defaultValues,
    fieldOrder: [
      "title",
      "description",
      "frequency",
      "weekdays",
      "timesPerWeek",
      "timeOfDay",
      "startDate",
      "endDate",
      "goalId",
    ],
    readForm: readRoutineForm,
  });
  const { errors, values, fieldProps, id, errorId } = form;
  const checkedDays = toList(values.weekdays);
  const frequency = values.frequency === "WEEKLY" ? "WEEKLY" : "DAYS";

  return (
    // `group` lets the weekdays and the times-per-week field show or hide with
    // CSS alone, from the checked kind below: no React state to keep in sync.
    <form {...form.formProps} className="group space-y-6">
      <FormErrorMessage message={form.formError} />
      {pdiActionId && <input type="hidden" name="pdiActionId" value={pdiActionId} />}
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

        {/* Native radios: React resets the form after a submit, and the key
            remounts the group so a kind sent back after a server error shows. */}
        <FieldSet key={frequency}>
          <FieldLegend variant="label">Como a rotina se repete</FieldLegend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {(
              [
                ["DAYS", "Em dias fixos da semana"],
                ["WEEKLY", "Algumas vezes por semana"],
              ] as const
            ).map(([value, label], index) => (
              <Field key={value} orientation="horizontal">
                <input
                  type="radio"
                  id={index === 0 ? id("frequency") : `${id("frequency")}-${value}`}
                  name="frequency"
                  value={value}
                  defaultChecked={frequency === value}
                  className="accent-primary size-4"
                />
                <FieldLabel
                  htmlFor={index === 0 ? id("frequency") : `${id("frequency")}-${value}`}
                  className="font-normal"
                >
                  {label}
                </FieldLabel>
              </Field>
            ))}
          </div>
          <FieldError id={errorId("frequency")}>{errors.frequency?.[0]}</FieldError>
        </FieldSet>

        <Field
          data-invalid={!!errors.timesPerWeek}
          className="hidden group-has-[input[name=frequency][value=WEEKLY]:checked]:flex"
        >
          <FieldLabel htmlFor={id("timesPerWeek")}>Quantas vezes por semana</FieldLabel>
          <NativeSelect
            key={String(values.timesPerWeek ?? "3")}
            {...fieldProps("timesPerWeek")}
            defaultValue={String(values.timesPerWeek || "3")}
            className="w-40"
          >
            {[1, 2, 3, 4, 5, 6].map((times) => (
              <NativeSelectOption key={times} value={String(times)}>
                {times === 1 ? "1 vez" : `${times} vezes`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>
            Em quaisquer dias, de segunda a domingo. A semana conta quando a meta é cumprida.
          </FieldDescription>
          <FieldError id={errorId("timesPerWeek")}>{errors.timesPerWeek?.[0]}</FieldError>
        </Field>

        {/* A group of checkboxes: the fieldset/legend names the group, and the
            group (not each box) carries the error. Hidden for a weekly goal. */}
        <FieldSet
          className="group-has-[input[name=frequency][value=WEEKLY]:checked]:hidden"
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
