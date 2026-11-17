"use client";
// Client Component: validates with the same Zod schema as the server and shows
// the errors without a round trip, like every form in the app.

import { FormErrorMessage } from "@/components/forms/form-actions";
import { useSchemaForm } from "@/components/forms/use-schema-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/modules/auth/actions";
import { loginSchema } from "@/modules/auth/schemas";

export function LoginForm({ next }: { next: string }) {
  const form = useSchemaForm({
    schema: loginSchema,
    action: loginAction,
    defaultValues: { email: "", password: "" },
    fieldOrder: ["email", "password"],
    // `next` is not part of the schema: it travels as a hidden field.
    readForm: (formData) => ({ email: formData.get("email"), password: formData.get("password") }),
  });
  const { errors, values, fieldProps, id, errorId } = form;

  return (
    <form {...form.formProps} className="space-y-6">
      <input type="hidden" name="next" value={next} />
      <FormErrorMessage message={form.formError} />
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor={id("email")}>E-mail</FieldLabel>
          <Input
            {...fieldProps("email")}
            type="email"
            autoComplete="username"
            defaultValue={values.email}
            required
          />
          <FieldError id={errorId("email")}>{errors.email?.[0]}</FieldError>
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor={id("password")}>Senha</FieldLabel>
          <Input
            {...fieldProps("password")}
            type="password"
            autoComplete="current-password"
            required
          />
          <FieldError id={errorId("password")}>{errors.password?.[0]}</FieldError>
        </Field>
      </FieldGroup>
      <Button type="submit" className="w-full" disabled={form.pending}>
        {form.pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
