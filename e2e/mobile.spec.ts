import { type Page, expect, test } from "@playwright/test";

import { createRoutine, expectNoAxeViolations, resetDatabase } from "./helpers";

test.beforeEach(resetDatabase);

const NAV_LINKS = ["Hoje", "Objetivos", "Trilhas", "Rotinas", "PDI"];
const PAGES = ["/", "/today", "/goals", "/tracks", "/routines", "/pdi", "/settings/categories"];

function nav(page: Page) {
  return page.getByRole("navigation", { name: "Principal" });
}

async function open(page: Page, path: string) {
  await page.goto(path);
  // Wait for the page itself, not the "Carregando…" fallback.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("em 375 px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("o cabeçalho mostra a navegação inteira numa linha, abaixo da marca", async ({ page }) => {
    await open(page, "/");

    const brand = await page.getByRole("link", { name: "Prumo, página inicial" }).boundingBox();
    const header = await page.getByRole("banner").boundingBox();
    const boxes = [];
    for (const name of NAV_LINKS) {
      const link = nav(page).getByRole("link", { name, exact: true });
      await expect(link).toBeInViewport({ ratio: 1 });
      boxes.push(await link.boundingBox());
    }

    const tops = boxes.map((box) => Math.round(box?.y ?? -1));
    expect(new Set(tops).size).toBe(1);
    expect(tops[0]).toBeGreaterThan((brand?.y ?? 0) + (brand?.height ?? 0) - 1);
    for (const box of boxes) {
      // Inside the header: nothing cut at the top or hidden below it.
      expect(box?.y ?? -1).toBeGreaterThanOrEqual(header?.y ?? 0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        (header?.y ?? 0) + (header?.height ?? 0),
      );
    }
  });

  test("nenhuma página principal rola para o lado", async ({ page }) => {
    for (const path of PAGES) {
      await open(page, path);
      const { scroll, width } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: document.documentElement.clientWidth,
      }));
      expect(scroll, path).toBe(width);
    }
  });

  test("o painel com dados passa no axe", async ({ page }) => {
    await createRoutine(page, { title: "Ler 20 minutos" });
    await open(page, "/");

    await expectNoAxeViolations(page);
  });
});

test.describe("em 320 px", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("nenhuma página principal rola para o lado", async ({ page }) => {
    for (const path of PAGES) {
      await open(page, path);
      const { scroll, width } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: document.documentElement.clientWidth,
      }));
      expect(scroll, path).toBe(width);
    }
  });

  test("o último link da navegação pode ser alcançado e clicado", async ({ page }) => {
    await open(page, "/");

    await nav(page).getByRole("link", { name: "PDI", exact: true }).click();

    await expect(page.getByRole("heading", { level: 1, name: "PDI" })).toBeVisible();
  });
});
