import { type Page, expect, test } from "@playwright/test";

import { addDays, todayInAppTimeZone } from "../src/lib/dates";
import { createCycle, createTrack, expectNoAxeViolations, resetDatabase } from "./helpers";

test.beforeEach(resetDatabase);

const today = todayInAppTimeZone();

function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Principal" });
}

function developmentTabs(page: Page) {
  return page.getByRole("navigation", { name: "Desenvolvimento" });
}

/** The main menu item marked as the current page (aria-current="page"). */
function currentMenuItem(page: Page) {
  return mainNav(page).locator('[aria-current="page"]');
}

test("o menu principal tem Hoje, Objetivos, Desenvolvimento e Rotinas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Prumo" })).toBeVisible();

  await expect(mainNav(page).getByRole("link")).toHaveText([
    "Hoje",
    "Objetivos",
    "Desenvolvimento",
    "Rotinas",
  ]);
});

test("Desenvolvimento leva às trilhas, e as abas trocam entre Trilhas e PDI", async ({ page }) => {
  await page.goto("/");
  await mainNav(page).getByRole("link", { name: "Desenvolvimento" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Trilhas" })).toBeVisible();
  await expect(currentMenuItem(page)).toHaveText("Desenvolvimento");
  await expect(developmentTabs(page).locator('[aria-current="page"]')).toHaveText("Trilhas");
  await expectNoAxeViolations(page);

  await developmentTabs(page).getByRole("link", { name: "PDI" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "PDI" })).toBeVisible();
  await expect(currentMenuItem(page)).toHaveText("Desenvolvimento");
  await expect(developmentTabs(page).locator('[aria-current="page"]')).toHaveText("PDI");
  await expectNoAxeViolations(page);

  await developmentTabs(page).getByRole("link", { name: "Trilhas" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Trilhas" })).toBeVisible();
});

test("nas telas de detalhe, Desenvolvimento continua marcado no menu", async ({ page }) => {
  await createTrack(page, { title: "Inglês" });
  await expect(currentMenuItem(page)).toHaveText("Desenvolvimento");

  await createCycle(page, {
    title: "PDI atual",
    startDate: addDays(today, -10),
    endDate: addDays(today, 100),
  });
  await expect(currentMenuItem(page)).toHaveText("Desenvolvimento");
  // The tabs only show on the two lists.
  await expect(developmentTabs(page)).toHaveCount(0);
});
