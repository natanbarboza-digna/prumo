import { describe, expect, it } from "vitest";

import { sessionCookieSecure } from "@/modules/auth/cookie";

describe("sessionCookieSecure (plan 039)", () => {
  it("is Secure in production unless SESSION_COOKIE_SECURE is exactly false", () => {
    expect(sessionCookieSecure({ NODE_ENV: "production" })).toBe(true);
    expect(sessionCookieSecure({ NODE_ENV: "production", SESSION_COOKIE_SECURE: "false" })).toBe(
      false,
    );
  });

  it.each(["0", "no", "FALSE", "", "true"])("stays Secure in production with %j", (value) => {
    expect(sessionCookieSecure({ NODE_ENV: "production", SESSION_COOKIE_SECURE: value })).toBe(
      true,
    );
  });

  it("is not Secure in development and tests, as before", () => {
    expect(sessionCookieSecure({ NODE_ENV: "development" })).toBe(false);
    expect(sessionCookieSecure({ NODE_ENV: "test" })).toBe(false);
  });
});
