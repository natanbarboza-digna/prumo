"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { FormErrorMessage } from "@/components/forms/form-actions";
import { useSchemaForm } from "@/components/forms/use-schema-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ReadingGoalFormState } from "@/modules/books/actions";
import { type ReadingGoalFormValues, readingGoalSchema } from "@/modules/books/schemas";

type GoalFormProps = {
  action: (state: ReadingGoalFormState, formData: FormData) => Promise<ReadingGoalFormState>;
  year: number;
  /** The current goal, or null to create one. */
  books: number | null;
};

/** "Livros em 2026" and a button (plan 037); the year goes along, hidden. */
export function GoalForm({ action, year, books }: GoalFormProps) {
  const form = useSchemaForm<ReadingGoalFormValues>({
    schema: readingGoalSchema,
    action,
    defaultValues: { year: String(year), books: books === null ? "" : String(books) },
    fieldOrder: ["books"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-3">
      <FormErrorMessage message={form.formError} />
      <input type="hidden" name="year" value={year} />
      <Field data-invalid={!!errors.books} className="max-w-48">
        <FieldLabel htmlFor={id("books")}>Livros em {year}</FieldLabel>
        <Input
          // A new default when the goal or the year changes (key remounts the field).
          key={`${year}-${books ?? ""}`}
          {...fieldProps("books")}
          defaultValue={values.books}
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
        />
        <FieldError id={errorId("books")}>{errors.books?.[0]}</FieldError>
      </Field>
      <SubmitButton variant={books === null ? "default" : "outline"} pendingContent="Salvando…">
        {books === null ? `Definir meta de ${year}` : "Salvar meta"}
      </SubmitButton>
    </form>
  );
}
