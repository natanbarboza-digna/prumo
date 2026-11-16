import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";

describe("db", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("connects to the test database", async () => {
    // $queryRaw is a tagged template: values are sent as parameters, never
    // pasted into the SQL, so it is safe against SQL injection.
    const rows = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;

    expect(rows).toEqual([{ name: "personal_management_test" }]);
  });
});
