"use client";
// Client Component: one block's form keeps its own errors and "saving" state.

import { FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { type EntryValues, entrySchema } from "@/modules/time/schemas";

type EntryFormProps = {
  action: (state: FormState<EntryValues>, formData: FormData) => Promise<FormState<EntryValues>>;
  /** "08:30–09:00", used in the labels so each field names its block. */
  blockLabel: string;
  defaultValues: { description: string; categoryId: string; projectName: string };
  categories: { id: string; name: string }[];
  /** Ids of the page's <datalist>s with the texts and projects already used. */
  descriptionListId: string;
  projectListId: string;
};

/** Work in a block: what was done, a category and an optional project. */
export function EntryForm({
  action,
  blockLabel,
  defaultValues,
  categories,
  descriptionListId,
  projectListId,
}: EntryFormProps) {
  const form = useSchemaForm({
    schema: entrySchema,
    action,
    defaultValues: { kind: "WORK", ...defaultValues },
    fieldOrder: ["description", "categoryId", "projectName"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-2">
      <input type="hidden" name="kind" value="WORK" />
      <FormErrorMessage message={form.formError} />
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-start">
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor={id("description")} className="sr-only">
            O que foi feito ({blockLabel})
          </FieldLabel>
          <Input
            {...fieldProps("description")}
            defaultValue={values.description ?? ""}
            list={descriptionListId}
            placeholder="O que foi feito"
            maxLength={300}
            autoComplete="off"
          />
          <FieldError id={errorId("description")}>{errors.description?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!errors.categoryId}>
          <FieldLabel htmlFor={id("categoryId")} className="sr-only">
            Categoria ({blockLabel})
          </FieldLabel>
          <NativeSelect
            {...fieldProps("categoryId")}
            defaultValue={values.categoryId ?? ""}
            className="w-full"
          >
            <NativeSelectOption value="">Categoria…</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError id={errorId("categoryId")}>{errors.categoryId?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!errors.projectName}>
          <FieldLabel htmlFor={id("projectName")} className="sr-only">
            Projeto ou cliente ({blockLabel})
          </FieldLabel>
          <Input
            {...fieldProps("projectName")}
            defaultValue={values.projectName ?? ""}
            list={projectListId}
            placeholder="Projeto (opcional)"
            maxLength={80}
            autoComplete="off"
          />
          <FieldError id={errorId("projectName")}>{errors.projectName?.[0]}</FieldError>
        </Field>
        <Button type="submit" size="sm" disabled={form.pending} aria-label={`Salvar ${blockLabel}`}>
          {form.pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
