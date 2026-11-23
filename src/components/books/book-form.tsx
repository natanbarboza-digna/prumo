"use client";
// Client Component: validation errors, the "saving" state and the due date
// field (shown only for work and PDI books) live in the browser.

import { useState } from "react";

import { FormActions, FormErrorMessage } from "@/components/forms/form-actions";
import { type FormState, useSchemaForm } from "@/components/forms/use-schema-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { BookFormat, BookReason, type BookStatus } from "@/generated/prisma/enums";
import { bookFormatLabels, bookReasonLabels } from "@/modules/books/labels";
import { isRequired } from "@/modules/books/rules";
import { type BookFormValues, MAX_BOOK_PAGES, bookInputSchema } from "@/modules/books/schemas";
import type { GoalOption } from "@/modules/goals/options";

type BookFormProps = {
  action: (
    state: FormState<BookFormValues>,
    formData: FormData,
  ) => Promise<FormState<BookFormValues>>;
  goals: GoalOption[];
  defaultValues: BookFormValues;
  /** The book's status when editing (which dates it can have); null for a new book. */
  status: BookStatus | null;
  submitLabel: string;
  cancelHref: string;
};

const FIELD_ORDER = [
  "title",
  "authors",
  "format",
  "pages",
  "genre",
  "reason",
  "dueDate",
  "recommendedBy",
  "startedOn",
  "finishedOn",
  "goalId",
  "notes",
] as const;

export function BookForm({
  action,
  goals,
  defaultValues,
  status,
  submitLabel,
  cancelHref,
}: BookFormProps) {
  const form = useSchemaForm({
    schema: bookInputSchema,
    action,
    defaultValues,
    fieldOrder: FIELD_ORDER,
  });
  const { errors, values, fieldProps, id, errorId } = form;
  // Controlled only to show or hide the due date: an unrendered field is not sent.
  const [reason, setReason] = useState<BookReason>(values.reason ?? "PERSONAL");
  const showStart = status !== null && status !== "TO_READ";
  const showEnd = status === "READ" || status === "ABANDONED";

  return (
    <form {...form.formProps} className="space-y-6">
      <FormErrorMessage message={form.formError} />
      <FieldGroup>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor={id("title")}>Título</FieldLabel>
          <Input {...fieldProps("title")} defaultValue={values.title} required maxLength={200} />
          <FieldError id={errorId("title")}>{errors.title?.[0]}</FieldError>
        </Field>

        <Field data-invalid={!!errors.authors}>
          <FieldLabel htmlFor={id("authors")}>Autor(es)</FieldLabel>
          <Input
            {...fieldProps("authors")}
            defaultValue={values.authors}
            required
            maxLength={200}
          />
          <FieldError id={errorId("authors")}>{errors.authors?.[0]}</FieldError>
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.format}>
            <FieldLabel htmlFor={id("format")}>Formato</FieldLabel>
            <NativeSelect
              {...fieldProps("format")}
              defaultValue={values.format ?? "PHYSICAL"}
              className="w-full"
            >
              {Object.values(BookFormat).map((format) => (
                <NativeSelectOption key={format} value={format}>
                  {bookFormatLabels[format]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id={errorId("format")}>{errors.format?.[0]}</FieldError>
          </Field>

          <Field data-invalid={!!errors.pages}>
            <FieldLabel htmlFor={id("pages")}>Páginas (opcional)</FieldLabel>
            <Input
              {...fieldProps("pages")}
              defaultValue={values.pages ?? ""}
              inputMode="numeric"
              type="number"
              min={1}
              max={MAX_BOOK_PAGES}
            />
            <FieldError id={errorId("pages")}>{errors.pages?.[0]}</FieldError>
          </Field>
        </div>

        <Field data-invalid={!!errors.genre}>
          <FieldLabel htmlFor={id("genre")}>Gênero (opcional)</FieldLabel>
          <Input {...fieldProps("genre")} defaultValue={values.genre ?? ""} maxLength={60} />
          <FieldError id={errorId("genre")}>{errors.genre?.[0]}</FieldError>
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.reason}>
            <FieldLabel htmlFor={id("reason")}>Motivo</FieldLabel>
            <NativeSelect
              {...fieldProps("reason")}
              value={reason}
              onChange={(event) => setReason(event.target.value as BookReason)}
              className="w-full"
            >
              {Object.values(BookReason).map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {bookReasonLabels[option]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              Trabalho e PDI ficam em “Preciso ler” e podem ter prazo.
            </FieldDescription>
            <FieldError id={errorId("reason")}>{errors.reason?.[0]}</FieldError>
          </Field>

          {isRequired(reason) && (
            <Field data-invalid={!!errors.dueDate}>
              <FieldLabel htmlFor={id("dueDate")}>Prazo (opcional)</FieldLabel>
              <Input {...fieldProps("dueDate")} type="date" defaultValue={values.dueDate ?? ""} />
              <FieldError id={errorId("dueDate")}>{errors.dueDate?.[0]}</FieldError>
            </Field>
          )}
        </div>

        <Field data-invalid={!!errors.recommendedBy}>
          <FieldLabel htmlFor={id("recommendedBy")}>Quem indicou (opcional)</FieldLabel>
          <Input
            {...fieldProps("recommendedBy")}
            defaultValue={values.recommendedBy ?? ""}
            maxLength={120}
          />
          <FieldError id={errorId("recommendedBy")}>{errors.recommendedBy?.[0]}</FieldError>
        </Field>

        {(showStart || showEnd) && (
          <div className="grid gap-6 sm:grid-cols-2">
            {showStart && (
              <Field data-invalid={!!errors.startedOn}>
                <FieldLabel htmlFor={id("startedOn")}>Início da leitura</FieldLabel>
                <Input
                  {...fieldProps("startedOn")}
                  type="date"
                  defaultValue={values.startedOn ?? ""}
                />
                <FieldError id={errorId("startedOn")}>{errors.startedOn?.[0]}</FieldError>
              </Field>
            )}
            {showEnd && (
              <Field data-invalid={!!errors.finishedOn}>
                <FieldLabel htmlFor={id("finishedOn")}>Término</FieldLabel>
                <Input
                  {...fieldProps("finishedOn")}
                  type="date"
                  defaultValue={values.finishedOn ?? ""}
                />
                <FieldError id={errorId("finishedOn")}>{errors.finishedOn?.[0]}</FieldError>
              </Field>
            )}
          </div>
        )}

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
          <FieldDescription>O livro lido conta no progresso do objetivo.</FieldDescription>
          <FieldError id={errorId("goalId")}>{errors.goalId?.[0]}</FieldError>
        </Field>

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor={id("notes")}>Notas (opcional)</FieldLabel>
          <Textarea
            {...fieldProps("notes")}
            defaultValue={values.notes ?? ""}
            rows={4}
            maxLength={2000}
          />
          <FieldError id={errorId("notes")}>{errors.notes?.[0]}</FieldError>
        </Field>
      </FieldGroup>

      <FormActions pending={form.pending} submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
