// Emptying every table, shared by the test helpers and the demo seed's --reset.
// No imports: src/test/test-database.ts also runs in Playwright's CommonJS loader.

/** Every app table: all tables of the public schema but Prisma's migration history. */
export const APP_TABLES_QUERY = `SELECT tablename FROM pg_tables
  WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;

/** One TRUNCATE for all the given tables, or null when there is none. */
export function truncateStatement(tables: readonly string[]): string | null {
  if (tables.length === 0) return null;
  // Table names come from the catalog, not from user input; quoting them
  // with double quotes keeps any name valid as an SQL identifier.
  const list = tables.map((table) => `"${table.replaceAll('"', '""')}"`).join(", ");
  return `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`;
}
