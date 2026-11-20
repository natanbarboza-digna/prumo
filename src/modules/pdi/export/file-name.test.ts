import { describe, expect, it } from "vitest";

import { exportFileName } from "@/modules/pdi/export/file-name";

describe("exportFileName", () => {
  it("turns the cycle title into a file name without accents, spaces or symbols", () => {
    expect(exportFileName("PDI 2026/1")).toBe("pdi-pdi-2026-1.xlsx");
    expect(exportFileName("  Ciclo de Comunicação — Março!  ")).toBe(
      "pdi-ciclo-de-comunicacao-marco.xlsx",
    );
  });

  it("falls back to a plain name when nothing is left of the title", () => {
    expect(exportFileName("???")).toBe("pdi.xlsx");
  });
});
