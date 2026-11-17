// Helpers shared by the Vitest integration suite and the Playwright e2e suite.
// They only ever touch the database configured in .env.test.
import { execSync } from "node:child_process";

import { config as loadEnv } from "dotenv";
import { Client } from "pg";

// Relative import: this file also runs in Playwright's process.
import { DEFAULT_CATEGORIES } from "../modules/categories/defaults";
import { APP_TABLES_QUERY, truncateStatement } from "../lib/truncate";

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
  } finally {
    await client.end();
  }
}
