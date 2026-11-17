import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/modules/auth/password";
import { safeNextPath } from "@/modules/auth/redirect";
import { generateSessionToken, hashSessionToken } from "@/modules/auth/tokens";

describe("password", () => {
  it("verifies the right password and refuses a wrong one", async () => {
    const hash = await hashPassword("uma senha bem longa");

    await expect(verifyPassword("uma senha bem longa", hash)).resolves.toBe(true);
    await expect(verifyPassword("uma senha bem longa!", hash)).resolves.toBe(false);
  });

  it("never stores the password and salts each hash", async () => {
    const first = await hashPassword("uma senha bem longa");
    const second = await hashPassword("uma senha bem longa");

    expect(first).not.toContain("uma senha");
    expect(first).toMatch(/^scrypt\$/);
    expect(first).not.toBe(second);
  });

  it("refuses a tampered or malformed hash instead of throwing", async () => {
    const hash = await hashPassword("uma senha bem longa");

    await expect(verifyPassword("uma senha bem longa", `${hash.slice(0, -4)}AAAA`)).resolves.toBe(
      false,
    );
    await expect(verifyPassword("uma senha bem longa", "não é um hash")).resolves.toBe(false);
  });
});

describe("session tokens", () => {
  it("generates long random tokens and a stable hash for each", () => {
    const token = generateSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSessionToken()).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
  });
});

describe("safeNextPath", () => {
  it("keeps internal paths, with their query", () => {
    expect(safeNextPath("/goals/1")).toBe("/goals/1");
    expect(safeNextPath("/routines?state=ended")).toBe("/routines?state=ended");
  });

  it("falls back to the dashboard for anything that could leave the app", () => {
    for (const value of [
      "https://outro.site",
      "//outro.site",
      "/\\outro.site",
      "javascript:alert(1)",
      "goals",
      "",
      null,
      "/login",
    ]) {
      expect(safeNextPath(value), String(value)).toBe("/");
    }
  });
});
