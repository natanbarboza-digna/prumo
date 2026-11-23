"use client";
// Client Component: validation errors, the "saving" state and the "saved" note
// live in the browser.

import { FormErrorMessage } from "@/components/forms/form-actions";
import { useSchemaForm } from "@/components/forms/use-schema-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { BookRatingFormState } from "@/modules/books/actions";
import { type BookRatingFormValues, bookRatingSchema } from "@/modules/books/schemas";

type RatingFormProps = {
  action: (state: BookRatingFormState, formData: FormData) => Promise<BookRatingFormState>;
  defaultValues: BookRatingFormValues;
  /** Only a read book takes a rating; an abandoned one, just the review. */
  withRating: boolean;
};

const RATINGS = ["1", "2", "3", "4", "5"] as const;

/** Rating from 1 to 5 and review (plan 036). Saving keeps the book's status. */
export function RatingForm({ action, defaultValues, withRating }: RatingFormProps) {
  const form = useSchemaForm<BookRatingFormValues>({
    schema: bookRatingSchema,
    action,
    defaultValues,
    fieldOrder: ["rating", "review"],
  });
  const { errors, values, fieldProps, id, errorId } = form;
  const current = values.rating ?? "";

  return (
    <form {...form.formProps} className="space-y-4">
      <FormErrorMessage message={form.formError} />
      {withRating && (
        <FieldSet>
          <FieldLegend variant="label">Nota</FieldLegend>
          <div className="flex flex-wrap gap-4">
            {[...RATINGS, ""].map((value, index) => {
              const inputId = index === 0 ? id("rating") : `${id("rating")}-${value || "none"}`;
              return (
                <Field key={value || "none"} orientation="horizontal" className="w-auto">
                  <input
                    type="radio"
                    id={inputId}
                    name="rating"
                    value={value}
                    defaultChecked={current === value}
                    className="accent-primary size-4"
                  />
                  <FieldLabel htmlFor={inputId} className="font-normal">
                    {value === "" ? "Sem nota" : `${value} ★`}
                  </FieldLabel>
                </Field>
              );
            })}
          </div>
          <FieldError id={errorId("rating")}>{errors.rating?.[0]}</FieldError>
        </FieldSet>
      )}
      <Field data-invalid={!!errors.review}>
        <FieldLabel htmlFor={id("review")}>Resenha (opcional)</FieldLabel>
        <Textarea
          {...fieldProps("review")}
          defaultValue={values.review ?? ""}
          rows={4}
          maxLength={5000}
        />
        <FieldError id={errorId("review")}>{errors.review?.[0]}</FieldError>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingContent="Salvando…">Salvar avaliação</SubmitButton>
        {"saved" in form.state && form.state.saved === true && !form.pending && (
          <p role="status" className="text-muted-foreground text-sm">
            Avaliação salva.
          </p>
        )}
      </div>
    </form>
  );
}
