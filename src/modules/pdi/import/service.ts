// Imports a whole PDI cycle from the model spreadsheet (plan 013): reads the
// file, validates every row with the same Zod schemas as the forms, checks the
// references (areas, categories, active cycle) and only then writes, in one
// nested create. Any problem means nothing is created.

import readXlsxFile from "read-excel-file/node";
import type { z } from "zod";

import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";
import { listCategories } from "@/modules/categories/service";
import {
  type ImportIssue,
  SHEETS,
  type SheetDef,
  type SheetKey,
  type SheetRow,
  findSheets,
  readRows,
} from "@/modules/pdi/import/sheets";
import { type Cell, cellText, parseDateCell, parseLabel } from "@/modules/pdi/import/values";
import { actionStatusLabels, cycleStatusLabels } from "@/modules/pdi/labels";
import {
  actionInputSchema,
  areaInputSchema,
  checkInInputSchema,
  cycleInputSchema,
} from "@/modules/pdi/schemas";
import { toCheckInData, toCycleData } from "@/modules/pdi/service";

export type ImportResult = { ok: true; cycleId: string } | { ok: false; issues: ImportIssue[] };

/** The action fields that come straight from the sheet (area and category are names, resolved below). */
const actionFieldsSchema = actionInputSchema.pick({
  title: true,
  description: true,
  expectedResult: true,
  dueDate: true,
  status: true,
  evidence: true,
  managerComment: true,
});

/** Names match regardless of case and surrounding spaces, but accents count. */
const key = (name: string) => name.trim().toLocaleLowerCase("pt-BR");

export async function importPdi(file: Buffer): Promise<ImportResult> {
  let raw: { sheet: string; data: Cell[][] }[];
  try {
    // read-excel-file's cell type declares dates as `typeof Date`; at runtime they are Date objects.
    raw = (await readXlsxFile(file)) as unknown as { sheet: string; data: Cell[][] }[];
  } catch {
    return fileIssue("O arquivo não é uma planilha .xlsx. Use a planilha modelo.");
  }

  const found = findSheets(raw);
  if (found.issues.length > 0) return { ok: false, issues: found.issues };

  const issues: ImportIssue[] = [];
  const read = (sheet: SheetKey): SheetRow[] => {
    const data = found.sheets[sheet];
    if (data === undefined) return [];
    const result = readRows(SHEETS[sheet], data);
    issues.push(...result.issues);
    return result.rows;
  };
  const cycleRows = read("cycle");
  const areaRows = read("areas");
  const actionRows = read("actions");
  const checkInRows = read("checkIns");
  // A wrong header makes every row meaningless: stop at the header issues.
  if (issues.length > 0) return { ok: false, issues };

  // --- Cycle ---------------------------------------------------------------
  if (cycleRows.length !== 1) {
    issues.push(sheetIssue("cycle", "A aba Ciclo precisa ter exatamente uma linha de dados."));
  }
  const cycleRow = cycleRows.length === 1 ? cycleRows[0] : undefined;
  const cycle = cycleRow ? validate("cycle", cycleRow, cycleInputSchema, issues) : null;
  if (cycle?.status === "ACTIVE" && cycleRow) {
    const active = await db.pdiCycle.count({ where: { status: "ACTIVE" } });
    if (active > 0) {
      issues.push(
        rowIssue(
          "cycle",
          cycleRow,
          "Status",
          "Já existe um ciclo ativo. Importe como Planejado ou encerre o ciclo atual.",
        ),
      );
    }
  }

  // --- Areas ---------------------------------------------------------------
  if (areaRows.length === 0) issues.push(sheetIssue("areas", "Cadastre pelo menos uma área."));
  const areas: { name: string; data: z.output<typeof areaInputSchema> }[] = [];
  const areaLines = new Map<string, number>();
  for (const row of areaRows) {
    const area = validate("areas", row, areaInputSchema, issues);
    if (!area) continue;
    const firstLine = areaLines.get(key(area.name));
    if (firstLine !== undefined) {
      issues.push(
        rowIssue(
          "areas",
          row,
          "Nome",
          `“${area.name}” já aparece na linha ${firstLine}. Cada área precisa de um nome diferente.`,
        ),
      );
      continue;
    }
    areaLines.set(key(area.name), row.line);
    areas.push({ name: area.name, data: area });
  }

  // --- Actions -------------------------------------------------------------
  const categories = await listCategories();
  const available = categories
    .filter((category) => !category.archived)
    .map((category) => category.name)
    .join(", ");
  const actions: { area: string; categoryId: string; data: z.output<typeof actionFieldsSchema> }[] =
    [];
  for (const row of actionRows) {
    const fields = validate("actions", row, actionFieldsSchema, issues);
    const areaName = cellText(row.cells.area ?? null).trim();
    const categoryName = cellText(row.cells.category ?? null).trim();

    let areaOk = true;
    if (areaName === "") {
      issues.push(rowIssue("actions", row, "Área", "Informe a área."));
      areaOk = false;
    } else if (!areaLines.has(key(areaName)) && !areaRows.some((r) => sameArea(r, areaName))) {
      issues.push(rowIssue("actions", row, "Área", `“${areaName}” não está na aba Áreas.`));
      areaOk = false;
    }

    const category = categories.find((item) => key(item.name) === key(categoryName));
    let categoryId: string | null = null;
    if (categoryName === "") {
      issues.push(rowIssue("actions", row, "Categoria", "Informe a categoria."));
    } else if (!category) {
      issues.push(
        rowIssue(
          "actions",
          row,
          "Categoria",
          `“${categoryName}” não existe. Categorias disponíveis: ${available}.`,
        ),
      );
    } else if (category.archived) {
      issues.push(
        rowIssue(
          "actions",
          row,
          "Categoria",
          `“${category.name}” está arquivada e não pode receber ações novas.`,
        ),
      );
    } else {
      categoryId = category.id;
    }

    if (fields && areaOk && categoryId !== null) {
      actions.push({ area: areaName, categoryId, data: fields });
    }
  }

  // --- Check-ins -----------------------------------------------------------
  const checkIns = checkInRows.flatMap((row) => {
    const checkIn = validate("checkIns", row, checkInInputSchema, issues);
    return checkIn ? [checkIn] : [];
  });

  if (issues.length > 0 || !cycle) return { ok: false, issues };

  // One nested create: Prisma writes the cycle and everything under it in a
  // single transaction, so a failure leaves nothing behind.
  const created = await db.pdiCycle.create({
    data: {
      ...toCycleData(cycle),
      areas: {
        create: areas.map((area) => ({
          ...area.data,
          actions: {
            create: actions
              .filter((action) => key(action.area) === key(area.name))
              .map((action) => ({
                ...action.data,
                categoryId: action.categoryId,
                dueDate: action.data.dueDate === null ? null : parseDateOnly(action.data.dueDate),
              })),
          },
        })),
      },
      checkIns: { create: checkIns.map(toCheckInData) },
    },
    select: { id: true },
  });
  return { ok: true, cycleId: created.id };
}

/** True when the row of the Áreas sheet has this name (used when that row itself had errors). */
function sameArea(row: SheetRow, name: string): boolean {
  return key(cellText(row.cells.name ?? null)) === key(name);
}

/**
 * Converts the row's cells (dates, status labels) and parses them with the
 * form schema. Problems become issues with the column title; null when invalid.
 */
function validate<S extends z.ZodType>(
  sheet: SheetKey,
  row: SheetRow,
  schema: S,
  issues: ImportIssue[],
): z.output<S> | null {
  const def: SheetDef = SHEETS[sheet];
  const input: Record<string, string | undefined> = {};
  const failed = new Set<string>();
  const before = issues.length;

  for (const col of def.columns) {
    const cell = row.cells[col.key] ?? null;
    if (col.kind === "text") {
      input[col.key] = cellText(cell);
      continue;
    }
    const converted =
      col.kind === "date"
        ? parseDateCell(cell)
        : sheet === "cycle"
          ? parseLabel(cell, cycleStatusLabels, ["PLANNED", "ACTIVE"])
          : parseLabel(cell, actionStatusLabels);
    if (converted.ok) {
      input[col.key] = converted.value;
    } else {
      failed.add(col.key);
      issues.push(rowIssue(sheet, row, col.title, converted.message));
    }
  }

  const result = schema.safeParse(input);
  if (result.success) return issues.length === before ? result.data : null;
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "");
    if (failed.has(field)) continue;
    const title = def.columns.find((col) => col.key === field)?.title ?? null;
    issues.push({ sheet: def.name, line: row.line, field: title, message: issue.message });
  }
  return null;
}

function rowIssue(sheet: SheetKey, row: SheetRow, field: string, message: string): ImportIssue {
  return { sheet: SHEETS[sheet].name, line: row.line, field, message };
}

function sheetIssue(sheet: SheetKey, message: string): ImportIssue {
  return { sheet: SHEETS[sheet].name, line: null, field: null, message };
}

function fileIssue(message: string): ImportResult {
  return { ok: false, issues: [{ sheet: "Arquivo", line: null, field: null, message }] };
}
