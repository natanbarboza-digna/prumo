import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { ensureDefaultCategories } from "@/modules/categories/defaults";
import { setCategoryArchived } from "@/modules/categories/service";
import { importPdi } from "@/modules/pdi/import/service";
import { createCycle, getCycle } from "@/modules/pdi/service";
import { type WorkbookContent, type WorkbookRow, buildPdiWorkbook } from "@/test/pdi-workbook";

const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

const cycleRow: WorkbookRow = {
  title: "PDI 2027/1",
  startDate: utc(2027, 1, 1),
  endDate: "30/06/2027",
  status: "Planejado",
  managerName: "Mariana Souza",
  careerObjective: "Chegar a pleno",
  selfAssessment: null,
  managerFeedback: null,
  finalRating: null,
};

function content(overrides: WorkbookContent = {}): WorkbookContent {
  return {
    cycle: [cycleRow],
    areas: [
      { name: "Comunicação", description: "Falar em público", expectedOutcome: null },
      { name: "Liderança técnica", description: null, expectedOutcome: "Conduzir decisões" },
    ],
    actions: [
      {
        area: "Comunicação",
        category: "Prática",
        title: "Praticar apresentações",
        description: null,
        expectedResult: "Apresentar sem roteiro",
        dueDate: utc(2027, 3, 15),
        status: "Em andamento",
        evidence: null,
        managerComment: null,
      },
      {
        // Area and category names match regardless of case and surrounding spaces.
        area: " liderança TÉCNICA ",
        category: "curso",
        title: "Curso de arquitetura",
        description: null,
        expectedResult: null,
        dueDate: null,
        status: null,
        evidence: null,
        managerComment: null,
      },
    ],
    checkIns: [
      { date: "15/02/2027", summary: "Início do ciclo", nextSteps: null, managerNotes: null },
    ],
    ...overrides,
  };
}

async function run(workbook: WorkbookContent) {
  return importPdi(await buildPdiWorkbook(workbook));
}

async function expectNothingCreated() {
  await expect(db.pdiCycle.count()).resolves.toBe(0);
  await expect(db.pdiArea.count()).resolves.toBe(0);
  await expect(db.pdiAction.count()).resolves.toBe(0);
}

describe("importPdi", () => {
  it("creates the cycle with its areas, actions and check-ins", async () => {
    await ensureDefaultCategories(db);

    const result = await run(content());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cycle = await getCycle(result.cycleId);
    expect(cycle).toMatchObject({
      title: "PDI 2027/1",
      startDate: "2027-01-01",
      endDate: "2027-06-30",
      status: "PLANNED",
      managerName: "Mariana Souza",
      careerObjective: "Chegar a pleno",
      selfAssessment: null,
    });
    expect(cycle.areas.map((area) => area.name)).toEqual(["Comunicação", "Liderança técnica"]);
    expect(cycle.areas[0]?.actions).toMatchObject([
      {
        title: "Praticar apresentações",
        category: { name: "Prática" },
        dueDate: "2027-03-15",
        status: "IN_PROGRESS",
        expectedResult: "Apresentar sem roteiro",
      },
    ]);
    expect(cycle.areas[1]?.actions).toMatchObject([
      { title: "Curso de arquitetura", category: { name: "Curso" }, status: "NOT_STARTED" },
    ]);
    expect(cycle.checkIns).toMatchObject([{ date: "2027-02-15", summary: "Início do ciclo" }]);
  });

  it("keeps the order of the rows for areas and actions (plan 021)", async () => {
    await ensureDefaultCategories(db);
    const action = (area: string, title: string, dueDate: Date | null) => ({
      area,
      category: "Curso",
      title,
      description: null,
      expectedResult: null,
      dueDate,
      status: null,
      evidence: null,
      managerComment: null,
    });

    const result = await run(
      content({
        areas: [
          { name: "Zeta", description: null, expectedOutcome: null },
          { name: "Alfa", description: null, expectedOutcome: null },
        ],
        // Due dates out of order and areas interleaved: the rows decide.
        actions: [
          action("Alfa", "Sem prazo", null),
          action("Zeta", "Primeira da Zeta", utc(2027, 5, 1)),
          action("Alfa", "Dezembro", utc(2027, 12, 1)),
          action("Alfa", "Março", utc(2027, 3, 1)),
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cycle = await getCycle(result.cycleId);
    expect(cycle.areas.map((area) => area.name)).toEqual(["Zeta", "Alfa"]);
    expect(cycle.areas[1]?.actions.map((item) => item.title)).toEqual([
      "Sem prazo",
      "Dezembro",
      "Março",
    ]);
  });

  it("accepts a file without the optional Check-ins sheet", async () => {
    await ensureDefaultCategories(db);
    const withoutCheckIns = content();
    delete withoutCheckIns.checkIns;

    const result = await run(withoutCheckIns);

    expect(result.ok).toBe(true);
  });

  it("refuses an unknown category, saying which ones exist, and creates nothing", async () => {
    await ensureDefaultCategories(db);
    const workbook = content();
    workbook.actions = [{ ...workbook.actions![0]!, category: "Workshop" }];

    const result = await run(workbook);

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          sheet: "Ações",
          line: 2,
          field: "Categoria",
          message:
            "“Workshop” não existe. Categorias disponíveis: Curso, Leitura, Mentoria, Prática.",
        },
      ],
    });
    await expectNothingCreated();
  });

  it("refuses an archived category", async () => {
    await ensureDefaultCategories(db);
    const reading = await db.actionCategory.findUniqueOrThrow({ where: { name: "Leitura" } });
    await setCategoryArchived(reading.id, true);
    const workbook = content();
    workbook.actions = [{ ...workbook.actions![0]!, category: "Leitura" }];

    const result = await run(workbook);

    expect(!result.ok && result.issues).toEqual([
      {
        sheet: "Ações",
        line: 2,
        field: "Categoria",
        message: "“Leitura” está arquivada e não pode receber ações novas.",
      },
    ]);
    await expectNothingCreated();
  });

  it("refuses an action whose area is not in the Áreas sheet, and repeated areas", async () => {
    await ensureDefaultCategories(db);
    const workbook = content({
      areas: [
        { name: "Comunicação", description: null, expectedOutcome: null },
        { name: "comunicação", description: null, expectedOutcome: null },
      ],
    });
    workbook.actions = [{ ...workbook.actions![0]!, area: "Lideranca" }];

    const result = await run(workbook);

    expect(!result.ok && result.issues).toEqual([
      {
        sheet: "Áreas",
        line: 3,
        field: "Nome",
        message: "“comunicação” já aparece na linha 2. Cada área precisa de um nome diferente.",
      },
      {
        sheet: "Ações",
        line: 2,
        field: "Área",
        message: "“Lideranca” não está na aba Áreas.",
      },
    ]);
    await expectNothingCreated();
  });

  it("reports invalid fields with the form's messages, sheet, line and column", async () => {
    await ensureDefaultCategories(db);
    const workbook = content({
      cycle: [{ ...cycleRow, title: null, endDate: "31/02/2027", status: "Encerrado" }],
    });
    workbook.actions = [{ ...workbook.actions![0]!, title: "  ", dueDate: "amanhã" }];

    const result = await run(workbook);

    expect(!result.ok && result.issues).toEqual([
      { sheet: "Ciclo", line: 2, field: "Fim", message: "Use uma data no formato dd/mm/aaaa." },
      { sheet: "Ciclo", line: 2, field: "Status", message: "Use um destes: Planejado, Ativo." },
      { sheet: "Ciclo", line: 2, field: "Título", message: "Informe um título." },
      { sheet: "Ações", line: 2, field: "Prazo", message: "Use uma data no formato dd/mm/aaaa." },
      { sheet: "Ações", line: 2, field: "Título", message: "Informe um título." },
    ]);
    await expectNothingCreated();
  });

  it("needs exactly one cycle row and at least one area", async () => {
    await ensureDefaultCategories(db);

    const result = await run(content({ cycle: [cycleRow, cycleRow], areas: [], actions: [] }));

    expect(!result.ok && result.issues).toEqual([
      {
        sheet: "Ciclo",
        line: null,
        field: null,
        message: "A aba Ciclo precisa ter exatamente uma linha de dados.",
      },
      {
        sheet: "Áreas",
        line: null,
        field: null,
        message: "Cadastre pelo menos uma área.",
      },
    ]);
  });

  it("refuses an active cycle when another one is already active", async () => {
    await ensureDefaultCategories(db);
    await createCycle({
      title: "Atual",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "ACTIVE",
      managerName: null,
      careerObjective: null,
      selfAssessment: null,
      managerFeedback: null,
      finalRating: null,
    });

    const result = await run(content({ cycle: [{ ...cycleRow, status: "Ativo" }] }));

    expect(!result.ok && result.issues).toEqual([
      {
        sheet: "Ciclo",
        line: 2,
        field: "Status",
        message: "Já existe um ciclo ativo. Importe como Planejado ou encerre o ciclo atual.",
      },
    ]);
    await expect(db.pdiCycle.count()).resolves.toBe(1);
  });

  it("refuses a file that is not a spreadsheet, or lacks the model's sheets", async () => {
    await expect(importPdi(Buffer.from("isto não é uma planilha"))).resolves.toEqual({
      ok: false,
      issues: [
        {
          sheet: "Arquivo",
          line: null,
          field: null,
          message: "O arquivo não é uma planilha .xlsx. Use a planilha modelo.",
        },
      ],
    });

    const result = await run({ cycle: [cycleRow] });
    expect(!result.ok && result.issues.map((issue) => issue.sheet)).toEqual(["Áreas", "Ações"]);
  });
});
