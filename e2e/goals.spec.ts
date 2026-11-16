import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import { readTestDatabaseUrl, resetTestDatabase } from "../src/test/test-database";

// Form fields are located with getByRole, which skips the hidden copies of
// pages that Next keeps in the DOM for back navigation.
// These tests share one database, so they run one after another in this file
// and each starts from an empty database.
test.describe.configure({ mode: "default" });

test.beforeEach(async () => {
  await resetTestDatabase(readTestDatabaseUrl());
});

type NewGoal = { title: string; description?: string; status?: string; targetDate?: string };

async function createGoal(page: Page, goal: NewGoal) {
  await page.goto("/goals/new");
  await page.getByRole("textbox", { name: "Título", exact: true }).fill(goal.title);
  if (goal.description)
    await page
      .getByRole("textbox", { name: "Descrição (opcional)", exact: true })
      .fill(goal.description);
  if (goal.status)
    await page
      .getByRole("combobox", { name: "Status", exact: true })
      .selectOption({ label: goal.status });
  if (goal.targetDate)
    await page
      .getByRole("textbox", { name: "Data-alvo (opcional)", exact: true })
      .fill(goal.targetDate);
  await page.getByRole("button", { name: "Criar objetivo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: goal.title })).toBeVisible();
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test("lista vazia convida a criar o primeiro objetivo", async ({ page }) => {
  await page.goto("/goals");

  await expect(page.getByText("Você ainda não tem objetivos cadastrados.")).toBeVisible();
  await page.getByRole("link", { name: "Criar objetivo" }).click();

  await expect(page).toHaveURL("/goals/new");
});

test("cria um objetivo e o mostra no detalhe e na lista", async ({ page }) => {
  await createGoal(page, {
    title: "Aprender Next.js",
    description: "Terminar o módulo de Server Actions.",
    targetDate: "2030-12-31",
  });

  await expect(page.getByText("Terminar o módulo de Server Actions.")).toBeVisible();
  await expect(page.getByText("31/12/2030")).toBeVisible();
  await expect(page.getByRole("article").getByText("Não iniciado")).toBeVisible();

  await page.getByRole("link", { name: "← Objetivos" }).click();
  await expect(page.getByRole("link", { name: "Aprender Next.js" })).toBeVisible();
  await expect(page.getByText("Data-alvo: 31/12/2030")).toBeVisible();

  // Coming back to the form after saving starts with empty fields.
  await page.getByRole("link", { name: "Novo objetivo" }).click();
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toHaveValue("");
});

test("formulário sem título mostra o erro no campo", async ({ page }) => {
  await page.goto("/goals/new");

  await page.getByRole("button", { name: "Criar objetivo" }).click();

  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await expect(title).toHaveAccessibleName("Título");
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveAccessibleDescription("Informe um título.");
  await expect(page).toHaveURL("/goals/new");
});

test("arquivar tira o objetivo da lista padrão", async ({ page }) => {
  await createGoal(page, { title: "Correr 10 km" });

  await page.getByRole("link", { name: "Editar" }).click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption({ label: "Arquivado" });
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("article").getByText("Arquivado")).toBeVisible();

  await page.goto("/goals");
  await expect(page.getByRole("link", { name: "Correr 10 km" })).toHaveCount(0);

  const filter = page.getByRole("navigation", { name: "Filtrar por status" });
  await filter.getByRole("link", { name: "Arquivado" }).click();
  await expect(filter.getByRole("link", { name: "Arquivado" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "Correr 10 km" })).toBeVisible();
});

test("excluir pede confirmação", async ({ page }) => {
  await createGoal(page, { title: "Ler 12 livros" });

  await page.getByRole("button", { name: "Excluir" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Excluir objetivo?" });
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Ler 12 livros" })).toBeVisible();

  await page.getByRole("button", { name: "Excluir" }).click();
  await dialog.getByRole("button", { name: "Excluir" }).click();

  await expect(page).toHaveURL("/goals");
  await expect(page.getByText("Você ainda não tem objetivos cadastrados.")).toBeVisible();
});

test("objetivo em andamento com data passada aparece como atrasado", async ({ page }) => {
  await createGoal(page, {
    title: "Tirar certificação",
    status: "Em andamento",
    targetDate: "2020-01-31",
  });

  await expect(page.getByText("Atrasado")).toBeVisible();
  await page.goto("/goals");
  await expect(page.getByText("Atrasado")).toBeVisible();
});

test("lista, formulário e detalhe passam no axe", async ({ page }) => {
  // Each check waits for the page heading, so axe sees the finished page and
  // not the "Carregando…" placeholder that streams first.
  await createGoal(page, { title: "Objetivo acessível", targetDate: "2030-01-01" });
  await expectNoAxeViolations(page);

  await page.goto("/goals");
  await expect(page.getByRole("heading", { level: 1, name: "Objetivos" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/goals/new");
  await expect(page.getByRole("heading", { level: 1, name: "Novo objetivo" })).toBeVisible();
  await expectNoAxeViolations(page);
});
