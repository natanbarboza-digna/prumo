// The single account and its sessions (plan 014). Passwords are scrypt hashes;
// sessions live in the database and the cookie only carries a random token.

import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/modules/auth/password";
export { PASSWORD_MIN_LENGTH } from "@/modules/auth/schemas";
import { generateSessionToken, hashSessionToken } from "@/modules/auth/tokens";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const SESSION_DAYS = 30;
/** A session used with fewer days than this left is extended to SESSION_DAYS again. */
export const RENEW_BELOW_DAYS = 15;

const DAY_MS = 86_400_000;

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class AccountLockedError extends Error {
  constructor(readonly until: Date) {
    super(`Account locked until ${until.toISOString()}`);
    this.name = "AccountLockedError";
  }
}

export class AccountExistsError extends Error {
  constructor() {
    super("An account already exists");
    this.name = "AccountExistsError";
  }
}

export class WrongCurrentPasswordError extends Error {
  constructor() {
    super("The current password is wrong");
    this.name = "WrongCurrentPasswordError";
  }
}

export class AccountNotFoundError extends Error {
  constructor(email: string) {
    super(`No account for ${email}`);
    this.name = "AccountNotFoundError";
  }
}

export type CurrentSession = {
  userId: string;
  email: string;
  expiresAt: Date;
  /** True when this check extended the session: the cookie must be updated too. */
  renewed: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Creates the only account. The app is single-user: a second one is refused. */
export async function createUser(email: string, password: string): Promise<void> {
  if ((await db.user.count()) > 0) throw new AccountExistsError();
  await db.user.create({
    data: { email: normalizeEmail(email), passwordHash: await hashPassword(password) },
  });
}

// Hashed once, used to spend the same time on an unknown email as on a known one,
// so response times do not reveal whether the email exists.
let dummyHash: Promise<string> | null = null;

export async function login(
  email: string,
  password: string,
  clock?: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });
  const now = clock ?? new Date();
  if (!user) {
    dummyHash ??= hashPassword("not a real password");
    await verifyPassword(password, await dummyHash);
    throw new InvalidCredentialsError();
  }
  if (user.lockedUntil && user.lockedUntil > now) throw new AccountLockedError(user.lockedUntil);

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLoginCount + 1;
    const locks = failed >= MAX_FAILED_LOGINS;
    // updateMany does not throw if the account was deleted meanwhile (the
    // password check takes a moment); the answer is the same generic error.
    await db.user.updateMany({
      where: { id: user.id },
      data: {
        failedLoginCount: locks ? 0 : failed,
        lockedUntil: locks ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : user.lockedUntil,
      },
    });
    throw new InvalidCredentialsError();
  }

  const { count } = await db.user.updateMany({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
  // The account disappeared between reading it and now: nothing to log in to.
  if (count === 0) throw new InvalidCredentialsError();
  return createSession(user.id, now);
}

async function createSession(userId: string, now: Date) {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  await db.session.create({ data: { tokenHash: hashSessionToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

/** The session behind a cookie token, extended when close to expiring; null when invalid. */
export async function validateSession(token: string, clock?: Date): Promise<CurrentSession | null> {
  const tokenHash = hashSessionToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: { select: { email: true } } },
  });
  if (!session) return null;
  // Read the clock only after the database: Next refuses `new Date()` before
  // any per-request data while it prerenders a page.
  const now = clock ?? new Date();
  if (session.expiresAt <= now) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  let { expiresAt } = session;
  const renewed = expiresAt.getTime() - now.getTime() < RENEW_BELOW_DAYS * DAY_MS;
  if (renewed) {
    expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
    await db.session.update({ where: { id: session.id }, data: { expiresAt } });
  }
  return { userId: session.userId, email: session.user.email, expiresAt, renewed };
}

export async function logout(token: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

/** Needs the current password; keeps the current session and ends all the others. */
export async function changePassword(
  userId: string,
  currentToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new WrongCurrentPasswordError();
  }
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
    db.session.deleteMany({
      where: { userId, tokenHash: { not: hashSessionToken(currentToken) } },
    }),
  ]);
}

/** For a forgotten password, from the command line: new password, unlocked, every session ended. */
export async function resetPassword(email: string, newPassword: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user) throw new AccountNotFoundError(email);
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);
}
