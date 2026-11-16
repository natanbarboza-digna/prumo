import { expect, test } from "@playwright/test";

import { addDays, formatLongDate, todayInAppTimeZone, weekdayOf } from "../src/lib/dates";
import { weekdayLongLabels } from "../src/modules/routines/labels";
import {
  createGoal,
  createRoutine,
  expectNoAxeViolations,
  resetDatabase,
  textbox,
} from "./helpers";

test.beforeEach(resetDatabase);

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
  await createRoutine(page, { title: "Ler" });
  await page.goto("/today");

  await page.getByRole("button", { name: "Feito: Ler" }).click();

  await expect(page.getByText("1 de 1 feita")).toBeVisible();
  await expect(page.getByText("Feita", { exact: true }).filter({ visible: true })).toBeVisible();

  await page.getByRole("button", { name: "Desfazer: Ler" }).click();

  await expect(page.getByText("0 de 1 feita")).toBeVisible();
  await expect(page.getByRole("button", { name: "Feito: Ler" })).toBeVisible();
});

test("Pular com nota mostra a rotina como pulada e a nota", async ({ page }) => {
  await createRoutine(page, { title: "Correr" });
  await page.goto("/today");

  await page.getByText("Adicionar nota").click();
  await textbox(page, "Nota (opcional)").fill("Chuva forte");
  await page.getByRole("button", { name: "Pular: Correr" }).click();

  await expect(page.getByText("Pulada", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Chuva forte")).toBeVisible();
  await expect(page.getByText("0 de 1 feita")).toBeVisible();
});

test("rotina fora do dia de hoje não aparece em Hoje, só em Rotinas", async ({ page }) => {
  const otherDay = weekdayLongLabels[weekdayOf(addDays(today, 1))];
  await createRoutine(page, { title: "Revisar a semana", days: [otherDay] });

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
  await createRoutine(page, { title: "Inglês", startDate: addDays(today, -2) });
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
  await createRoutine(page, {
    title: "Antiga",
    startDate: addDays(today, -10),
    endDate: yesterday,
  });
  await createRoutine(page, { title: "Atual" });

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
  await createGoal(page, { title: "Saúde" });
  await createRoutine(page, { title: "Caminhar", goal: "Saúde" });

  await page.getByRole("link", { name: "Saúde" }).click();

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
