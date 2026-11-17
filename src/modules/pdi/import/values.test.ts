import { describe, expect, it } from "vitest";

import { actionStatusLabels, cycleStatusLabels } from "@/modules/pdi/labels";
import { cellText, parseDateCell, parseLabel } from "@/modules/pdi/import/values";

describe("parseDateCell", () => {
  it("reads an Excel date (a Date at midnight UTC) as YYYY-MM-DD", () => {
    expect(parseDateCell(new Date(Date.UTC(2026, 2, 5)))).toEqual({
      ok: true,
      value: "2026-03-05",
    });
  });

  it("reads dd/mm/aaaa text, with or without leading zeros", () => {
    expect(parseDateCell("05/03/2026")).toEqual({ ok: true, value: "2026-03-05" });
    expect(parseDateCell(" 5/3/2026 ")).toEqual({ ok: true, value: "2026-03-05" });
  });

  it("treats an empty cell as no date", () => {
    expect(parseDateCell(null)).toEqual({ ok: true, value: "" });
    expect(parseDateCell("  ")).toEqual({ ok: true, value: "" });
  });

  it("refuses dates that do not exist or are not dates", () => {
    const message = "Use uma data no formato dd/mm/aaaa.";
    expect(parseDateCell("31/02/2026")).toEqual({ ok: false, message });
    expect(parseDateCell("março")).toEqual({ ok: false, message });
    expect(parseDateCell("2026-03-05")).toEqual({ ok: false, message });
    expect(parseDateCell(45000)).toEqual({ ok: false, message });
  });
});

describe("parseLabel", () => {
  it("turns a status label into its value, ignoring accents, case and spaces", () => {
    expect(parseLabel("Em andamento", actionStatusLabels)).toEqual({
      ok: true,
      value: "IN_PROGRESS",
    });
    expect(parseLabel("  nao iniciada ", actionStatusLabels)).toEqual({
      ok: true,
      value: "NOT_STARTED",
    });
    expect(parseLabel("ATIVO", cycleStatusLabels)).toEqual({ ok: true, value: "ACTIVE" });
  });

  it("leaves an empty cell empty, so the schema default applies", () => {
    expect(parseLabel(null, actionStatusLabels)).toEqual({ ok: true, value: undefined });
  });

  it("refuses an unknown label, listing the accepted ones", () => {
    expect(parseLabel("Pausada", actionStatusLabels)).toEqual({
      ok: false,
      message: "Use um destes: Não iniciada, Em andamento, Concluída, Cancelada.",
    });
  });

  it("can limit the accepted values (a new cycle cannot start closed)", () => {
    expect(parseLabel("Encerrado", cycleStatusLabels, ["PLANNED", "ACTIVE"])).toEqual({
      ok: false,
      message: "Use um destes: Planejado, Ativo.",
    });
  });
});

describe("cellText", () => {
  it("returns text as is, numbers as text and empty cells as empty text", () => {
    expect(cellText("Comunicação")).toBe("Comunicação");
    expect(cellText(2026)).toBe("2026");
    expect(cellText(null)).toBe("");
  });
});
