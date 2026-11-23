"use client";
// Client Components: field errors and the "saving" state live in the browser.

import { FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  type DayTimesValues,
  type EndDayValues,
  type StartDayValues,
  dayTimesSchema,
  endDaySchema,
  startDaySchema,
} from "@/modules/time/schemas";

type Action<Values> = (state: FormState<Values>, formData: FormData) => Promise<FormState<Values>>;

/** "Começar o dia": start time, block size and, for a past day, the end. */
export function StartDayForm({
  action,
  defaultStart,
  askEnd,
}: {
  action: Action<StartDayValues>;
  defaultStart: string;
  /** A past day: the end is asked too, so the grid does not run to midnight. */
  askEnd: boolean;
}) {
  const form = useSchemaForm({
    schema: startDaySchema,
    action,
    defaultValues: { startTime: defaultStart, slotMinutes: "30", endTime: "" },
    fieldOrder: ["startTime", "slotMinutes", "endTime"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-4">
      <FormErrorMessage message={form.formError} />
      <div className="flex flex-wrap items-start gap-4">
        <Field data-invalid={!!errors.startTime} className="w-36">
          <FieldLabel htmlFor={id("startTime")}>Entrada</FieldLabel>
          <Input
            {...fieldProps("startTime")}
            type="time"
            defaultValue={values.startTime}
            required
          />
          <FieldError id={errorId("startTime")}>{errors.startTime?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!errors.slotMinutes} className="w-44">
          <FieldLabel htmlFor={id("slotMinutes")}>Duração dos blocos</FieldLabel>
          <NativeSelect {...fieldProps("slotMinutes")} defaultValue={values.slotMinutes}>
            <NativeSelectOption value="15">15 minutos</NativeSelectOption>
            <NativeSelectOption value="30">30 minutos</NativeSelectOption>
            <NativeSelectOption value="60">60 minutos</NativeSelectOption>
          </NativeSelect>
          <FieldError id={errorId("slotMinutes")}>{errors.slotMinutes?.[0]}</FieldError>
        </Field>
        {askEnd && (
          <Field data-invalid={!!errors.endTime} className="w-36">
            <FieldLabel htmlFor={id("endTime")}>Saída</FieldLabel>
            <Input {...fieldProps("endTime")} type="time" defaultValue={values.endTime ?? ""} />
            <FieldError id={errorId("endTime")}>{errors.endTime?.[0]}</FieldError>
          </Field>
        )}
      </div>
      <Button type="submit" disabled={form.pending}>
        {form.pending ? "Começando…" : "Começar o dia"}
      </Button>
    </form>
  );
}

/** "Encerrar o dia" with the end time (the current time by default). */
export function EndDayForm({
  action,
  defaultEnd,
}: {
  action: Action<EndDayValues>;
  defaultEnd: string;
}) {
  const form = useSchemaForm({
    schema: endDaySchema,
    action,
    defaultValues: { endTime: defaultEnd },
    fieldOrder: ["endTime"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="flex flex-wrap items-end gap-3">
      <Field data-invalid={!!errors.endTime} className="w-36">
        <FieldLabel htmlFor={id("endTime")}>Saída</FieldLabel>
        <Input {...fieldProps("endTime")} type="time" defaultValue={values.endTime} required />
      </Field>
      <Button type="submit" variant="outline" disabled={form.pending}>
        {form.pending ? "Encerrando…" : "Encerrar o dia"}
      </Button>
      <FieldError id={errorId("endTime")} className="basis-full">
        {errors.endTime?.[0]}
      </FieldError>
      <div className="basis-full">
        <FormErrorMessage message={form.formError} />
      </div>
    </form>
  );
}

/** Correcting the start and end of the day (an empty end opens the day again). */
export function DayTimesForm({
  action,
  startTime,
  endTime,
}: {
  action: Action<DayTimesValues>;
  startTime: string;
  endTime: string | null;
}) {
  const form = useSchemaForm({
    schema: dayTimesSchema,
    action,
    defaultValues: { startTime, endTime: endTime ?? "" },
    fieldOrder: ["startTime", "endTime"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-3">
      <FormErrorMessage message={form.formError} />
      <div className="flex flex-wrap items-start gap-4">
        <Field data-invalid={!!errors.startTime} className="w-36">
          <FieldLabel htmlFor={id("startTime")}>Entrada</FieldLabel>
          <Input
            {...fieldProps("startTime")}
            type="time"
            defaultValue={values.startTime}
            required
          />
          <FieldError id={errorId("startTime")}>{errors.startTime?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!errors.endTime} className="w-36">
          <FieldLabel htmlFor={id("endTime")}>Saída</FieldLabel>
          <Input {...fieldProps("endTime")} type="time" defaultValue={values.endTime ?? ""} />
          <FieldError id={errorId("endTime")}>{errors.endTime?.[0]}</FieldError>
        </Field>
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={form.pending}>
        {form.pending ? "Salvando…" : "Salvar horários"}
      </Button>
    </form>
  );
}
