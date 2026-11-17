import { afterEach, describe, expect, it } from "vitest";

import { SerialClient, db } from "@/lib/db";
import { pdiActionFixture } from "@/test/pdi-fixtures";

describe("db", () => {
  it("connects to the test database", async () => {
    // $queryRaw is a tagged template: values are sent as parameters, never
    // pasted into the SQL, so it is safe against SQL injection.
    const rows = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;

    expect(rows).toEqual([{ name: "prumo_test" }]);
  });

  // Node shows each deprecation once per process, so this test must be the
  // first one in this file to send two queries at once on one connection.
  it("writes that return nested relations do not trigger pg's deprecation warning", async () => {
    const warnings: Error[] = [];
    const listen = (warning: Error) => warnings.push(warning);
    process.on("warning", listen);
    try {
      // Prisma wraps a write in a transaction and fetches the included
      // relations at the same time on that one connection. pg only warns
      // when a query is already waiting, so it takes three at once: creating
      // a PDI action includes its category, goal and area.
      const { action } = await pdiActionFixture();
      expect(action).toMatchObject({ title: "Praticar oratória", goal: null });
      // Warnings are emitted on the next tick.
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      process.off("warning", listen);
    }

    expect(warnings.filter((warning) => warning.name === "DeprecationWarning")).toEqual([]);
  });

  it("still rolls back the whole transaction when a parallel query fails", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await Promise.all([
          tx.goal.create({ data: { title: "Vai sumir" } }),
          tx.goal.create({ data: { title: "Também" } }),
        ]);
        throw new Error("falha no meio");
      }),
    ).rejects.toThrow("falha no meio");

    await expect(db.goal.count()).resolves.toBe(0);
  });
});

describe("SerialClient", () => {
  const clients: SerialClient[] = [];

  async function connect(): Promise<SerialClient> {
    const client = new SerialClient({ connectionString: process.env.DATABASE_URL });
    clients.push(client);
    await client.connect();
    return client;
  }

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.end()));
  });

  it("runs queries sent together one after the other, in order", async () => {
    const client = await connect();
    const finished: number[] = [];

    const results = await Promise.all(
      [3, 1, 2].map(async (n) => {
        // The first query sleeps longest: without the queue order would not matter here,
        // but each result must still match the query that asked for it.
        const result = await client.query<{ n: number }>(
          "SELECT $1::int AS n, pg_sleep($1::int * 0.01)",
          [n],
        );
        finished.push(n);
        return result.rows[0]?.n;
      }),
    );

    expect(results).toEqual([3, 1, 2]);
    expect(finished).toEqual([3, 1, 2]);
  });

  it("keeps going after a query fails", async () => {
    const client = await connect();

    const [failed, next] = await Promise.allSettled([
      client.query("SELECT * FROM table_that_does_not_exist"),
      client.query<{ ok: number }>("SELECT 1 AS ok"),
    ]);

    expect(failed.status).toBe("rejected");
    expect(next.status === "fulfilled" && next.value.rows).toEqual([{ ok: 1 }]);
  });
});
