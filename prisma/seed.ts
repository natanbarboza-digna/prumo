// Initial data. Run with `npx prisma db seed`. Every write is idempotent.
import "dotenv/config";

import { db } from "../src/lib/db";
import { ensureDefaultCategories } from "../src/modules/categories/defaults";
import { ensureDefaultTimeCategories } from "../src/modules/time/defaults";

async function main(): Promise<void> {
  await ensureDefaultCategories(db);
  await ensureDefaultTimeCategories(db);
  console.log("Categorias padrão conferidas.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
