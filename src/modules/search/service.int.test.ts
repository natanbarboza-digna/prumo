import { describe, expect, it } from "vitest";

import { createGoal } from "@/modules/goals/service";
import { closeCycle, createAction } from "@/modules/pdi/service";
import type { RoutineInput } from "@/modules/routines/schemas";
import { createRoutine } from "@/modules/routines/service";
import { search } from "@/modules/search/service";
import { archiveTrack, createStep, createTrack } from "@/modules/tracks/service";
import { pdiActionFixture } from "@/test/pdi-fixtures";

const today = "2026-11-20";

function routineInput(overrides: Partial<RoutineInput> = {}): RoutineInput {
  return {
    title: "Rotina",
    description: null,
    weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    timeOfDay: null,
    startDate: "2026-11-01",
    endDate: null,
    goalId: null,
    timesPerWeek: null,
    ...overrides,
  };
}

const goal = (title: string, overrides: { description?: string; status?: "ARCHIVED" } = {}) =>
  createGoal({
    title,
    description: overrides.description ?? null,
    status: overrides.status ?? "IN_PROGRESS",
    targetDate: null,
  });

const track = (title: string, description: string | null = null) =>
  createTrack({ title, description, goalId: null });

const step = (trackId: string, title: string, notes: string | null = null) =>
  createStep(trackId, { title, status: "NOT_STARTED", dueDate: null, resourceUrl: null, notes });

const titles = (group: { items: { title: string }[] }) => group.items.map((item) => item.title);

describe("search (plan 027)", () => {
  it("finds goals, tracks, steps and routines by each searched field", async () => {
    await goal("Falar inglês");
    await goal("Carreira", { description: "Chegar a pleno com inglês fluente" });
    const english = await track("Inglês do zero");
    const other = await track("Leitura", "Livros em inglês");
    await step(english.id, "Gramática inglesa");
    await step(other.id, "Primeiro livro", "Um romance em inglês");
    await createRoutine(routineInput({ title: "Ouvir podcast em inglês" }));
    await createRoutine(routineInput({ title: "Correr", description: "Com áudio em inglês" }));
    await goal("Sem relação");

    const result = await search("inglês", today);

    expect(titles(result.GOALS).sort()).toEqual(["Carreira", "Falar inglês"]);
    expect(titles(result.TRACKS).sort()).toEqual(["Inglês do zero", "Leitura"]);
    expect(titles(result.STEPS).sort()).toEqual(["Gramática inglesa", "Primeiro livro"]);
    expect(titles(result.ROUTINES).sort()).toEqual(["Correr", "Ouvir podcast em inglês"]);
    // A step leads to its track page and says which track it is in.
    const grammar = result.STEPS.items.find((item) => item.title === "Gramática inglesa");
    expect(grammar).toMatchObject({
      href: `/tracks/${english.id}`,
      context: "Trilha: Inglês do zero",
    });
  });

  it("finds PDI cycles by title and actions by title, description or expected result", async () => {
    const { cycle, area, category } = await pdiActionFixture();
    const action = (title: string, fields: { description?: string; expectedResult?: string }) =>
      createAction(cycle.id, {
        areaId: area.id,
        categoryId: category.id,
        title,
        description: fields.description ?? null,
        expectedResult: fields.expectedResult ?? null,
        dueDate: null,
        status: "NOT_STARTED",
        evidence: null,
        managerComment: null,
        goalId: null,
      });
    const presenting = await action("Apresentar", { expectedResult: "Falar em público com calma" });
    await action("Curso", { description: "Oratória e fala em público" });
    await action("Sem relação", {});

    const result = await search("público", today);

    expect(titles(result.ACTIONS).sort()).toEqual(["Apresentar", "Curso"]);
    expect(result.ACTIONS.items.find((item) => item.id === presenting.id)).toMatchObject({
      href: `/pdi/${cycle.id}/actions/${presenting.id}`,
      context: `Ciclo: ${cycle.title} · Área: ${area.name}`,
    });
    expect(titles((await search(cycle.title, today)).CYCLES)).toEqual([cycle.title]);
  });

  it("ignores case and accents both ways", async () => {
    await goal("Comunicação");
    await goal("comunicacao informal");

    for (const term of ["comunicacao", "COMUNICAÇÃO", "Comunicaçao"]) {
      expect(titles((await search(term, today)).GOALS).sort(), term).toEqual([
        "Comunicação",
        "comunicacao informal",
      ]);
    }
  });

  it("includes what is put away, marked as stored", async () => {
    await goal("Inglês antigo", { status: "ARCHIVED" });
    const archived = await track("Inglês arquivado");
    await step(archived.id, "Inglês etapa");
    await archiveTrack(archived.id);
    await createRoutine(routineInput({ title: "Inglês encerrado", endDate: "2026-11-10" }));
    await createRoutine(routineInput({ title: "Inglês ativo" }));
    // The fixture's action is "Praticar oratória".
    const { cycle } = await pdiActionFixture();
    await closeCycle(cycle.id);

    const result = await search("inglês", today);

    expect(result.GOALS.items).toMatchObject([{ title: "Inglês antigo", stored: true }]);
    expect(result.TRACKS.items).toMatchObject([{ title: "Inglês arquivado", stored: true }]);
    expect(result.STEPS.items).toMatchObject([{ title: "Inglês etapa", stored: true }]);
    const routines = Object.fromEntries(
      result.ROUTINES.items.map((item) => [item.title, item.stored]),
    );
    expect(routines).toEqual({ "Inglês encerrado": true, "Inglês ativo": false });
    const closed = await search(cycle.title, today);
    expect(closed.CYCLES.items).toMatchObject([{ stored: true }]);
    expect(closed.ACTIONS.items).toEqual([]);
    expect((await search("oratória", today)).ACTIONS.items).toMatchObject([{ stored: true }]);
  });

  it("returns up to 20 per group, newest first, with the full total", async () => {
    for (let index = 1; index <= 22; index++) {
      await goal(`Meta ${String(index).padStart(2, "0")}`);
    }

    const { GOALS } = await search("meta", today);

    expect(GOALS.total).toBe(22);
    expect(GOALS.items).toHaveLength(20);
    expect(GOALS.items[0]?.title).toBe("Meta 22");
  });

  it("treats % and _ in the term as plain text", async () => {
    await goal("Bater 50% da meta");
    await goal("Bater 500 da meta");
    await goal("arquivo_final");
    await goal("arquivoXfinal");

    expect(titles((await search("50%", today)).GOALS)).toEqual(["Bater 50% da meta"]);
    expect(titles((await search("o_f", today)).GOALS)).toEqual(["arquivo_final"]);
  });
});
