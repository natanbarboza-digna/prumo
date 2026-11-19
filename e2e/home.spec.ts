import { type Page, expect, test } from "@playwright/test";

import { addDays, todayInAppTimeZone } from "../src/lib/dates";
import { insertCycle, insertGoal, insertRoutine, insertTrack } from "./factories";
import { expectNoAxeViolations, resetDatabase } from "./helpers";

test.beforeEach(resetDatabase);

// The same "today" the app uses (America/Fortaleza), whatever the machine's zone.
const today = todayInAppTimeZone();

async function openHome(page: Page) {
  await page.goto("/");
  // Wait for the page itself, not the "Carregando…" fallback.
  await expect(page.getByRole("heading", { level: 1, name: "Prumo" })).toBeVisible();
}

function card(page: Page, name: string) {
  return page.getByRole("region", { name, exact: true });
}

test("sem dados, mostra por onde começar", async ({ page }) => {
  await openHome(page);

  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page).toHaveTitle("Prumo");
  await expect(page.getByRole("link", { name: "Prumo, página inicial" })).toBeVisible();
  const welcome = card(page, "Por onde começar");
  for (const label of ["Criar objetivo", "Criar trilha", "Criar rotina", "Criar ciclo de PDI"]) {
    await expect(welcome.getByRole("link", { name: label })).toBeVisible();
  }
  await expectNoAxeViolations(page);
});

test("com dados, cada bloco mostra o que importa", async ({ page }) => {
  await insertGoal({ title: "Falar inglês", status: "IN_PROGRESS", targetDate: addDays(today, 5) });
  await insertTrack({
    title: "Inglês",
    steps: [
      { title: "Gramática", status: "DONE" },
      { title: "Conversação", dueDate: addDays(today, -2) },
    ],
  });
  await insertRoutine({ title: "Ler 20 minutos", startDate: today });
  await insertCycle({
    title: "PDI atual",
    startDate: addDays(today, -30),
    endDate: addDays(today, 60),
    status: "ACTIVE",
    areas: [
      {
        name: "Comunicação",
        actions: [{ title: "Apresentar no time", category: "Curso", dueDate: addDays(today, -1) }],
      },
    ],
  });

  await openHome(page);

  const todayCard = card(page, "Hoje");
  await expect(todayCard.getByRole("link", { name: "Ler 20 minutos" })).toBeVisible();
  await expect(todayCard.getByRole("status")).toHaveText("0 de 1 feita");

  const overdue = card(page, "Prazos").getByRole("list", { name: "Atrasados" });
  await expect(overdue.getByRole("link", { name: "Conversação" })).toBeVisible();
  await expect(overdue.getByRole("link", { name: "Apresentar no time" })).toBeVisible();
  const upcoming = card(page, "Prazos").getByRole("list", { name: "Próximos 14 dias" });
  await expect(upcoming.getByRole("link", { name: "Falar inglês" })).toBeVisible();

  const pdi = card(page, "PDI");
  await expect(pdi.getByRole("link", { name: "PDI atual" })).toBeVisible();
  await expect(pdi.getByText("Faltam 60 dias")).toBeVisible();
  await expect(pdi.getByText("1 ação atrasada")).toBeVisible();
  await expect(pdi.getByText("Nenhum check-in ainda.")).toBeVisible();

  await expect(
    card(page, "Objetivos em andamento").getByRole("link", { name: "Falar inglês" }),
  ).toBeVisible();
  await expect(
    card(page, "Trilhas em andamento").getByRole("link", { name: "Inglês" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await overdue.getByRole("link", { name: "Apresentar no time" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Apresentar no time" })).toBeVisible();
});

test("marcar a rotina no painel atualiza o resumo e a tela Hoje", async ({ page }) => {
  await insertRoutine({ title: "Ler 20 minutos", startDate: today });
  await openHome(page);

  const todayCard = card(page, "Hoje");
  await todayCard.getByRole("button", { name: "Feito: Ler 20 minutos" }).click();
  await expect(todayCard.getByRole("status")).toHaveText("1 de 1 feita");
  await expect(todayCard.getByText("Adesão em 30 dias: 100%")).toBeVisible();

  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Hoje" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Hoje" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Desfazer: Ler 20 minutos" })).toBeVisible();
});

test("alterna para o tema escuro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openHome(page);
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await page.getByRole("button", { name: "Alternar tema claro/escuro" }).click();

  await expect(html).toHaveClass(/\bdark\b/);
});

test("o painel com dados passa no axe também no tema escuro", async ({ page }) => {
  await insertRoutine({ title: "Ler 20 minutos", startDate: today });
  await insertGoal({ title: "Falar inglês", status: "DONE" });
  await page.emulateMedia({ colorScheme: "dark" });
  await openHome(page);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await expectNoAxeViolations(page);
});
