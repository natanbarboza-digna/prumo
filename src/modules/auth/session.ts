// Data access layer for the session (plan 014): reads the cookie, validates it
// in the database and sets or clears it. Server-only: it uses next/headers.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionCookieSecure } from "@/modules/auth/cookie";
import { LOGIN_PATH } from "@/modules/auth/redirect";
import { type CurrentSession, validateSession } from "@/modules/auth/service";

export const SESSION_COOKIE = "prumo_session";

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** The logged-in session, or null. Extends the cookie when the session was renewed. */
export async function getSession(): Promise<CurrentSession | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const session = await validateSession(token);
  if (session?.renewed) {
    // Cookies can only be written in Server Actions and Route Handlers; while
    // rendering a page this throws, and the next action updates the cookie.
    try {
      await setSessionCookie(token, session.expiresAt);
    } catch {}
  }
  return session;
}

/**
 * Every Server Action starts with this: an action can be called without going
 * through the screens, so hiding pages is not enough.
 */
export async function requireSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(process.env),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
