// Fixtures for integration tests that need a PDI action (routines linked to
// actions, evidence). Every call creates its own cycle, area and category.

import type { PdiActionStatus, PdiCycleStatus } from "@/generated/prisma/enums";
import { createCategory } from "@/modules/categories/service";
import { createAction, createArea, createCycle } from "@/modules/pdi/service";

let counter = 0;

export async function pdiActionFixture(
  options: {
    allowsRoutine?: boolean;
    status?: PdiActionStatus;
    cycleStatus?: Exclude<PdiCycleStatus, "CLOSED">;
    cycle?: { startDate: string; endDate: string };
    dueDate?: string | null;
    goalId?: string | null;
  } = {},
) {
  counter++;
  const cycle = await createCycle({
    title: `PDI ${counter}`,
    startDate: options.cycle?.startDate ?? "2026-01-01",
    endDate: options.cycle?.endDate ?? "2026-12-31",
    status: options.cycleStatus ?? "PLANNED",
    managerName: null,
    careerObjective: null,
    selfAssessment: null,
    managerFeedback: null,
    finalRating: null,
  });
  const area = await createArea(cycle.id, {
    name: "Área",
    description: null,
    expectedOutcome: null,
  });
  const category = await createCategory({
    name: `Categoria ${counter}`,
    allowsRoutine: options.allowsRoutine ?? true,
  });
  const action = await createAction(cycle.id, {
    areaId: area.id,
    categoryId: category.id,
    title: "Praticar oratória",
    description: null,
    expectedResult: null,
    dueDate: options.dueDate ?? null,
    status: options.status ?? "IN_PROGRESS",
    evidence: null,
    managerComment: null,
    goalId: options.goalId ?? null,
  });
  return { cycle, area, category, action };
}
