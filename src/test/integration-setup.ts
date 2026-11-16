// Runs before each integration test file.
import { afterAll, beforeEach } from "vitest";

import { db } from "@/lib/db";

import { assertTestDatabase, resetTestDatabase } from "./test-database";

const url = process.env.DATABASE_URL ?? "";

// Safety net: integration tests delete data, so refuse to run unless
// DATABASE_URL points to a database whose name ends in "_test".
assertTestDatabase(url);

// Each test starts from an empty database, so tests never depend on each other.
beforeEach(async () => {
  await resetTestDatabase(url);
});

afterAll(async () => {
  await db.$disconnect();
});
