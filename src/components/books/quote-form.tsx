"use client";
// Client Component: validation errors and the "saving" state live in the browser.

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { useSchemaForm } from "@/components/forms/use-schema-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BookQuoteFormState } from "@/modules/books/actions";
import { type BookQuoteFormValues, bookQuoteSchema } from "@/modules/books/schemas";

type QuoteFormProps = {
  action: (state: BookQuoteFormState, formData: FormData) => Promise<BookQuoteFormState>;
  defaultValues?: BookQuoteFormValues;
  /** Editing shows "Salvar" and "Cancelar"; adding, a single button. */
  cancelHref?: string;
};

/** A quote of the book (plan 036): its text and, optionally, where it is. */
export function QuoteForm({ action, defaultValues, cancelHref }: QuoteFormProps) {
  const form = useSchemaForm<BookQuoteFormValues>({
    schema: bookQuoteSchema,
    action,
    defaultValues: defaultValues ?? { text: "", location: "" },
    fieldOrder: ["text", "location"],
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-4">
      <FormErrorMessage message={form.formError} />
      <Field data-invalid={!!errors.text}>
        <FieldLabel htmlFor={id("text")}>Trecho</FieldLabel>
        <Textarea {...fieldProps("text")} defaultValue={values.text} rows={3} maxLength={2000} />
        <FieldError id={errorId("text")}>{errors.text?.[0]}</FieldError>
      </Field>
      <Field data-invalid={!!errors.location}>
        <FieldLabel htmlFor={id("location")}>Onde está (opcional)</FieldLabel>
        <Input
          {...fieldProps("location")}
          defaultValue={values.location ?? ""}
          maxLength={20}
          className="sm:w-48"
        />
        <FieldDescription>Página, porcentagem ou tempo, como preferir.</FieldDescription>
        <FieldError id={errorId("location")}>{errors.location?.[0]}</FieldError>
      </Field>
      {cancelHref ? (
        <FormActions pending={form.pending} submitLabel="Salvar trecho" cancelHref={cancelHref} />
      ) : (
        <SubmitButton pendingContent="Adicionando…">Adicionar trecho</SubmitButton>
      )}
    </form>
  );
}
