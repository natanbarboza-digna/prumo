// Session tokens: the cookie carries the token, the database only its hash,
// so a copy of the database does not let anyone log in.

import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, base64url (43 characters). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
