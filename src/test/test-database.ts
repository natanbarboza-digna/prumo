// Helpers shared by the Vitest integration suite and the Playwright e2e suite.
// They only ever touch the database configured in .env.test.
import { execSync } from "node:child_process";

import { config as loadEnv } from "dotenv";
import { Client } from "pg";

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
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length === 0) return;
    // Table names come from the catalog, not from user input; quoting them
    // with double quotes keeps any name valid as an SQL identifier.
    const tables = rows.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`).join(", ");
    await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}
