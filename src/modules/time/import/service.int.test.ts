import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { ensureDefaultTimeCategories } from "@/modules/time/defaults";
import {
  type TimeImportInput,
  importTimeHistory,
  previewTimeImport,
} from "@/modules/time/import/service";
import {
  getTimeDay,
  listTimeCategories,
  listTimeProjects,
  setTimeCategoryArchived,
  setTimeProjectArchived,
  startDay,
} from "@/modules/time/service";

// 14:00 UTC is 11:00 in Fortaleza, on Monday, November 23.
const now = new Date("2026-11-23T14:00:00Z");

const TEXT = `**16/11**
08:15 - cheguei
08:30 - olhei a caixa de e-mail, chamados
09:00 - configuração digna relatórios
09:30 - almoço
10:30 - usuário da máxima
11:00 - fim do expediente

**17/11**
09:00 - atendimento de Kaydson
09:30 - fim`;

async function categoryId(name: string) {
  await ensureDefaultTimeCategories(db);
  const category = (await listTimeCategories({ includeArchived: true })).find(
    (item) => item.name === name,
  );
  if (!category) throw new Error(`No category ${name}`);
  return category.id;
}

async function input(overrides: Partial<TimeImportInput> = {}): Promise<TimeImportInput> {
  return {
    text: TEXT,
    year: 2026,
    slotMinutes: 30,
    defaultCategoryId: await categoryId("Chamados"),
    categoryRules: "configuração = projeto\natend = Atendimento",
    projectRules: "digna = Digna\nmáxima = Máxima",
    ...overrides,
  };
}

describe("previewTimeImport (plan 033)", () => {
  it("shows the days, the entries with their registered category names and the new projects", async () => {
    await setTimeProjectArchived(
      (await db.timeProject.create({ data: { name: "Antigo" } })).id,
      true,
    );

    const result = await previewTimeImport(await input(), now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.days.map((day) => day.date)).toEqual(["2026-11-16", "2026-11-17"]);
    expect(result.preview.counts).toEqual({ days: 2, work: 4, breaks: 2 });
    // "projeto" in the rule matches the category "Projeto" regardless of case.
    expect(
      result.preview.days[0]?.entries.find((e) => e.description.startsWith("config")),
    ).toMatchObject({
      categoryName: "Projeto",
      projectName: "Digna",
    });
    expect(result.preview.newProjects).toEqual(["Digna", "Máxima"]);
    expect(await db.timeDay.count()).toBe(0);
  });

  it("refuses days already tracked, unknown or archived categories and archived projects", async () => {
    await startDay("2026-11-17", { startTime: "09:00", slotMinutes: 30, endTime: "10:00" }, now);
    await setTimeCategoryArchived(await categoryId("Atendimento"), true);
    await setTimeProjectArchived(
      (await db.timeProject.create({ data: { name: "Digna" } })).id,
      true,
    );

    const result = await previewTimeImport(
      await input({ categoryRules: "configuração = Inexistente\natend = Atendimento" }),
      now,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { source: "text", line: 9, message: "O dia 17/11/2026 já tem registro no Prumo." },
        {
          source: "categoryRules",
          line: 1,
          message: "A categoria “Inexistente” não existe.",
        },
        {
          source: "categoryRules",
          line: 2,
          message: "A categoria “Atendimento” está arquivada.",
        },
        { source: "projectRules", line: 1, message: "O projeto “Digna” está arquivado." },
      ]),
    );
  });

  it("refuses an archived default category", async () => {
    const id = await categoryId("Estudo");
    await setTimeCategoryArchived(id, true);

    const result = await previewTimeImport(await input({ defaultCategoryId: id }), now);

    expect(result).toMatchObject({
      ok: false,
      issues: [{ source: "form", line: null, message: "A categoria padrão está arquivada." }],
    });
  });
});

describe("importTimeHistory", () => {
  it("writes every day and entry at once, creating each new project once", async () => {
    const result = await importTimeHistory(await input(), now);

    expect(result).toEqual({ ok: true, dates: ["2026-11-16", "2026-11-17"] });
    const day = await getTimeDay("2026-11-16");
    expect(day).toMatchObject({ startTime: "08:15", endTime: "11:00", slotMinutes: 30 });
    expect(day?.entries.map((entry) => [entry.startTime, entry.minutes, entry.kind])).toEqual([
      ["08:30", 30, "WORK"],
      ["09:00", 30, "WORK"],
      ["09:30", 30, "BREAK"],
      ["10:00", 30, "BREAK"],
      ["10:30", 30, "WORK"],
    ]);
    expect((await listTimeProjects()).map((project) => project.name)).toEqual(["Digna", "Máxima"]);

    // Importing the same text again is refused: the days are already there.
    const again = await importTimeHistory(await input(), now);
    expect(again.ok).toBe(false);
    expect(await db.timeDay.count()).toBe(2);
  });
});
