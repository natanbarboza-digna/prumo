import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES, ensureDefaultCategories } from "@/modules/categories/defaults";
import {
  CategoryInUseError,
  CategoryNameTakenError,
  CategoryNotFoundError,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  setCategoryArchived,
  updateCategory,
} from "@/modules/categories/service";

const MISSING_ID = "0190a3e4-0000-7000-8000-000000000000";

async function category(name: string, allowsRoutine = false) {
  return createCategory({ name, allowsRoutine });
}

/** An action using the category, created straight in the database. */
async function useCategory(categoryId: string) {
  const cycle = await db.pdiCycle.create({
    data: { title: "Ciclo", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
  });
  const area = await db.pdiArea.create({ data: { cycleId: cycle.id, name: "Área" } });
  await db.pdiAction.create({ data: { areaId: area.id, categoryId, title: "Ação" } });
}

describe("categories", () => {
  it("creates a category", async () => {
    expect(await category("Podcast", true)).toMatchObject({
      name: "Podcast",
      allowsRoutine: true,
      archived: false,
      actionCount: 0,
    });
  });

  it("lists active categories first, by name, with their action count", async () => {
    const zeta = await category("Zeta");
    const alpha = await category("Alpha");
    const archived = await category("Arquivada");
    await setCategoryArchived(archived.id, true);
    await useCategory(zeta.id);

    const list = await listCategories();

    expect(list.map((item) => item.name)).toEqual(["Alpha", "Zeta", "Arquivada"]);
    expect(list.find((item) => item.id === zeta.id)?.actionCount).toBe(1);
    expect(list.find((item) => item.id === alpha.id)?.actionCount).toBe(0);
  });

  it("can leave archived categories out of the list", async () => {
    await category("Ativa");
    const archived = await category("Arquivada");
    await setCategoryArchived(archived.id, true);

    expect((await listCategories({ includeArchived: false })).map((item) => item.name)).toEqual([
      "Ativa",
    ]);
  });

  it("rejects a name already taken, ignoring case", async () => {
    await category("Prática");

    await expect(category("prática")).rejects.toBeInstanceOf(CategoryNameTakenError);
  });

  it("rejects renaming to a name taken by another category, but keeps its own", async () => {
    await category("Curso");
    const reading = await category("Leitura");

    await expect(
      updateCategory(reading.id, { name: "CURSO", allowsRoutine: false }),
    ).rejects.toBeInstanceOf(CategoryNameTakenError);
    expect(
      await updateCategory(reading.id, { name: "leitura", allowsRoutine: true }),
    ).toMatchObject({ name: "leitura", allowsRoutine: true });
  });

  it("archives and unarchives", async () => {
    const created = await category("Curso");

    expect((await setCategoryArchived(created.id, true)).archived).toBe(true);
    expect((await setCategoryArchived(created.id, false)).archived).toBe(false);
  });

  it("deletes a category without actions", async () => {
    const created = await category("Curso");

    await deleteCategory(created.id);

    await expect(getCategory(created.id)).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  it("refuses to delete a category in use", async () => {
    const created = await category("Curso");
    await useCategory(created.id);

    await expect(deleteCategory(created.id)).rejects.toBeInstanceOf(CategoryInUseError);
    expect(await getCategory(created.id)).toMatchObject({ actionCount: 1 });
  });

  it.each([MISSING_ID, "not-a-uuid"])("throws CategoryNotFoundError for %j", async (id) => {
    await expect(getCategory(id)).rejects.toBeInstanceOf(CategoryNotFoundError);
    await expect(updateCategory(id, { name: "X", allowsRoutine: false })).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    await expect(setCategoryArchived(id, true)).rejects.toBeInstanceOf(CategoryNotFoundError);
    await expect(deleteCategory(id)).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});

describe("default categories", () => {
  it("creates the defaults once and keeps the user's edits", async () => {
    await ensureDefaultCategories(db);
    const practice = (await listCategories()).find((item) => item.name === "Prática")!;
    await updateCategory(practice.id, { name: "Prática", allowsRoutine: false });

    await ensureDefaultCategories(db);

    const list = await listCategories();
    expect(list).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(list.find((item) => item.name === "Prática")?.allowsRoutine).toBe(false);
  });

  it("only Prática allows routines by default", async () => {
    await ensureDefaultCategories(db);

    const allowing = (await listCategories()).filter((item) => item.allowsRoutine);

    expect(allowing.map((item) => item.name)).toEqual(["Prática"]);
  });
});
