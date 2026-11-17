import { describe, expect, it } from "vitest";

import { SHEETS, findSheets, readRows } from "@/modules/pdi/import/sheets";

const areasHeader = ["Nome", "Descrição", "Resultado esperado"];

describe("readRows", () => {
  it("turns rows under the model's header into cells keyed by field, with their line", () => {
    const { rows, issues } = readRows(SHEETS.areas, [
      areasHeader,
      ["Comunicação", "Falar melhor", null],
      ["Liderança", null, "Conduzir o time"],
    ]);

    expect(issues).toEqual([]);
    expect(rows).toEqual([
      {
        line: 2,
        cells: { name: "Comunicação", description: "Falar melhor", expectedOutcome: null },
      },
      {
        line: 3,
        cells: { name: "Liderança", description: null, expectedOutcome: "Conduzir o time" },
      },
    ]);
  });

  it("accepts the columns in any order", () => {
    const { rows, issues } = readRows(SHEETS.areas, [
      ["Resultado esperado", "Nome", "Descrição"],
      ["Conduzir o time", "Liderança", null],
    ]);

    expect(issues).toEqual([]);
    expect(rows[0]?.cells).toEqual({
      name: "Liderança",
      description: null,
      expectedOutcome: "Conduzir o time",
    });
  });

  it("skips empty rows but keeps the line numbers of the others", () => {
    const { rows } = readRows(SHEETS.areas, [
      areasHeader,
      [null, null, null],
      ["  ", null, ""],
      ["Comunicação", null, null],
    ]);

    expect(rows.map((row) => row.line)).toEqual([4]);
  });

  it("refuses a header that is not the model's, naming the sheet and the column", () => {
    const { rows, issues } = readRows(SHEETS.areas, [
      ["Nome", "Observações"],
      ["Comunicação", "x"],
    ]);

    expect(rows).toEqual([]);
    expect(issues).toEqual([
      {
        sheet: "Áreas",
        line: 1,
        field: "Descrição",
        message: "Falta a coluna. Use a planilha modelo.",
      },
      {
        sheet: "Áreas",
        line: 1,
        field: "Resultado esperado",
        message: "Falta a coluna. Use a planilha modelo.",
      },
      {
        sheet: "Áreas",
        line: 1,
        field: "Observações",
        message: "Esta coluna não faz parte da planilha modelo.",
      },
    ]);
  });

  it("refuses a sheet without a header", () => {
    expect(readRows(SHEETS.areas, []).issues).toEqual([
      {
        sheet: "Áreas",
        line: 1,
        field: null,
        message: "A aba está vazia. Use a planilha modelo.",
      },
    ]);
  });
});

describe("findSheets", () => {
  const sheet = (name: string) => ({ sheet: name, data: [] });

  it("finds each sheet by name and accepts a missing optional one", () => {
    const { sheets, issues } = findSheets([sheet("Ciclo"), sheet("Áreas"), sheet("Ações")]);

    expect(issues).toEqual([]);
    expect(Object.keys(sheets)).toEqual(["cycle", "areas", "actions"]);
  });

  it("refuses a file without a required sheet", () => {
    const { issues } = findSheets([sheet("Ciclo"), sheet("Planilha1")]);

    expect(issues).toEqual([
      {
        sheet: "Áreas",
        line: null,
        field: null,
        message: "A planilha não tem esta aba. Use a planilha modelo.",
      },
      {
        sheet: "Ações",
        line: null,
        field: null,
        message: "A planilha não tem esta aba. Use a planilha modelo.",
      },
    ]);
  });
});
