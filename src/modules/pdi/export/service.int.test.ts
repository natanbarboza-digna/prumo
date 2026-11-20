import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { ensureDefaultCategories } from "@/modules/categories/defaults";
import { listCategories } from "@/modules/categories/service";
import { exportCycle } from "@/modules/pdi/export/service";
import { previewPdiImport } from "@/modules/pdi/import/service";
import {
  PdiCycleNotFoundError,
  closeCycle,
  createAction,
  createArea,
  createCheckIn,
  createCycle,
  moveArea,
} from "@/modules/pdi/service";

const MISSING_ID = "0190a3e4-0000-7000-8000-000000000000";

async function categoryId(name: string) {
  const category = (await listCategories()).find((item) => item.name === name);
  if (!category) throw new Error(`No category ${name}`);
  return category.id;
}

/** A planned cycle with two areas (in manual order), three actions and a check-in. */
async function fullCycle() {
  await ensureDefaultCategories(db);
  const cycle = await createCycle({
    title: "PDI 2026/2",
    startDate: "2026-07-01",
    endDate: "2026-12-31",
    status: "PLANNED",
    managerName: "Mariana Souza",
    careerObjective: "Chegar a pleno",
    selfAssessment: null,
    managerFeedback: "Bom ritmo",
    finalRating: null,
  });
  const communication = await createArea(cycle.id, {
    name: "Comunicação",
    description: "Falar em público",
    expectedOutcome: null,
  });
  const leadership = await createArea(cycle.id, {
    name: "Liderança",
    description: null,
    expectedOutcome: "Conduzir decisões",
  });
  // Liderança first: the export follows the manual order (plan 021).
  await moveArea(leadership.id, "up");
  const action = (areaId: string, category: string, title: string, dueDate: string | null) =>
    createAction(cycle.id, {
      areaId,
      categoryId: category,
      title,
      description: null,
      expectedResult: title === "Apresentar" ? "Sem roteiro" : null,
      dueDate,
      status: title === "Apresentar" ? "IN_PROGRESS" : "NOT_STARTED",
      evidence: null,
      managerComment: null,
      goalId: null,
    });
  await action(communication.id, await categoryId("Prática"), "Apresentar", "2026-09-15");
  await action(communication.id, await categoryId("Curso"), "Curso de oratória", null);
  await action(leadership.id, await categoryId("Mentoria"), "Mentoria", "2026-08-01");
  await createCheckIn(cycle.id, {
    date: "2026-08-10",
    summary: "Primeiro check-in",
    nextSteps: "Marcar a apresentação",
    managerNotes: null,
  });
  return cycle;
}

describe("exportCycle (plan 022)", () => {
  it("writes a spreadsheet the import reads back with the same data", async () => {
    const cycle = await fullCycle();

    const { file, fileName } = await exportCycle(cycle.id);
    const result = await previewPdiImport(file);

    expect(fileName).toBe("pdi-pdi-2026-2.xlsx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.cycle).toEqual({
      title: "PDI 2026/2",
      startDate: "2026-07-01",
      endDate: "2026-12-31",
      status: "PLANNED",
      managerName: "Mariana Souza",
      careerObjective: "Chegar a pleno",
      selfAssessment: null,
      managerFeedback: "Bom ritmo",
      finalRating: null,
    });
    expect(result.preview.areas).toMatchObject([
      {
        name: "Liderança",
        description: null,
        expectedOutcome: "Conduzir decisões",
        actions: [{ title: "Mentoria", category: { name: "Mentoria" }, dueDate: "2026-08-01" }],
      },
      {
        name: "Comunicação",
        description: "Falar em público",
        actions: [
          {
            title: "Apresentar",
            category: { name: "Prática" },
            dueDate: "2026-09-15",
            status: "IN_PROGRESS",
            expectedResult: "Sem roteiro",
          },
          { title: "Curso de oratória", category: { name: "Curso" }, dueDate: null },
        ],
      },
    ]);
    expect(result.preview.checkIns).toEqual([
      {
        date: "2026-08-10",
        summary: "Primeiro check-in",
        nextSteps: "Marcar a apresentação",
        managerNotes: null,
      },
    ]);
  });

  it("writes a closed cycle as Encerrado, which the import refuses", async () => {
    const cycle = await fullCycle();
    await closeCycle(cycle.id);

    const result = await previewPdiImport((await exportCycle(cycle.id)).file);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toMatchObject([{ sheet: "Ciclo", field: "Status" }]);
  });

  it("rejects a cycle that does not exist", async () => {
    await expect(exportCycle(MISSING_ID)).rejects.toBeInstanceOf(PdiCycleNotFoundError);
  });
});
