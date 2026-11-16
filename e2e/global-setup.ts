// Runs once before the e2e suite: migrates and empties the test database
// that the Playwright web server is pointed at (see playwright.config.ts).
import {
  migrateTestDatabase,
  readTestDatabaseUrl,
  resetTestDatabase,
} from "../src/test/test-database";

export default async function globalSetup(): Promise<void> {
  const url = readTestDatabaseUrl();
  migrateTestDatabase(url);
  await resetTestDatabase(url);
}
