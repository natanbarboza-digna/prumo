// Runs once before the integration suite: brings the test database schema up to date.
import { migrateTestDatabase, readTestDatabaseUrl } from "./test-database";

export default function setup(): void {
  migrateTestDatabase(readTestDatabaseUrl());
}
