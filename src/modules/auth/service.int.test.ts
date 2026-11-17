import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  AccountExistsError,
  AccountLockedError,
  InvalidCredentialsError,
  WrongCurrentPasswordError,
  changePassword,
  createUser,
  login,
  logout,
  resetPassword,
  validateSession,
} from "@/modules/auth/service";

const EMAIL = "eu@exemplo.com";
const PASSWORD = "senha bem comprida";
const start = new Date("2026-11-17T12:00:00Z");
const minutes = (n: number) => new Date(start.getTime() + n * 60_000);
const days = (n: number) => new Date(start.getTime() + n * 86_400_000);

describe("createUser", () => {
  it("creates the single account with the email in lowercase", async () => {
    await createUser("Eu@Exemplo.com", PASSWORD);

    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.passwordHash).not.toContain(PASSWORD);
  });

  it("refuses a second account", async () => {
    await createUser(EMAIL, PASSWORD);

    await expect(createUser("outro@exemplo.com", PASSWORD)).rejects.toThrow(AccountExistsError);
  });
});

describe("login", () => {
  it("creates a 30-day session for the right password, ignoring the email's case", async () => {
    await createUser(EMAIL, PASSWORD);

    const session = await login(" EU@exemplo.com ", PASSWORD, start);

    expect(session.expiresAt).toEqual(days(30));
    await expect(validateSession(session.token, start)).resolves.toMatchObject({ email: EMAIL });
  });

  it("refuses a wrong password or an unknown email with the same error", async () => {
    await createUser(EMAIL, PASSWORD);

    await expect(login(EMAIL, "senha errada!!", start)).rejects.toThrow(InvalidCredentialsError);
    await expect(login("ninguem@exemplo.com", PASSWORD, start)).rejects.toThrow(
      InvalidCredentialsError,
    );
    await expect(db.session.count()).resolves.toBe(0);
  });

  it("locks the account for 15 minutes after 5 wrong passwords in a row", async () => {
    await createUser(EMAIL, PASSWORD);
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(login(EMAIL, "senha errada!!", start)).rejects.toThrow(InvalidCredentialsError);
    }

    await expect(login(EMAIL, PASSWORD, minutes(1))).rejects.toThrow(AccountLockedError);
    await expect(login(EMAIL, PASSWORD, minutes(14))).rejects.toThrow(AccountLockedError);
    await expect(login(EMAIL, PASSWORD, minutes(15))).resolves.toMatchObject({
      token: expect.any(String),
    });
  });

  it("starts counting again after a successful login", async () => {
    await createUser(EMAIL, PASSWORD);
    for (let attempt = 0; attempt < 4; attempt++) {
      await expect(login(EMAIL, "senha errada!!", start)).rejects.toThrow();
    }
    await login(EMAIL, PASSWORD, start);

    for (let attempt = 0; attempt < 4; attempt++) {
      await expect(login(EMAIL, "senha errada!!", start)).rejects.toThrow(InvalidCredentialsError);
    }
    await expect(login(EMAIL, PASSWORD, start)).resolves.toBeDefined();
  });
});

describe("validateSession", () => {
  it("refuses an unknown token", async () => {
    await expect(validateSession("token-que-nao-existe", start)).resolves.toBeNull();
  });

  it("refuses and deletes an expired session", async () => {
    await createUser(EMAIL, PASSWORD);
    const { token } = await login(EMAIL, PASSWORD, start);

    await expect(validateSession(token, days(30))).resolves.toBeNull();
    await expect(db.session.count()).resolves.toBe(0);
  });

  it("extends a session used with less than 15 days left", async () => {
    await createUser(EMAIL, PASSWORD);
    const { token } = await login(EMAIL, PASSWORD, start);

    await expect(validateSession(token, days(10))).resolves.toMatchObject({
      expiresAt: days(30),
      renewed: false,
    });
    await expect(validateSession(token, days(20))).resolves.toMatchObject({
      expiresAt: days(50),
      renewed: true,
    });
  });
});

describe("logout", () => {
  it("deletes the session", async () => {
    await createUser(EMAIL, PASSWORD);
    const { token } = await login(EMAIL, PASSWORD, start);

    await logout(token);

    await expect(validateSession(token, start)).resolves.toBeNull();
  });
});

describe("changePassword", () => {
  it("needs the current password, then logs out the other sessions", async () => {
    await createUser(EMAIL, PASSWORD);
    const current = await login(EMAIL, PASSWORD, start);
    const other = await login(EMAIL, PASSWORD, start);
    const session = await validateSession(current.token, start);

    await expect(
      changePassword(session!.userId, current.token, "senha errada!!", "nova senha comprida"),
    ).rejects.toThrow(WrongCurrentPasswordError);

    await changePassword(session!.userId, current.token, PASSWORD, "nova senha comprida");

    await expect(validateSession(current.token, start)).resolves.not.toBeNull();
    await expect(validateSession(other.token, start)).resolves.toBeNull();
    await expect(login(EMAIL, PASSWORD, start)).rejects.toThrow(InvalidCredentialsError);
    await expect(login(EMAIL, "nova senha comprida", start)).resolves.toBeDefined();
  });
});

describe("resetPassword", () => {
  it("sets a new password, unlocks the account and ends every session", async () => {
    await createUser(EMAIL, PASSWORD);
    const { token } = await login(EMAIL, PASSWORD, start);
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(login(EMAIL, "senha errada!!", start)).rejects.toThrow();
    }

    await resetPassword(EMAIL, "senha nova e longa");

    await expect(validateSession(token, start)).resolves.toBeNull();
    await expect(login(EMAIL, "senha nova e longa", minutes(1))).resolves.toBeDefined();
  });
});
