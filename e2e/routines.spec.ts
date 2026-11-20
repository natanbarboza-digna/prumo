import { type Page, expect, test } from "@playwright/test";

import {
  addDays,
  formatDateForDisplay,
  formatLongDate,
  mondayOf,
  todayInAppTimeZone,
  weekdayOf,
} from "../src/lib/dates";
import { monthTitle } from "../src/modules/routines/labels";
import { addMonths } from "../src/modules/routines/rules";
import { type RoutineData, insertGoal, insertRoutine } from "./factories";
import { createRoutine, expectNoAxeViolations, resetDatabase, textbox } from "./helpers";

test.beforeEach(resetDatabase);

/** A routine written to the database (plan 018), then its page. */
async function openRoutine(page: Page, routine: RoutineData) {
  const id = await insertRoutine(routine);
  await page.goto(`/routines/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: routine.title })).toBeVisible();
  return id;
}

// The same "today" the app uses (America/Fortaleza), whatever the machine's zone.
const today = todayInAppTimeZone();
const yesterday = addDays(today, -1);

test("Hoje sem rotinas convida a criar a primeira", async ({ page }) => {
  await page.goto("/today");

  await expect(page.getByRole("heading", { level: 1, name: "Hoje" })).toBeVisible();
  await expect(page.getByText("Nenhuma rotina para hoje.")).toBeVisible();
  await page.getByRole("link", { name: "Criar rotina" }).click();

  await expect(page).toHaveURL("/routines/new");
});

test("uma rotina diária aparece em Hoje com o horário", async ({ page }) => {
  await createRoutine(page, { title: "Meditar", timeOfDay: "06:30" });

  await page.getByRole("link", { name: "Hoje", exact: true }).click();

  const item = page.getByRole("list", { name: "Rotinas de hoje" }).getByRole("listitem");
  await expect(item).toHaveCount(1);
  await expect(item.getByRole("heading", { name: "Meditar" })).toBeVisible();
  await expect(item.getByText("06:30")).toBeVisible();
  await expect(page.getByText("0 de 1 feita")).toBeVisible();
});

test("Feito conta a rotina e Desfazer volta para pendente", async ({ page }) => {
  await insertRoutine({ title: "Ler", startDate: today });
  await page.goto("/today");

  await page.getByRole("button", { name: "Feito: Ler" }).click();

  await expect(page.getByText("1 de 1 feita")).toBeVisible();
  await expect(page.getByText("Feita", { exact: true }).filter({ visible: true })).toBeVisible();

  await page.getByRole("button", { name: "Desfazer: Ler" }).click();

  await expect(page.getByText("0 de 1 feita")).toBeVisible();
  await expect(page.getByRole("button", { name: "Feito: Ler" })).toBeVisible();
});

test("Pular com nota mostra a rotina como pulada e a nota", async ({ page }) => {
  await insertRoutine({ title: "Correr", startDate: today });
  await page.goto("/today");

  await page.getByText("Adicionar nota").click();
  await textbox(page, "Nota (opcional)").fill("Chuva forte");
  await page.getByRole("button", { name: "Pular: Correr" }).click();

  await expect(page.getByText("Pulada", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Chuva forte")).toBeVisible();
  await expect(page.getByText("0 de 1 feita")).toBeVisible();
});

test("rotina fora do dia de hoje não aparece em Hoje, só em Rotinas", async ({ page }) => {
  await insertRoutine({
    title: "Revisar a semana",
    startDate: today,
    weekdays: [weekdayOf(addDays(today, 1))],
  });

  await page.goto("/today");
  await expect(page.getByText("Nenhuma rotina para hoje.")).toBeVisible();

  await page.getByRole("link", { name: "Rotinas", exact: true }).click();
  await expect(page.getByRole("link", { name: "Revisar a semana" })).toBeVisible();
});

test("o formulário mostra erros nos dias e no fim", async ({ page }) => {
  await page.goto("/routines/new");
  await textbox(page, "Título").fill("Sem dias");
  await textbox(page, "Fim (opcional)").fill(yesterday);

  await page.getByRole("button", { name: "Criar rotina" }).click();

  const days = page.getByRole("group", { name: "Dias da semana" });
  await expect(days).toHaveAccessibleDescription("Escolha pelo menos um dia da semana.");
  await expect(textbox(page, "Fim (opcional)")).toHaveAccessibleDescription(
    "O fim não pode ser antes do início.",
  );
  await expect(page.getByRole("checkbox", { name: "Segunda-feira" })).toBeFocused();
});

test("o histórico corrige dias passados e atualiza a adesão", async ({ page }) => {
  await openRoutine(page, { title: "Inglês", startDate: addDays(today, -2) });
  // Today is not over, so it only counts once logged.
  await expect(page.getByText("0 de 2 dias feitos, 0%")).toBeVisible();

  await page.goto("/today");
  await page.getByRole("button", { name: "Feito: Inglês" }).click();
  await expect(page.getByText("1 de 1 feita")).toBeVisible();

  await page.getByRole("link", { name: "Inglês" }).click();
  await expect(page.getByText("1 de 3 dias feitos, 33%")).toBeVisible();
  const history = page.getByRole("list", { name: "Dias programados" });
  await expect(history.getByRole("listitem")).toHaveCount(3);
  await expect(
    history.getByRole("button", { name: `Desfazer: hoje, ${formatLongDate(today)}` }),
  ).toBeVisible();

  await page.getByRole("button", { name: `Feito: ${formatLongDate(yesterday)}` }).click();

  await expect(page.getByText("2 de 3 dias feitos, 67%")).toBeVisible();
});

test("encerrar termina a rotina hoje; rotinas já encerradas saem de Hoje", async ({ page }) => {
  await insertRoutine({ title: "Antiga", startDate: addDays(today, -10), endDate: yesterday });
  await openRoutine(page, { title: "Atual", startDate: today });

  await page.getByRole("button", { name: "Encerrar rotina" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Encerrar" }).click();

  await expect(page.getByText("Termina hoje")).toBeVisible();
  await expect(page.getByRole("button", { name: "Encerrar rotina" })).toHaveCount(0);

  await page.goto("/today");
  const items = page.getByRole("list", { name: "Rotinas de hoje" }).getByRole("heading");
  await expect(items).toHaveText(["Atual"]);

  await page.goto("/routines");
  await expect(page.getByRole("link", { name: "Antiga" })).toHaveCount(0);
  await page.getByRole("link", { name: "Encerradas" }).click();
  await expect(page.getByRole("link", { name: "Antiga" })).toBeVisible();
  await expect(
    page.getByText("Encerrada", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
});

test("o objetivo mostra as rotinas vinculadas", async ({ page }) => {
  const goalId = await insertGoal({ title: "Saúde" });
  await insertRoutine({ title: "Caminhar", startDate: today, goalId });

  await page.goto(`/goals/${goalId}`);

  const section = page.getByRole("region", { name: "Rotinas" });
  await expect(section.getByRole("link", { name: "Caminhar" })).toBeVisible();
  await expect(section.getByText("Nenhum dia para contar ainda")).toBeVisible();
});

test("as páginas de rotina passam na verificação de acessibilidade", async ({ page }) => {
  await createRoutine(page, { title: "Alongar", timeOfDay: "07:00" });
  await expectNoAxeViolations(page);

  for (const [url, heading] of [
    ["/today", "Hoje"],
    ["/routines", "Rotinas"],
    ["/routines/new", "Nova rotina"],
  ] as const) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectNoAxeViolations(page);
  }
});

test("o calendário mostra o dia feito em Hoje e o resumo do mês", async ({ page }) => {
  const id = await insertRoutine({ title: "Ler", startDate: today });
  const routineUrl = `/routines/${id}`;
  await page.goto("/today");
  await page.getByRole("button", { name: "Feito: Ler" }).click();
  await expect(page.getByText("1 de 1 feita")).toBeVisible();

  await page.goto(routineUrl);

  const calendar = page.getByRole("region", { name: "Calendário" });
  await expect(calendar.getByRole("table", { name: monthTitle(today.slice(0, 7)) })).toBeVisible();
  await expect(
    calendar.getByRole("cell", { name: `${formatLongDate(today)}: feita (hoje)` }),
  ).toBeVisible();
  await expect(
    calendar.getByText(/: 1 feita, 0 puladas e 0 sem registro, 100% de adesão\./),
  ).toBeVisible();
});

test("o calendário navega entre os meses do período da rotina", async ({ page }) => {
  const start = addDays(today, -40);
  await openRoutine(page, { title: "Correr", startDate: start });
  const calendar = page.getByRole("region", { name: "Calendário" });
  const months = calendar.getByRole("navigation", { name: "Mês do calendário" });
  const currentMonth = today.slice(0, 7);
  // The current month is the last one: no link forward.
  await expect(months.getByRole("link", { name: "Próximo mês ›" })).toHaveCount(0);

  await months.getByRole("link", { name: "‹ Mês anterior" }).click();

  const previousMonth = addMonths(currentMonth, -1);
  await expect(page).toHaveURL((url) => url.searchParams.get("mes") === previousMonth);
  await expect(calendar.getByRole("table", { name: monthTitle(previousMonth) })).toBeVisible();
  // 40 days back can reach two months before; go to the first month of the routine.
  while ((await months.getByRole("link", { name: "‹ Mês anterior" }).count()) > 0) {
    await months.getByRole("link", { name: "‹ Mês anterior" }).click();
    await expect(page).toHaveURL(/\?mes=/);
  }
  await expect(calendar.getByRole("table", { name: monthTitle(start.slice(0, 7)) })).toBeVisible();
  await expect(months.getByRole("link", { name: "Próximo mês ›" })).toBeVisible();
});

test("uma rotina de meta semanal mostra o progresso da semana, sem Pular", async ({ page }) => {
  await page.goto("/routines/new");
  // The goal field only shows for that kind of routine.
  await expect(page.getByRole("combobox", { name: "Quantas vezes por semana" })).toBeHidden();
  await page.getByRole("radio", { name: "Algumas vezes por semana" }).check();
  await expect(page.getByRole("combobox", { name: "Quantas vezes por semana" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Dias da semana" })).toBeHidden();
  await expectNoAxeViolations(page);

  await createRoutine(page, { title: "Exercício", timesPerWeek: 3 });
  await expect(page.getByText("3 vezes por semana")).toBeVisible();
  const calendar = page.getByRole("region", { name: "Calendário" });
  await expect(calendar.getByRole("columnheader", { name: "Meta" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/today");
  const item = page.getByRole("list", { name: "Rotinas de hoje" }).getByRole("listitem");
  await expect(item.getByText("0 de 3 nesta semana")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pular: Exercício" })).toHaveCount(0);
  await page.getByRole("button", { name: "Feito: Exercício" }).click();
  await expect(item.getByText("1 de 3 nesta semana")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/routines");
  await page.getByRole("link", { name: "Exercício" }).click();
  await expect(
    calendar.getByRole("cell", { name: /semana em andamento, 1 de 3|meta da semana cumprida/ }),
  ).toBeVisible();
});

test("a sequência aparece em Hoje a partir de 2 dias e cresce com o Feito", async ({ page }) => {
  await insertRoutine({
    title: "Ler",
    startDate: addDays(today, -3),
    logs: [{ date: addDays(today, -3) }, { date: addDays(today, -2) }, { date: yesterday }],
  });
  await page.goto("/today");

  const item = page.getByRole("list", { name: "Rotinas de hoje" }).getByRole("listitem");
  await expect(item.getByText("3 dias seguidos")).toBeVisible();
  await page.getByRole("button", { name: "Feito: Ler" }).click();
  await expect(item.getByText("4 dias seguidos")).toBeVisible();
});

test("a página da rotina mostra a sequência atual e o recorde", async ({ page }) => {
  await openRoutine(page, {
    title: "Correr",
    startDate: addDays(today, -4),
    logs: [
      { date: addDays(today, -4) },
      { date: addDays(today, -3) },
      { date: addDays(today, -2), status: "SKIPPED" },
      { date: yesterday },
    ],
  });

  await expect(page.getByText("Sequência atual: 1 dia · Recorde: 2 dias")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a página da rotina mostra a adesão das últimas 12 semanas (plano 029)", async ({ page }) => {
  // Every day from last Monday: 3 done last week, nothing before it.
  const lastMonday = addDays(mondayOf(today), -7);
  await openRoutine(page, {
    title: "Ler",
    startDate: lastMonday,
    logs: [
      { date: lastMonday },
      { date: addDays(lastMonday, 1) },
      { date: addDays(lastMonday, 2) },
    ],
  });

  const table = page.getByRole("table", { name: "Adesão por semana (últimas 12 semanas)" });
  const rows = table.getByRole("row");
  // The header and the 12 weeks.
  await expect(rows).toHaveCount(13);
  const short = (date: string) => formatDateForDisplay(date).slice(0, 5);
  await expect(
    rows.filter({ hasText: `${short(lastMonday)} a ${short(addDays(lastMonday, 6))}` }),
  ).toContainText("43% (3 de 7 dias)");
  await expect(rows.nth(1)).toContainText("sem dias previstos");
  await expect(rows.last()).toContainText("(esta semana)");
  await expectNoAxeViolations(page);
});
