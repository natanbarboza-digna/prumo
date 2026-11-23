import { type Page, expect, test } from "@playwright/test";

import { addDays, todayInAppTimeZone } from "../src/lib/dates";
import {
  insertBook,
  insertCycle,
  insertGoal,
  insertReadingGoal,
  insertRoutine,
  insertTimeDay,
  insertTrack,
} from "./factories";
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

function kpis(page: Page) {
  return page.getByRole("region", { name: "Indicadores" });
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
        actions: [
          { title: "Apresentar no time", category: "Curso", dueDate: addDays(today, -1) },
          { title: "Ler o livro", category: "Leitura", status: "DONE" },
        ],
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
  await expect(pdi.getByRole("img", { name: "50% das ações do ciclo concluídas" })).toBeVisible();
  await expect(pdi.getByText("1 de 2 ações concluídas")).toBeVisible();
  await expect(pdi.getByText("Nenhum check-in ainda.")).toBeVisible();

  const inProgress = card(page, "Objetivos e trilhas em andamento");
  await expect(
    inProgress
      .getByRole("list", { name: "Objetivos em andamento" })
      .getByRole("link", { name: "Falar inglês" }),
  ).toBeVisible();
  await expect(
    inProgress
      .getByRole("list", { name: "Trilhas em andamento" })
      .getByRole("link", { name: "Inglês" }),
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
  await expect(kpis(page).getByRole("link", { name: "Rotinas hoje 1 de 1" })).toBeVisible();
  await expect(kpis(page).getByRole("link", { name: "Adesão em 30 dias 100%" })).toBeVisible();

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

test("o bloco Hoje mostra a adesão das rotinas ativas por semana (plano 029)", async ({ page }) => {
  await insertRoutine({
    title: "Ler",
    startDate: addDays(today, -20),
    logs: [{ date: addDays(today, -1) }],
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Prumo" })).toBeVisible();

  const chart = card(page, "Hoje").getByRole("figure", {
    name: "Adesão das rotinas ativas por semana (últimas 12)",
  });
  await expect(chart).toBeVisible();
  await expect(chart.getByRole("row")).toHaveCount(13);
  await expectNoAxeViolations(page);
});

test("os indicadores mostram os números e levam às telas (plano 034)", async ({ page }) => {
  await insertRoutine({ title: "Ler 20 minutos", startDate: today });
  await insertTrack({
    title: "Inglês",
    steps: [
      { title: "Gramática", dueDate: addDays(today, -3) },
      { title: "Conversação", dueDate: addDays(today, -2) },
    ],
  });
  const { id: cycleId } = await insertCycle({
    title: "PDI atual",
    startDate: addDays(today, -30),
    endDate: addDays(today, 60),
    status: "ACTIVE",
    areas: [
      {
        name: "Comunicação",
        actions: [
          { title: "Feita", category: "Curso", status: "DONE" },
          { title: "Cancelada", category: "Curso", status: "CANCELLED" },
          { title: "Aberta", category: "Curso" },
          { title: "Outra", category: "Curso" },
        ],
      },
    ],
  });
  await insertTimeDay({
    date: today,
    start: "08:00",
    end: "10:30",
    slotMinutes: 30,
    entries: [{ start: "08:00", minutes: 150 }],
  });

  await openHome(page);

  const strip = kpis(page);
  const expected: [string, string][] = [
    ["Rotinas hoje 0 de 1", "/today"],
    ["Adesão em 30 dias —", "/routines"],
    ["Trabalhado na semana 2h30", "/time/analytics"],
    ["Prazos atrasados 2", "/deadlines"],
    // Cancelled actions are left out: 1 of 3.
    ["PDI concluído 33%", `/pdi/${cycleId}`],
  ];
  for (const [name, href] of expected) {
    await expect(strip.getByRole("link", { name })).toHaveAttribute("href", href);
  }

  await strip.getByRole("link", { name: "Prazos atrasados 2" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Prazos" })).toBeVisible();
});

test("o bloco Tempo da semana mostra as horas por dia e por categoria (plano 034)", async ({
  page,
}) => {
  await insertGoal({ title: "Falar inglês", status: "IN_PROGRESS" });
  await openHome(page);
  const time = card(page, "Tempo da semana");
  await expect(time.getByText("Nenhum registro de tempo esta semana.")).toBeVisible();
  await expect(time.getByRole("link", { name: "Abrir Tempo" })).toHaveAttribute("href", "/time");

  await insertTimeDay({
    date: today,
    start: "08:00",
    end: "11:00",
    slotMinutes: 60,
    entries: [
      { start: "08:00", minutes: 60, category: "Projeto" },
      { start: "09:00", minutes: 60, category: "Projeto" },
      { start: "10:00", minutes: 60, category: "Chamados" },
    ],
  });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Prumo" })).toBeVisible();

  await expect(time.getByText("trabalhadas em 1 dia")).toBeVisible();
  const days = time.getByRole("figure", { name: "Horas trabalhadas por dia" });
  // One row per day up to today, plus the header.
  await expect(days.getByRole("row").filter({ hasText: "(hoje)" })).toContainText("3h");
  const legend = time.getByRole("list", { name: "Trabalho por categoria" });
  await expect(legend.getByRole("listitem")).toHaveText([
    /Projeto\s*67% · 2h/,
    /Chamados\s*33% · 1h/,
  ]);
  await expectNoAxeViolations(page);
});

test("o bloco Leitura do ano mostra a meta e os livros lendo (plano 037)", async ({ page }) => {
  await insertGoal({ title: "Falar inglês", status: "IN_PROGRESS" });
  await insertReadingGoal({ year: Number(today.slice(0, 4)), books: 12 });
  await insertBook({ title: "Lido", status: "READ", startedOn: today, finishedOn: today });
  await insertBook({
    title: "Refatoração",
    pages: 400,
    status: "READING",
    startedOn: today,
    logs: [{ date: today, position: 100 }],
  });

  await openHome(page);

  const reading = card(page, "Leitura do ano");
  await expect(reading.getByText("1 de 12 livros", { exact: true })).toBeVisible();
  const books = reading.getByRole("list", { name: "Lendo agora" });
  await expect(books.getByRole("link", { name: "Refatoração" })).toBeVisible();
  await expect(books.getByText("25%")).toBeVisible();
  await expectNoAxeViolations(page);
});
