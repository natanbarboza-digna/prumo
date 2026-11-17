"use client";
// Client Component: same schema in the browser and on the server, field errors
// and the "saving" state, like every form in the app.

import { useEffect } from "react";

import { FormErrorMessage } from "@/components/forms/form-actions";
import { useSchemaForm } from "@/components/forms/use-schema-form";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type PasswordFormState, changePasswordAction } from "@/modules/auth/actions";
import { PASSWORD_MIN_LENGTH, passwordChangeSchema } from "@/modules/auth/schemas";

export function PasswordForm() {
  const form = useSchemaForm({
    schema: passwordChangeSchema,
    action: changePasswordAction,
    defaultValues: { currentPassword: "", newPassword: "", confirmation: "" },
    fieldOrder: ["currentPassword", "newPassword", "confirmation"],
  });
  const { errors, fieldProps, id, errorId } = form;
  // The action answers { saved: true } after changing the password.
  const saved = (form.state as PasswordFormState).saved;
  const formElement = form.formProps.ref;

  // After a successful change, clear the three password fields.
  useEffect(() => {
    if (saved) formElement.current?.reset();
  }, [saved, form.state, formElement]);

  return (
    <form {...form.formProps} className="space-y-6">
      <FormErrorMessage message={form.formError} />
      {saved && (
        <p role="status" className="text-sm font-medium">
          Senha alterada. As outras sessões foram encerradas.
        </p>
      )}
      <FieldGroup>
        <Field data-invalid={!!errors.currentPassword}>
          <FieldLabel htmlFor={id("currentPassword")}>Senha atual</FieldLabel>
          <Input
            {...fieldProps("currentPassword")}
            type="password"
            autoComplete="current-password"
            required
          />
          <FieldError id={errorId("currentPassword")}>{errors.currentPassword?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!errors.newPassword}>
          <FieldLabel htmlFor={id("newPassword")}>Senha nova</FieldLabel>
          <Input
            {...fieldProps("newPassword")}
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
          <FieldDescription>Pelo menos {PASSWORD_MIN_LENGTH} caracteres.</FieldDescription>
          <FieldError id={errorId("newPassword")}>{errors.newPassword?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!errors.confirmation}>
          <FieldLabel htmlFor={id("confirmation")}>Confirme a senha nova</FieldLabel>
          <Input
            {...fieldProps("confirmation")}
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldError id={errorId("confirmation")}>{errors.confirmation?.[0]}</FieldError>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={form.pending}>
        {form.pending ? "Salvando…" : "Trocar senha"}
      </Button>
    </form>
  );
}
