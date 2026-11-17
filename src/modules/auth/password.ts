// Password hashing with scrypt, built into Node: no dependency needed (plan 014).
// The stored string carries the parameters and the salt, so they can change
// later without breaking old hashes: "scrypt$N$r$p$salt$hash" (base64url).

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// N = 2^15 makes each hash take tens of milliseconds and ~32 MB of memory:
// cheap for one login, expensive for someone guessing millions of passwords.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** True when the password matches the stored hash; false for any malformed hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  try {
    const key = await derive(
      password,
      Buffer.from(salt, "base64url"),
      Number(n),
      Number(r),
      Number(p),
    );
    // Constant-time comparison: the time taken does not reveal how much matched.
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
