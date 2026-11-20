import { describe, expect, it } from "vitest";

import { groupHeading, moreText } from "@/modules/search/labels";

describe("search labels (plan 027)", () => {
  it("names each group with its count", () => {
    expect(groupHeading("TRACKS", 2)).toBe("Trilhas (2)");
    expect(groupHeading("ACTIONS", 1)).toBe("Ações de PDI (1)");
  });

  it("says how many more results there are, in singular and plural", () => {
    expect(moreText("TRACKS", 1)).toBe("e mais 1 trilha. Refine a busca para ver.");
    expect(moreText("STEPS", 5)).toBe("e mais 5 etapas. Refine a busca para ver.");
  });
});
