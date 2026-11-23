import { describe, expect, it } from "vitest";

import {
  amountText,
  bookDatesText,
  bookStateLabel,
  paceText,
  positionInputValue,
  positionText,
  progressText,
} from "@/modules/books/labels";

describe("bookStateLabel (plan 035)", () => {
  it("names the queue by the reason and the other statuses by themselves", () => {
    expect(bookStateLabel({ status: "TO_READ", reason: "WORK" })).toBe("Preciso ler");
    expect(bookStateLabel({ status: "TO_READ", reason: "PERSONAL" })).toBe("Quero ler");
    expect(bookStateLabel({ status: "READING", reason: "PDI" })).toBe("Lendo");
    expect(bookStateLabel({ status: "READ", reason: "PERSONAL" })).toBe("Lido");
    expect(bookStateLabel({ status: "ABANDONED", reason: "PERSONAL" })).toBe("Abandonado");
  });
});

describe("bookDatesText", () => {
  it("says when the reading started and ended", () => {
    expect(bookDatesText({ startedOn: null, finishedOn: null })).toBeNull();
    expect(bookDatesText({ startedOn: "2026-11-10", finishedOn: null })).toBe(
      "Começou em 10/11/2026",
    );
    expect(bookDatesText({ startedOn: "2026-11-10", finishedOn: "2026-11-20" })).toBe(
      "De 10/11/2026 a 20/11/2026",
    );
    expect(bookDatesText({ startedOn: null, finishedOn: "2026-11-20" })).toBe(
      "Terminou em 20/11/2026",
    );
  });
});

describe("progress texts (plan 036)", () => {
  it("says where the reading is, in each unit", () => {
    expect(progressText({ unit: "PAGE", position: 120, total: 456, percent: 26 })).toBe(
      "Página 120 de 456 (26%)",
    );
    expect(progressText({ unit: "PAGE", position: 120, total: null, percent: null })).toBe(
      "Página 120",
    );
    expect(progressText({ unit: "PERCENT", position: 45, total: 100, percent: 45 })).toBe(
      "45% lido",
    );
    expect(progressText({ unit: "MINUTE", position: 200, total: 600, percent: 33 })).toBe(
      "3h20 de 10h (33%)",
    );
    expect(progressText({ unit: "MINUTE", position: 200, total: null, percent: null })).toBe(
      "3h20 ouvidos",
    );
    expect(progressText({ unit: "PAGE", position: 0, total: 456, percent: 0 })).toBe(
      "Nenhuma leitura registrada",
    );
  });

  it("says what a day added and the pace", () => {
    expect(amountText("PAGE", 1)).toBe("+1 página");
    expect(amountText("PAGE", 32)).toBe("+32 páginas");
    expect(amountText("PERCENT", 5)).toBe("+5%");
    expect(amountText("MINUTE", 40)).toBe("+40min");
    expect(paceText("PAGE", 17.6)).toBe("Ritmo: 18 páginas por dia");
    expect(paceText("PERCENT", 2.25)).toBe("Ritmo: 2,3% por dia");
    expect(paceText("MINUTE", 24.6)).toBe("Ritmo: 25min por dia");
  });

  it("shows a position the way it was typed", () => {
    expect(positionText("PAGE", 72)).toBe("Página 72");
    expect(positionText("PERCENT", 45)).toBe("45%");
    expect(positionText("MINUTE", 200)).toBe("3h20");
    expect(positionInputValue("MINUTE", 200)).toBe("03:20");
  });
});
