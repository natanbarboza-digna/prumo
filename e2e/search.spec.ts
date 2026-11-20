import { type Page, expect, test } from "@playwright/test";

import { insertGoal, insertTrack } from "./factories";
import { expectNoAxeViolations, resetDatabase } from "./helpers";

test.beforeEach(resetDatabase);

function searchBox(page: Page) {
  // The search field; getByLabel is avoided in this project (it also finds the
  // hidden copies Next keeps of visited pages).
  return page.getByRole("searchbox", { name: "Buscar" });
}

async function searchFor(page: Page, term: string) {
  await searchBox(page).fill(term);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
}

test("a lupa abre a busca, que acha sem acento e leva ao item (plano 027)", async ({ page }) => {
  const goal = await insertGoal({ title: "Falar inglês" });
  const track = await insertTrack({
    title: "Inglês do zero",
    goalId: goal,
    steps: [{ title: "Gramática inglesa" }],
  });
  await insertGoal({ title: "Correr 5 km" });

  await page.goto("/");
  await page.getByRole("link", { name: "Buscar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Busca" })).toBeVisible();

  await searchFor(page, "ingles");

  await expect(page).toHaveURL(/\/search\?q=ingles$/);
  await expect(page).toHaveTitle("Busca: ingles · Prumo");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Objetivos (1)",
    "Trilhas (1)",
    "Etapas de trilha (1)",
  ]);
  const steps = page.getByRole("region", { name: "Etapas de trilha (1)" });
  await expect(steps).toContainText("Trilha: Inglês do zero");
  await expect(page.getByText("Correr 5 km")).toHaveCount(0);
  await expectNoAxeViolations(page);

  await steps.getByRole("link", { name: "Gramática inglesa" }).click();
  await expect(page).toHaveURL(`/tracks/${track.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Inglês do zero" })).toBeVisible();
});

test("sem resultado mostra a mensagem, e um caractere pede mais (plano 027)", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByRole("heading", { level: 1, name: "Busca" })).toBeVisible();
  await expectNoAxeViolations(page);

  await searchFor(page, "xyz");
  await expect(page.getByText("Nada encontrado para “xyz”.")).toBeVisible();

  await searchFor(page, "x");
  await expect(page.getByText("Digite pelo menos 2 caracteres para buscar.")).toBeVisible();
  await expect(searchBox(page)).toHaveValue("x");
});

test("itens arquivados aparecem com o selo (plano 027)", async ({ page }) => {
  await insertTrack({ title: "Inglês antigo", archivedAt: new Date() });

  await page.goto("/search?q=antigo");

  const tracks = page.getByRole("region", { name: "Trilhas (1)" });
  await expect(tracks.getByRole("link", { name: "Inglês antigo" })).toBeVisible();
  await expect(tracks).toContainText("Arquivada");
});
