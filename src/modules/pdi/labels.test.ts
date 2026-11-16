import { describe, expect, it } from "vitest";

import { actionProgressText, itemProgressText } from "@/modules/pdi/labels";

describe("actionProgressText", () => {
  it.each([
    [0, 0, "Nenhuma ação ainda"],
    [0, 1, "0 de 1 ação concluída"],
    [1, 3, "1 de 3 ações concluídas"],
  ])("%i of %i → %s", (done, total, expected) => {
    expect(actionProgressText(done, total)).toBe(expected);
  });
});

describe("itemProgressText", () => {
  it.each([
    [0, 0, "Nenhum item vinculado ainda"],
    [1, 1, "1 de 1 item concluído"],
    [3, 5, "3 de 5 itens concluídos"],
  ])("%i of %i → %s", (done, total, expected) => {
    expect(itemProgressText(done, total)).toBe(expected);
  });
});
