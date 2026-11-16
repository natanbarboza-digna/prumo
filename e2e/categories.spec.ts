import { type Page, expect, test } from "@playwright/test";

import {
  addAction,
  addArea,
  combobox,
  createCycle,
  expectNoAxeViolations,
  resetDatabase,
  textbox,
} from "./helpers";

test.beforeEach(resetDatabase);

function categoryNames(page: Page) {
  return page.getByRole("list", { name: "Categorias" }).getByRole("heading", { level: 2 });
}

test("a lista mostra as categorias padrão do seed", async ({ page }) => {
  await page.goto("/settings/categories");

  await expect(categoryNames(page)).toHaveText(["Curso", "Leitura", "Mentoria", "Prática"]);
  await expect(page.getByText("Permite rotina: sim")).toHaveCount(1);
  await expectNoAxeViolations(page);
});

test("cria uma categoria e recusa nome repetido", async ({ page }) => {
  await page.goto("/settings/categories/new");
  await textbox(page, "Nome").fill("Podcast");
  await page.getByRole("checkbox", { name: "Permite criar rotina" }).check();
  await page.getByRole("button", { name: "Criar categoria" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Categorias de ação" })).toBeVisible();
  await expect(categoryNames(page)).toContainText(["Podcast"]);
  await expect(page.getByText("Permite rotina: sim")).toHaveCount(2);

  await page.goto("/settings/categories/new");
  await textbox(page, "Nome").fill("curso");
  await page.getByRole("button", { name: "Criar categoria" }).click();

  await expect(textbox(page, "Nome")).toHaveAccessibleDescription(
    "Já existe uma categoria com esse nome.",
  );
  await expectNoAxeViolations(page);
});

test("arquivar tira a categoria das ações novas; em uso, não pode ser excluída", async ({
  page,
}) => {
  await createCycle(page, { title: "PDI 2026", startDate: "2026-01-01", endDate: "2026-12-31" });
  await addArea(page, "PDI 2026", "Comunicação");
  await addAction(page, "PDI 2026", "Comunicação", {
    title: "Curso de oratória",
    category: "Curso",
  });

  await page.goto("/settings/categories");
  await expect(page.getByRole("button", { name: "Excluir: Curso" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Excluir: Leitura" })).toBeVisible();
  await page.getByRole("button", { name: "Arquivar: Leitura" }).click();
  await expect(page.getByRole("button", { name: "Desarquivar: Leitura" })).toBeVisible();

  await page.goto("/pdi");
  await page.getByRole("link", { name: "PDI 2026" }).click();
  await page.getByRole("link", { name: "Adicionar ação em Comunicação" }).click();
  const options = combobox(page, "Categoria").getByRole("option");
  await expect(options).toHaveText(["Escolha…", "Curso", "Mentoria", "Prática"]);
});
