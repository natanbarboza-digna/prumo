// Helpers shared by the Vitest integration suite and the Playwright e2e suite.
// They only ever touch the database configured in .env.test.
import { execSync } from "node:child_process";

import { config as loadEnv } from "dotenv";
import { Client } from "pg";

// Relative import: this file also runs in Playwright's process.
import { DEFAULT_CATEGORIES } from "../modules/categories/defaults";
import { DEFAULT_TIME_CATEGORIES } from "../modules/time/defaults";
import { APP_TABLES_QUERY, truncateStatement } from "../lib/truncate";
import { hashPassword } from "../modules/auth/password";
import { hashSessionToken } from "../modules/auth/tokens";

/** The e2e account (plan 014). Test-only values: this database is wiped on every run. */
export const E2E_EMAIL = "teste@prumo.local";
export const E2E_PASSWORD = "senha de teste dos e2e";
/** Playwright starts every test with this session cookie (see playwright.config.ts). */
export const E2E_SESSION_TOKEN = "e2e-session-token-only-for-the-test-database";

/** Reads DATABASE_URL from .env.test and refuses anything not named *_test. */
export function readTestDatabaseUrl(): string {
  const env: Record<string, string> = {};
  loadEnv({ path: ".env.test", processEnv: env, quiet: true });
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing from .env.test. Copy .env.example to .env.test.");
  }
  assertTestDatabase(url);
  return url;
}

export function assertTestDatabase(url: string): void {
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    throw new Error(`Refusing to use a non-test database ("${databaseName}"). Check .env.test.`);
  }
}

/** Applies every pending migration to the test database. */
export function migrateTestDatabase(url: string): void {
  assertTestDatabase(url);
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

/** Empties every table except Prisma's migration history. */
export async function resetTestDatabase(url: string): Promise<void> {
  assertTestDatabase(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(APP_TABLES_QUERY);
    const statement = truncateStatement(rows.map(({ tablename }) => tablename));
    if (statement !== null) await client.query(statement);
  } finally {
    await client.end();
  }
}

/**
 * Creates the default action categories (the same list `npx prisma db seed`
 * uses). Plain SQL instead of the Prisma client: the generated client is an ES
 * module, which Playwright's CommonJS loader cannot import. Postgres 18's
 * uuidv7() matches the ids Prisma would generate.
 */
export async function seedTestDatabase(url: string): Promise<void> {
  assertTestDatabase(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const category of DEFAULT_CATEGORIES) {
      await client.query(
        `INSERT INTO action_categories (id, name, allows_routine, archived, created_at, updated_at)
         VALUES (uuidv7(), $1, $2, false, now(), now())
         ON CONFLICT (name) DO NOTHING`,
        [category.name, category.allowsRoutine],
      );
    }
    for (const name of DEFAULT_TIME_CATEGORIES) {
      await client.query(
        `INSERT INTO time_categories (id, name, archived, created_at, updated_at)
         VALUES (uuidv7(), $1, false, now(), now())
         ON CONFLICT (name) DO NOTHING`,
        [name],
      );
    }
    // The single account and a long session with a fixed token, so the e2e
    // tests run logged in. Same columns Prisma would write.
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (id, email, password_hash, failed_login_count, created_at, updated_at)
       VALUES (uuidv7(), $1, $2, 0, now(), now())
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [E2E_EMAIL, await hashPassword(E2E_PASSWORD)],
    );
    await client.query(
      `INSERT INTO sessions (id, token_hash, user_id, expires_at, created_at)
       VALUES (uuidv7(), $1, $2, now() + interval '30 days', now())
       ON CONFLICT (token_hash) DO NOTHING`,
      [hashSessionToken(E2E_SESSION_TOKEN), rows[0]?.id],
    );
  } finally {
    await client.end();
  }
}
