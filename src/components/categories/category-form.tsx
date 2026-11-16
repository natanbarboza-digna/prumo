"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type CategoryFormValues, categoryInputSchema } from "@/modules/categories/schemas";

type CategoryFormProps = {
  action: (
    state: FormState<CategoryFormValues>,
    formData: FormData,
  ) => Promise<FormState<CategoryFormValues>>;
  defaultValues?: CategoryFormValues;
  submitLabel: string;
};

export function CategoryForm({ action, defaultValues, submitLabel }: CategoryFormProps) {
  const form = useSchemaForm({
    schema: categoryInputSchema,
    action,
    defaultValues: defaultValues ?? { name: "" },
    fieldOrder: ["name", "allowsRoutine"],
  });
  const { errors, values, fieldProps, id, errorId } = form;
  const checked = values.allowsRoutine === true || values.allowsRoutine === "on";

  return (
    <form {...form.formProps} className="space-y-6">
      <FormErrorMessage message={form.formError} />
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor={id("name")}>Nome</FieldLabel>
          <Input {...fieldProps("name")} defaultValue={values.name} required maxLength={60} />
          <FieldError id={errorId("name")}>{errors.name?.[0]}</FieldError>
        </Field>

        {/* The key remounts the box when the value sent back by the server
            differs, since Radix restores its first defaultChecked on reset. */}
        <Field key={String(checked)} orientation="horizontal">
          <Checkbox {...fieldProps("allowsRoutine")} defaultChecked={checked} />
          <FieldContent>
            <FieldLabel htmlFor={id("allowsRoutine")}>Permite criar rotina</FieldLabel>
            <FieldDescription>
              Ações desta categoria poderão gerar uma rotina diária (por exemplo, prática).
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>

      <FormActions
        pending={form.pending}
        submitLabel={submitLabel}
        cancelHref="/settings/categories"
      />
    </form>
  );
}
