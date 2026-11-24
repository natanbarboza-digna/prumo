// Whether the session cookie is Secure (plans 014 and 039). Pure, so the unit
// tests cover it; session.ts passes process.env.

/**
 * Secure in production, so browsers only send it over HTTPS (or localhost).
 * SESSION_COOKIE_SECURE=false turns it off, for a server reached by its IP over
 * plain HTTP before it has a domain: anything else keeps it on.
 */
export function sessionCookieSecure(env: {
  NODE_ENV?: string;
  SESSION_COOKIE_SECURE?: string;
}): boolean {
  return env.NODE_ENV === "production" && env.SESSION_COOKIE_SECURE !== "false";
}
