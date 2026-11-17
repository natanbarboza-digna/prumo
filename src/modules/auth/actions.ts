"use server";
// Login, logout and password change (plan 014). Inputs are untrusted and are
// validated here with the same schemas the forms use.

import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/components/forms/use-schema-form";
import { LOGIN_PATH, safeNextPath } from "@/modules/auth/redirect";
import {
  type LoginFormValues,
  type PasswordChangeFormValues,
  loginSchema,
  passwordChangeSchema,
} from "@/modules/auth/schemas";
import {
  AccountLockedError,
  InvalidCredentialsError,
  WrongCurrentPasswordError,
  changePassword,
  login,
  logout,
} from "@/modules/auth/service";
import {
  clearSessionCookie,
  getSessionToken,
  requireSession,
  setSessionCookie,
} from "@/modules/auth/session";

export type LoginFormState = FormState<LoginFormValues>;
export type PasswordFormState = FormState<PasswordChangeFormValues> & { saved?: boolean };

export async function loginAction(
  _previous: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const raw = { email: formData.get("email"), password: formData.get("password") };
  const parsed = loginSchema.safeParse(raw);
  // Never send the password back to the browser.
  const values = { email: typeof raw.email === "string" ? raw.email : "", password: "" };
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  try {
    const session = await login(parsed.data.email, parsed.data.password);
    await setSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return { formError: "E-mail ou senha incorretos.", values };
    }
    if (error instanceof AccountLockedError) {
      return { formError: "Muitas tentativas. Tente de novo em alguns minutos.", values };
    }
    throw error;
  }
  const next = formData.get("next");
  redirect(safeNextPath(typeof next === "string" ? next : null));
}

export async function logoutAction(): Promise<void> {
  const token = await getSessionToken();
  if (token) await logout(token);
  await clearSessionCookie();
  redirect(LOGIN_PATH);
}

export async function changePasswordAction(
  _previous: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const session = await requireSession();
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const token = await getSessionToken();
  try {
    await changePassword(
      session.userId,
      token ?? "",
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
  } catch (error) {
    if (error instanceof WrongCurrentPasswordError) {
      return { errors: { currentPassword: ["A senha atual está incorreta."] } };
    }
    throw error;
  }
  return { saved: true };
}
