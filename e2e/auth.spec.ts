import { type Page, expect, test } from "@playwright/test";

import { E2E_EMAIL, E2E_PASSWORD } from "../src/test/test-database";
import { expectNoAxeViolations, resetDatabase, textbox } from "./helpers";

test.beforeEach(resetDatabase);

// These tests start logged out: no session cookie.
test.use({ storageState: { cookies: [], origins: [] } });

async function logIn(page: Page, password = E2E_PASSWORD) {
  await textbox(page, "E-mail").fill(E2E_EMAIL);
  await page.locator('input[name="password"]:visible').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("sem sessão, a página pedida leva ao login e volta para ela depois de entrar", async ({
  page,
}) => {
  await page.goto("/routines");

  await expect(page).toHaveURL(/\/login\?next=%2Froutines$/);
  await expect(page.getByRole("heading", { level: 1, name: "Entrar no Prumo" })).toBeVisible();
  await expectNoAxeViolations(page);

  await logIn(page);

  await expect(page.getByRole("heading", { level: 1, name: "Rotinas" })).toBeVisible();
});

test("senha errada mostra um erro genérico", async ({ page }) => {
  await page.goto("/login");

  await logIn(page, "senha errada qualquer");

  await expect(
    page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." }),
  ).toBeVisible();
  await expect(textbox(page, "E-mail")).toHaveValue(E2E_EMAIL);
});

test("sair encerra a sessão", async ({ page }) => {
  await page.goto("/login");
  await logIn(page);
  await expect(page.getByRole("heading", { level: 1, name: "Prumo" })).toBeVisible();

  await page.getByRole("button", { name: "Sair do Prumo" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Entrar no Prumo" })).toBeVisible();
  await page.goto("/goals");
  await expect(page).toHaveURL(/\/login/);
});

test("trocar a senha faz a senha nova valer no próximo login", async ({ page }) => {
  await page.goto("/login");
  await logIn(page);
  await expect(page.getByRole("heading", { level: 1, name: "Prumo" })).toBeVisible();

  await page.getByRole("link", { name: "Minha conta" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Minha conta" })).toBeVisible();
  await expectNoAxeViolations(page);
  const password = (name: string) => page.locator(`input[name="${name}"]:visible`);
  await password("currentPassword").fill(E2E_PASSWORD);
  await password("newPassword").fill("uma senha nova bem longa");
  await password("confirmation").fill("uma senha nova bem longa");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Senha alterada" })).toBeVisible();

  await page.getByRole("button", { name: "Sair do Prumo" }).click();
  await logIn(page, E2E_PASSWORD);
  await expect(
    page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." }),
  ).toBeVisible();
  await page.locator('input[name="password"]:visible').fill("uma senha nova bem longa");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Prumo" })).toBeVisible();
});

test("as respostas trazem os cabeçalhos de segurança, mesmo sem o Caddy (plano 039)", async ({
  request,
}) => {
  const response = await request.get("/login");

  expect(response.status()).toBe(200);
  expect(response.headers()).toMatchObject({
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
});
