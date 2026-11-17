// Demo data for the development database. Run with `npm run db:seed:demo`;
// add `-- --reset` to delete everything first. The data itself is built in
// src/demo/seed-demo.ts, where the integration tests can reach it.
import "dotenv/config";

import { db } from "../src/lib/db";
import { todayInAppTimeZone } from "../src/lib/dates";
import { DemoDataExistsError, assertCanSeed, resetAllData, seedDemo } from "../src/demo/seed-demo";

async function main(): Promise<void> {
  const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
  if (databaseName.endsWith("_test")) {
    console.error(
      `Recusado: "${databaseName}" é o banco de teste, que os testes apagam a cada execução.`,
    );
    process.exitCode = 1;
    return;
  }

  if (process.argv.includes("--reset")) {
    await resetAllData();
    console.log(`Todos os dados de "${databaseName}" foram apagados.`);
  } else {
    await assertCanSeed();
  }

  const summary = await seedDemo(todayInAppTimeZone());
  console.log(`Demonstração criada em "${databaseName}":`);
  console.log(`  ${summary.goals} objetivos`);
  console.log(`  ${summary.tracks} trilhas com ${summary.steps} etapas`);
  console.log(`  ${summary.routines} rotinas com ${summary.logs} registros`);
  console.log(
    `  ${summary.cycles} ciclos de PDI com ${summary.areas} áreas, ${summary.actions} ações e ${summary.checkIns} check-ins`,
  );
}

main()
  .catch((error: unknown) => {
    if (error instanceof DemoDataExistsError) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
