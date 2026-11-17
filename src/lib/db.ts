import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * A pg Client that sends one query at a time: each query waits for the one
 * before it to finish.
 *
 * Why: when a write returns nested relations (e.g. creating a PDI action with
 * its category, goal and area), Prisma 7.10's adapter fetches them at the same
 * time on the transaction's single connection. pg 8 queues the extra queries
 * itself but warns ("Calling client.query() when the client is already
 * executing a query is deprecated"), and pg 9 drops that queue. This class
 * keeps the same queue on our side. Postgres runs one query per connection
 * anyway, so nothing gets slower.
 *
 * When to remove: after upgrading Prisma, run the tests without it (use
 * `new PrismaPg({ connectionString })`); if pg's warning does not come back,
 * delete this class. See plan 010.
 */
export class SerialClient extends pg.Client {
  #tail: Promise<unknown> = Promise.resolve();

  constructor(config?: string | pg.ClientConfig) {
    super(config);
    // pg's query() has many overloads; wrapping it through unknown[] and
    // casting back keeps every overload's type for callers.
    const send = super.query.bind(this) as (...args: unknown[]) => unknown;
    this.query = ((...args: unknown[]) => {
      // Callbacks and "submittable" objects (cursors, streams) do not return a
      // promise to chain on; nothing in this app uses them, so they go straight to pg.
      const usesCallback = typeof args[args.length - 1] === "function";
      const submittable = typeof (args[0] as { submit?: unknown } | null)?.submit === "function";
      if (usesCallback || submittable) return send(...args);

      const run = this.#tail.then(() => send(...args));
      // A failed query must not block the ones after it.
      this.#tail = run.catch(() => undefined);
      return run;
    }) as typeof this.query;
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  // Unit tests import services (and so this module) without a database; the
  // client only connects on the first query, so it is safe to build it there.
  // Integration tests check their own DATABASE_URL in src/test/integration-setup.ts.
  if (!connectionString && process.env.NODE_ENV !== "test") {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }
  // `Client` is pg's Pool option for the class of the connections it opens.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, Client: SerialClient }) });
}

// `next dev` re-runs modules on every hot reload. Keeping the client on
// globalThis reuses one connection pool instead of opening a new one each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
