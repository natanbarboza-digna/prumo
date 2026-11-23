"use client";
// Client Component: the name field of a time category or project, with its errors.

import { FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { timeCategorySchema, timeProjectSchema } from "@/modules/time/schemas";

type NameFormProps = {
  action: (
    state: FormState<{ name: string }>,
    formData: FormData,
  ) => Promise<FormState<{ name: string }>>;
  kind: "category" | "project";
  label: string;
  defaultName?: string;
  submitLabel: string;
};

/** One line: the name and a button (create a category, rename one, rename a project). */
export function NameForm({ action, kind, label, defaultName = "", submitLabel }: NameFormProps) {
  const form = useSchemaForm({
    schema: kind === "category" ? timeCategorySchema : timeProjectSchema,
    action,
    defaultValues: { name: defaultName },
    fieldOrder: ["name"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-1">
      <FormErrorMessage message={form.formError} />
      <div className="flex flex-wrap items-start gap-2">
        <Field data-invalid={!!errors.name} className="min-w-0 flex-1">
          <FieldLabel htmlFor={id("name")} className="sr-only">
            {label}
          </FieldLabel>
          <Input
            {...fieldProps("name")}
            key={values.name}
            defaultValue={values.name}
            maxLength={kind === "category" ? 60 : 80}
            required
          />
          <FieldError id={errorId("name")}>{errors.name?.[0]}</FieldError>
        </Field>
        <Button type="submit" size="sm" variant="outline" disabled={form.pending}>
          {form.pending ? "Salvando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
