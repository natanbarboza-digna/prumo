// Exports a PDI cycle as a spreadsheet in the import's format (plan 022), so
// exporting and importing again gives back the same cycle: areas and actions in
// the manual order, statuses and categories as the labels the import reads.

import { parseDateOnly } from "@/lib/dates";
import { exportFileName } from "@/modules/pdi/export/file-name";
import { type WorkbookRow, buildPdiWorkbook } from "@/modules/pdi/export/workbook";
import { actionStatusLabels, cycleStatusLabels } from "@/modules/pdi/labels";
import { getCycle } from "@/modules/pdi/service";

/** A date column becomes an Excel date; an empty one stays empty. */
const excelDate = (value: string | null) => (value === null ? null : parseDateOnly(value));

/** The spreadsheet and the name to download it as. Throws PdiCycleNotFoundError. */
export async function exportCycle(id: string): Promise<{ file: Buffer; fileName: string }> {
  const cycle = await getCycle(id);

  const cycleRow: WorkbookRow = {
    title: cycle.title,
    startDate: excelDate(cycle.startDate),
    endDate: excelDate(cycle.endDate),
    status: cycleStatusLabels[cycle.status],
    managerName: cycle.managerName,
    careerObjective: cycle.careerObjective,
    selfAssessment: cycle.selfAssessment,
    managerFeedback: cycle.managerFeedback,
    finalRating: cycle.finalRating,
  };
  const areas: WorkbookRow[] = cycle.areas.map((area) => ({
    name: area.name,
    description: area.description,
    expectedOutcome: area.expectedOutcome,
  }));
  const actions: WorkbookRow[] = cycle.areas.flatMap((area) =>
    area.actions.map((action) => ({
      area: area.name,
      category: action.category.name,
      title: action.title,
      description: action.description,
      expectedResult: action.expectedResult,
      dueDate: excelDate(action.dueDate),
      status: actionStatusLabels[action.status],
      evidence: action.evidence,
      managerComment: action.managerComment,
    })),
  );
  // getCycle lists check-ins newest first; the sheet reads better oldest first.
  const checkIns: WorkbookRow[] = [...cycle.checkIns].reverse().map((checkIn) => ({
    date: excelDate(checkIn.date),
    summary: checkIn.summary,
    nextSteps: checkIn.nextSteps,
    managerNotes: checkIn.managerNotes,
  }));

  const file = await buildPdiWorkbook(
    { cycle: [cycleRow], areas, actions, checkIns },
    { instructions: true },
  );
  return { file, fileName: exportFileName(cycle.title) };
}
