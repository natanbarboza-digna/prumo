import { z } from "zod";

/** Plan 014. Lives here (not in the service) so the browser forms can import it. */
export const PASSWORD_MIN_LENGTH = 12;

const email = z
  .string()
  .trim()
  .min(1, "Informe o e-mail.")
  .pipe(z.email({ error: "Informe um e-mail válido." }));

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(200, "A senha pode ter no máximo 200 caracteres.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha."),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword,
    confirmation: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    error: "A confirmação não é igual à senha nova.",
    path: ["confirmation"],
  });

/** Used by the command-line script that creates the account or resets its password. */
export const accountSchema = z.object({ email, password: newPassword });

export type LoginFormValues = z.input<typeof loginSchema>;
export type PasswordChangeFormValues = z.input<typeof passwordChangeSchema>;
