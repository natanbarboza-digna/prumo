// Builds PDI spreadsheets in the model's format (plan 013). Development only:
// write-excel-file is a devDependency, so app code never imports this file.
// Used by the import tests and by scripts/generate-pdi-template.ts.

import writeExcelFile, { type Sheet } from "write-excel-file/node";

import { INSTRUCTIONS_SHEET, SHEETS, type SheetKey } from "@/modules/pdi/import/sheets";

/** One object per row, keyed by field (as in SHEETS); a Date becomes an Excel date. */
export type WorkbookRow = Record<string, string | Date | null>;

export type WorkbookContent = Partial<Record<SheetKey, WorkbookRow[]>>;

const header = (titles: readonly string[]) =>
  titles.map((title) => ({ value: title, fontWeight: "bold" as const }));

/** The model's sheets that appear in `content` (in model order), plus the instructions if asked. */
export async function buildPdiWorkbook(
  content: WorkbookContent,
  options: { instructions?: boolean } = {},
): Promise<Buffer> {
  const sheets: Sheet<Buffer>[] = [];
  for (const [key, def] of Object.entries(SHEETS) as [SheetKey, (typeof SHEETS)[SheetKey]][]) {
    const rows = content[key];
    if (rows === undefined) continue;
    sheets.push({
      sheet: def.name,
      dateFormat: "dd/mm/yyyy",
      stickyRowsCount: 1,
      columns: def.columns.map((col) => ({ width: col.kind === "text" ? 30 : 14 })),
      data: [
        header(def.columns.map((col) => col.title)),
        ...rows.map((row) => def.columns.map((col) => row[col.key] ?? null)),
      ],
    });
  }
  if (options.instructions) sheets.push(instructionsSheet());
  return writeExcelFile(sheets).toBuffer();
}

function instructionsSheet(): Sheet<Buffer> {
  const rows: (string | null)[][] = [
    ["Como preencher"],
    ["Preencha as abas Ciclo (uma linha), Áreas e Ações. Check-ins é opcional."],
    ["Não mude os nomes das abas nem os títulos das colunas. Linhas vazias são ignoradas."],
    ["Datas: use o formato dd/mm/aaaa. Na aba Ações, Área e Categoria são nomes, não códigos."],
    [
      "Categorias padrão do app: Prática, Curso, Leitura e Mentoria (use também as que você cadastrou).",
    ],
    ["Se algo estiver errado, nada é importado e o app mostra a aba, a linha e o campo."],
    [null],
  ];
  for (const def of Object.values(SHEETS)) {
    rows.push([`Aba ${def.name}${def.required ? "" : " (opcional)"}`, null]);
    for (const col of def.columns) rows.push([col.title, col.help]);
    rows.push([null, null]);
  }
  return {
    sheet: INSTRUCTIONS_SHEET,
    columns: [{ width: 28 }, { width: 90 }],
    data: rows.map((row, index) =>
      row.map((value) =>
        value !== null && (index === 0 || value.startsWith("Aba "))
          ? { value, fontWeight: "bold" as const }
          : value,
      ),
    ),
  };
}
