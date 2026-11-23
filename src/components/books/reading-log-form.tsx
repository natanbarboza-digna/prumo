"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { useMemo } from "react";

import { FormErrorMessage } from "@/components/forms/form-actions";
import { useSchemaForm } from "@/components/forms/use-schema-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { BookLogFormState } from "@/modules/books/actions";
import { positionLabels } from "@/modules/books/labels";
import type { ProgressUnit } from "@/modules/books/rules";
import { type BookLogFormValues, bookLogSchema } from "@/modules/books/schemas";

type ReadingLogFormProps = {
  action: (state: BookLogFormState, formData: FormData) => Promise<BookLogFormState>;
  unit: ProgressUnit;
  today: string;
};

/** "Onde parei" on a day (plan 036); the same day again replaces its log. */
export function ReadingLogForm({ action, unit, today }: ReadingLogFormProps) {
  const schema = useMemo(() => bookLogSchema(unit), [unit]);
  const form = useSchemaForm<BookLogFormValues>({
    schema,
    action,
    defaultValues: { date: today, position: "" },
    fieldOrder: ["date", "position"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-3">
      <FormErrorMessage message={form.formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.date}>
          <FieldLabel htmlFor={id("date")}>Data</FieldLabel>
          <Input {...fieldProps("date")} type="date" defaultValue={values.date} max={today} />
          <FieldError id={errorId("date")}>{errors.date?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!errors.position}>
          <FieldLabel htmlFor={id("position")}>{positionLabels[unit]}</FieldLabel>
          <Input
            {...fieldProps("position")}
            defaultValue={values.position}
            inputMode={unit === "MINUTE" ? "text" : "numeric"}
            placeholder={unit === "MINUTE" ? "03:20" : undefined}
          />
          <FieldError id={errorId("position")}>{errors.position?.[0]}</FieldError>
        </Field>
      </div>
      <SubmitButton pendingContent="Registrando…">Registrar leitura</SubmitButton>
    </form>
  );
}
