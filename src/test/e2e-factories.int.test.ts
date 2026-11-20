// The e2e factories write SQL by hand (plan 018). Reading their rows back with
// the app's services catches a factory that fell behind a schema change.
import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { ensureDefaultCategories } from "@/modules/categories/defaults";
import { getGoal } from "@/modules/goals/service";
import { getCycle } from "@/modules/pdi/service";
import { getRoutine, getRoutineHistory } from "@/modules/routines/service";
import { getTrack } from "@/modules/tracks/service";

import {
  categoryId,
  insertCycle,
  insertGoal,
  insertRoutine,
  insertTrack,
} from "../../e2e/factories";

const today = "2026-11-19";

describe("e2e factories", () => {
  it("write a goal the app reads back", async () => {
    const id = await insertGoal({
      title: "Falar inglês",
      status: "IN_PROGRESS",
      targetDate: "2026-12-31",
    });

    await expect(getGoal(id)).resolves.toMatchObject({
      title: "Falar inglês",
      status: "IN_PROGRESS",
      targetDate: "2026-12-31",
    });
  });

  it("write a track with its steps in order", async () => {
    const goal = await insertGoal({ title: "Objetivo" });
    const { id, stepIds } = await insertTrack({
      title: "Inglês",
      goalId: goal,
      steps: [
        { title: "Gramática", status: "DONE" },
        { title: "Conversação", dueDate: "2026-11-10", resourceUrl: "https://exemplo.com" },
      ],
    });

    const track = await getTrack(id);
    expect(track).toMatchObject({ title: "Inglês", goal: { id: goal } });
    expect(track.steps).toMatchObject([
      { id: stepIds[0], title: "Gramática", status: "DONE", order: 1 },
      {
        id: stepIds[1],
        title: "Conversação",
        status: "NOT_STARTED",
        dueDate: "2026-11-10",
        resourceUrl: "https://exemplo.com",
        order: 2,
      },
    ]);
  });

  it("write fixed-days and weekly-goal routines with their logs", async () => {
    const fixed = await insertRoutine({
      title: "Ler",
      startDate: "2026-11-09",
      weekdays: ["MON", "WED"],
      timeOfDay: "07:00",
      logs: [{ date: "2026-11-16" }, { date: "2026-11-18", status: "SKIPPED", note: "Viagem" }],
    });
    const weekly = await insertRoutine({
      title: "Exercício",
      startDate: "2026-11-09",
      timesPerWeek: 3,
    });

    await expect(getRoutine(fixed)).resolves.toMatchObject({
      weekdays: ["MON", "WED"],
      timesPerWeek: null,
      timeOfDay: "07:00",
      startDate: "2026-11-09",
    });
    await expect(getRoutineHistory(fixed, today)).resolves.toEqual(
      expect.arrayContaining([
        { date: "2026-11-16", log: { date: "2026-11-16", status: "DONE", note: null } },
        { date: "2026-11-18", log: { date: "2026-11-18", status: "SKIPPED", note: "Viagem" } },
      ]),
    );
    await expect(getRoutine(weekly)).resolves.toMatchObject({
      timesPerWeek: 3,
      weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    });
  });

  it("write a PDI cycle with areas, actions and check-ins", async () => {
    await ensureDefaultCategories(db);
    const { id, actionIds } = await insertCycle({
      title: "PDI atual",
      startDate: "2026-10-01",
      endDate: "2027-03-31",
      status: "ACTIVE",
      managerName: "Mariana",
      areas: [
        {
          name: "Comunicação",
          actions: [
            {
              title: "Praticar",
              category: "Prática",
              status: "IN_PROGRESS",
              dueDate: "2026-12-01",
            },
            // Earlier due date, but listed second: the given order wins (plan 021).
            { title: "Ler", category: "Leitura", dueDate: "2026-11-01" },
          ],
        },
        { name: "Liderança" },
      ],
      checkIns: [{ date: "2026-11-02", summary: "Alinhamento" }],
    });

    const cycle = await getCycle(id);
    expect(cycle).toMatchObject({ title: "PDI atual", status: "ACTIVE", managerName: "Mariana" });
    expect(cycle.areas[0]?.actions).toMatchObject([
      {
        id: actionIds["Praticar"],
        title: "Praticar",
        status: "IN_PROGRESS",
        dueDate: "2026-12-01",
        category: { id: await categoryId("Prática") },
      },
      { id: actionIds["Ler"], title: "Ler" },
    ]);
    expect(cycle.areas.map((area) => area.name)).toEqual(["Comunicação", "Liderança"]);
    expect(cycle.checkIns).toMatchObject([{ date: "2026-11-02", summary: "Alinhamento" }]);
  });
});
