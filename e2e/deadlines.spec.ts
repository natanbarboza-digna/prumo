import { type Page, expect, test } from "@playwright/test";

import { addDays, todayInAppTimeZone } from "../src/lib/dates";
import { insertGoal, insertTrack } from "./factories";
import { expectNoAxeViolations, resetDatabase } from "./helpers";

test.beforeEach(resetDatabase);

const today = todayInAppTimeZone();

/** One track with an overdue step, one due this week and one 60 days out, plus a goal. */
async function someDeadlines() {
  await insertTrack({
    title: "Inglês",
    steps: [
      { title: "Etapa atrasada", dueDate: addDays(today, -3) },
      { title: "Etapa de hoje", dueDate: today },
      { title: "Etapa distante", dueDate: addDays(today, 60) },
    ],
  });
  await insertGoal({ title: "Meta próxima", status: "IN_PROGRESS", targetDate: addDays(today, 2) });
}

function filter(page: Page, name: "Período" | "Tipo") {
  return page.getByRole("navigation", { name });
}

/** The deadline titles, in every group (the filters are lists of links too, so skip them). */
function itemLinks(page: Page) {
  return page.getByRole("main").getByRole("region").getByRole("listitem").getByRole("link");
}

test("o painel leva à tela de prazos, com atrasados e semanas (plano 028)", async ({ page }) => {
  await someDeadlines();

  await page.goto("/");
  await page.getByRole("link", { name: "Ver todos os prazos" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Prazos" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Atrasados" })).toContainText("Etapa atrasada");
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Atrasados (1)");
  await expect(page.getByRole("heading", { level: 2, name: /^Esta semana/ })).toBeVisible();
  // 60 days out is beyond the default 30 days.
  await expect(page.getByText("Etapa distante")).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("os filtros de tipo e período se combinam (plano 028)", async ({ page }) => {
  await someDeadlines();
  await page.goto("/deadlines");
  await expect(page.getByRole("heading", { level: 1, name: "Prazos" })).toBeVisible();

  await filter(page, "Tipo").getByRole("link", { name: "Etapas" }).click();
  await expect(page).toHaveURL(/tipo=STEP/);
  await expect(itemLinks(page)).toHaveText(["Etapa atrasada", "Etapa de hoje"]);

  await filter(page, "Período").getByRole("link", { name: "Todos" }).click();
  await expect(page).toHaveURL(/periodo=all/);
  await expect(page).toHaveURL(/tipo=STEP/);
  await expect(itemLinks(page)).toHaveText(["Etapa atrasada", "Etapa de hoje", "Etapa distante"]);
  await expect(filter(page, "Tipo").locator('[aria-current="page"]')).toHaveText("Etapas");
});

test("sem prazos, a tela diz isso e oferece ver todos (plano 028)", async ({ page }) => {
  await page.goto("/deadlines?periodo=7");

  await expect(page.getByText("Nenhum prazo atrasado nem nos próximos 7 dias.")).toBeVisible();
  await page.getByRole("link", { name: "Ver todos" }).click();
  await expect(page.getByText("Nenhum prazo em aberto.")).toBeVisible();
  await expectNoAxeViolations(page);
});
