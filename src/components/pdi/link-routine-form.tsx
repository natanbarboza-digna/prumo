"use client";
// Client Component: the field error and the "linking" state live in the browser.

import { FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  type LinkExistingRoutineValues,
  linkExistingRoutineSchema,
} from "@/modules/routines/schemas";

type LinkRoutineFormProps = {
  action: (
    state: FormState<LinkExistingRoutineValues>,
    formData: FormData,
  ) => Promise<FormState<LinkExistingRoutineValues>>;
  routines: { id: string; title: string }[];
};

/** "Vincular rotina existente" on a PDI action (plan 020). */
export function LinkRoutineForm({ action, routines }: LinkRoutineFormProps) {
  const form = useSchemaForm({
    schema: linkExistingRoutineSchema,
    action,
    defaultValues: { routineId: "" },
    fieldOrder: ["routineId"],
  });
  const { errors, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-2">
      <FormErrorMessage message={form.formError} />
      <Field data-invalid={!!errors.routineId}>
        <FieldLabel htmlFor={id("routineId")}>Vincular rotina existente</FieldLabel>
        <div className="flex flex-wrap gap-3">
          {/* No defaultValue from the state: after linking, the routine leaves
              the list and the select goes back to "Escolha…". */}
          <NativeSelect {...fieldProps("routineId")} defaultValue="" className="min-w-0">
            <NativeSelectOption value="">Escolha…</NativeSelectOption>
            {routines.map((routine) => (
              <NativeSelectOption key={routine.id} value={routine.id}>
                {routine.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" disabled={form.pending}>
            {form.pending ? "Vinculando…" : "Vincular"}
          </Button>
        </div>
        <FieldError id={errorId("routineId")}>{errors.routineId?.[0]}</FieldError>
      </Field>
    </form>
  );
}
