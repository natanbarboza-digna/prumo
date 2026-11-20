// `npm run pdi:template`: writes the model spreadsheet offered on /pdi/import
// and the spreadsheets the e2e tests upload. Run it again whenever the columns
// in src/modules/pdi/import/sheets.ts change, and commit the results.

import { mkdirSync, writeFileSync } from "node:fs";

import { buildPdiWorkbook } from "../src/modules/pdi/export/workbook";

const date = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

async function write(path: string, buffer: Promise<Buffer>): Promise<void> {
  writeFileSync(path, await buffer);
  console.log(`Gerado: ${path}`);
}

// tsx runs this file as CommonJS, which has no top-level await.
async function main(): Promise<void> {
  mkdirSync("public/templates", { recursive: true });
  mkdirSync("e2e/fixtures", { recursive: true });

  // The model: headers only, plus the instructions sheet.
  await write(
    "public/templates/modelo-pdi.xlsx",
    buildPdiWorkbook({ cycle: [], areas: [], actions: [], checkIns: [] }, { instructions: true }),
  );

  const valid = {
    cycle: [
      {
        title: "PDI importado",
        startDate: date(2030, 1, 1),
        endDate: "30/06/2030",
        status: "Planejado",
        managerName: "Mariana Souza",
        careerObjective: "Conduzir decisões técnicas do time.",
        selfAssessment: null,
        managerFeedback: null,
        finalRating: null,
      },
    ],
    areas: [
      { name: "Comunicação", description: "Falar com segurança.", expectedOutcome: null },
      { name: "Liderança técnica", description: null, expectedOutcome: null },
    ],
    actions: [
      {
        area: "Comunicação",
        category: "Prática",
        title: "Apresentar na reunião semanal",
        description: null,
        expectedResult: null,
        dueDate: date(2030, 3, 31),
        status: "Em andamento",
        evidence: null,
        managerComment: null,
      },
      {
        area: "Liderança técnica",
        category: "Mentoria",
        title: "Mentoria com o tech lead",
        description: null,
        expectedResult: null,
        dueDate: null,
        status: null,
        evidence: null,
        managerComment: null,
      },
    ],
    checkIns: [
      { date: "15/02/2030", summary: "Alinhamento inicial.", nextSteps: null, managerNotes: null },
    ],
  };
  await write("e2e/fixtures/pdi-valido.xlsx", buildPdiWorkbook(valid));

  await write(
    "e2e/fixtures/pdi-categoria-invalida.xlsx",
    buildPdiWorkbook({
      ...valid,
      actions: [{ ...valid.actions[0]!, category: "Workshop" }],
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
