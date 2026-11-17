// The spreadsheet model: which sheets and columns it has, and how its rows
// become plain objects. Shared by the import and by the script that generates
// public/templates/modelo-pdi.xlsx, so both always agree. Pure: no file access.

import type { Cell } from "@/modules/pdi/import/values";

export type ColumnKind = "text" | "date" | "status";

export type ColumnDef = {
  /** Field name, the same as in the PDI form schemas. */
  key: string;
  /** Header in the spreadsheet: the same label as in the forms. */
  title: string;
  kind: ColumnKind;
  /** Shown in the "Instruções" sheet. */
  help: string;
};

export type SheetDef = { name: string; required: boolean; columns: readonly ColumnDef[] };

const column = (key: string, title: string, help: string, kind: ColumnKind = "text") => ({
  key,
  title,
  kind,
  help,
});

export const SHEETS = {
  cycle: {
    name: "Ciclo",
    required: true,
    columns: [
      column("title", "Título", "Obrigatório. Até 120 caracteres."),
      column("startDate", "Início", "Obrigatório. Data (dd/mm/aaaa).", "date"),
      column("endDate", "Fim", "Obrigatório. Data (dd/mm/aaaa), não antes do início.", "date"),
      column("status", "Status", "Planejado ou Ativo. Vazio: Planejado.", "status"),
      column("managerName", "Gestor", "Opcional."),
      column("careerObjective", "Objetivo de carreira", "Opcional."),
      column("selfAssessment", "Autoavaliação", "Opcional."),
      column("managerFeedback", "Feedback do gestor", "Opcional."),
      column("finalRating", "Avaliação final", "Opcional. Até 60 caracteres."),
    ],
  },
  areas: {
    name: "Áreas",
    required: true,
    columns: [
      column("name", "Nome", "Obrigatório. Cada área com um nome diferente."),
      column("description", "Descrição", "Opcional."),
      column("expectedOutcome", "Resultado esperado", "Opcional."),
    ],
  },
  actions: {
    name: "Ações",
    required: true,
    columns: [
      column("area", "Área", "Obrigatório. O nome de uma área da aba Áreas."),
      column("category", "Categoria", "Obrigatório. O nome de uma categoria cadastrada no app."),
      column("title", "Título", "Obrigatório. Até 160 caracteres."),
      column("description", "Descrição", "Opcional."),
      column("expectedResult", "Resultado esperado", "Opcional."),
      column("dueDate", "Prazo", "Opcional. Data (dd/mm/aaaa).", "date"),
      column(
        "status",
        "Status",
        "Não iniciada, Em andamento, Concluída ou Cancelada. Vazio: Não iniciada.",
        "status",
      ),
      column("evidence", "Evidência", "Opcional."),
      column("managerComment", "Comentário do gestor", "Opcional."),
    ],
  },
  checkIns: {
    name: "Check-ins",
    required: false,
    columns: [
      column("date", "Data", "Obrigatório. Data (dd/mm/aaaa).", "date"),
      column("summary", "Resumo", "Obrigatório."),
      column("nextSteps", "Próximos passos", "Opcional."),
      column("managerNotes", "Anotações do gestor", "Opcional."),
    ],
  },
} as const satisfies Record<string, SheetDef>;

export type SheetKey = keyof typeof SHEETS;

export const INSTRUCTIONS_SHEET = "Instruções";

/** A problem found in the file, located as precisely as possible. */
export type ImportIssue = {
  sheet: string;
  /** Spreadsheet line (1 is the header); null for the whole sheet or file. */
  line: number | null;
  /** Column title; null for the whole row or sheet. */
  field: string | null;
  message: string;
};

export type SheetRow = { line: number; cells: Record<string, Cell> };

type RawSheet = { sheet: string; data: Cell[][] };

/** The model's sheets present in the file; a missing required one is an issue. */
export function findSheets(file: readonly RawSheet[]): {
  sheets: Partial<Record<SheetKey, Cell[][]>>;
  issues: ImportIssue[];
} {
  const sheets: Partial<Record<SheetKey, Cell[][]>> = {};
  const issues: ImportIssue[] = [];
  for (const [key, def] of Object.entries(SHEETS) as [SheetKey, SheetDef][]) {
    const found = file.find((sheet) => sheet.sheet.trim() === def.name);
    if (found) sheets[key] = found.data;
    else if (def.required) {
      issues.push({
        sheet: def.name,
        line: null,
        field: null,
        message: "A planilha não tem esta aba. Use a planilha modelo.",
      });
    }
  }
  return { sheets, issues };
}

function isBlank(cell: Cell | undefined): boolean {
  return cell === null || cell === undefined || (typeof cell === "string" && cell.trim() === "");
}

/**
 * The rows under the header as cells keyed by field. The header must have
 * exactly the model's columns (in any order); empty rows are skipped.
 */
export function readRows(
  def: SheetDef,
  data: readonly (readonly Cell[])[],
): { rows: SheetRow[]; issues: ImportIssue[] } {
  const header = data[0];
  if (!header || header.every(isBlank)) {
    return {
      rows: [],
      issues: [
        {
          sheet: def.name,
          line: 1,
          field: null,
          message: "A aba está vazia. Use a planilha modelo.",
        },
      ],
    };
  }

  const titles = header.map((cell) => (isBlank(cell) ? null : String(cell).trim()));
  const issues: ImportIssue[] = [];
  for (const col of def.columns) {
    if (!titles.includes(col.title)) {
      issues.push({
        sheet: def.name,
        line: 1,
        field: col.title,
        message: "Falta a coluna. Use a planilha modelo.",
      });
    }
  }
  for (const title of titles) {
    if (title !== null && !def.columns.some((col) => col.title === title)) {
      issues.push({
        sheet: def.name,
        line: 1,
        field: title,
        message: "Esta coluna não faz parte da planilha modelo.",
      });
    }
  }
  if (issues.length > 0) return { rows: [], issues };

  const rows: SheetRow[] = [];
  data.slice(1).forEach((row, index) => {
    if (row.every(isBlank)) return;
    const cells: Record<string, Cell> = {};
    for (const col of def.columns) {
      const cell = row[titles.indexOf(col.title)];
      cells[col.key] = cell === undefined ? null : cell;
    }
    rows.push({ line: index + 2, cells });
  });
  return { rows, issues };
}
