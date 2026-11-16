import { describe, expect, it } from "vitest";

import {
  actionProgressText,
  itemProgressText,
  routineBlockerText,
  routineEvidenceText,
} from "@/modules/pdi/labels";

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

describe("routineEvidenceText", () => {
  const adherence = (scheduled: number, done: number, rate: number) => ({
    scheduled,
    done,
    skipped: 0,
    missed: scheduled - done,
    rate,
  });

  it.each([
    [1, adherence(10, 8, 80), "Rotina: 80% de adesão"],
    [2, adherence(4, 3, 75), "2 rotinas: 75% de adesão"],
    [1, adherence(0, 0, 0), "Rotina: nenhum dia para contar ainda"],
  ])("%i routine(s) → %s", (count, value, expected) => {
    expect(routineEvidenceText({ count, adherence: value })).toBe(expected);
  });
});

describe("routineBlockerText", () => {
  it("explains each reason in Portuguese", () => {
    expect(routineBlockerText.CYCLE_CLOSED).toBe("O ciclo desta ação está encerrado.");
    expect(routineBlockerText.ACTION_FINISHED).toBe("Esta ação já foi concluída ou cancelada.");
    expect(routineBlockerText.CATEGORY).toBe("A categoria desta ação não permite criar rotina.");
  });
});
