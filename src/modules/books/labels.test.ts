import { describe, expect, it } from "vitest";

import { bookStateLabel, bookDatesText } from "@/modules/books/labels";

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
