// Safety net: integration tests create and delete data, so refuse to run
// unless DATABASE_URL points to a database whose name ends in "_test".
const url = process.env.DATABASE_URL;
const databaseName = url ? new URL(url).pathname.slice(1) : "";

if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Integration tests must use a *_test database (got "${databaseName || "none"}"). Check .env.test.`,
  );
}
