import { type Page, expect, test } from "@playwright/test";

import { addDays, mondayOf, todayInAppTimeZone } from "../src/lib/dates";
import { insertTimeDay } from "./factories";
import { expectNoAxeViolations, resetDatabase } from "./helpers";

test.beforeEach(resetDatabase);

const monday = mondayOf(todayInAppTimeZone());

/** This week's Monday and Tuesday, with the same numbers as the unit tests. */
async function twoDays() {
  await insertTimeDay({
    date: monday,
    start: "08:00",
    end: "12:00",
    entries: [
      { start: "08:00", minutes: 30, description: "E-mail e chamados", category: "Chamados" },
      {
        start: "08:30",
        minutes: 30,
        description: "Configuração digna relatórios",
        project: "Digna",
      },
      {
        start: "09:00",
        minutes: 30,
        description: "Configuração digna relatórios",
        project: "Digna",
      },
      { start: "09:30", minutes: 60, kind: "BREAK", description: "Almoço" },
      {
        start: "10:30",
        minutes: 30,
        description: "configuração Digna relatórios",
        project: "Digna",
      },
      {
        start: "11:00",
        minutes: 30,
        description: "configuração Digna relatórios",
        project: "Digna",
      },
    ],
  });
  await insertTimeDay({
    date: addDays(monday, 1),
    start: "09:00",
    end: "11:00",
    entries: [
      {
        start: "09:00",
        minutes: 30,
        description: "Usuário da Máxima",
        category: "Chamados",
        project: "Máxima",
      },
      {
        start: "09:30",
        minutes: 30,
        description: "Usuário da Máxima",
        category: "Chamados",
        project: "Máxima",
      },
      {
        start: "10:00",
        minutes: 30,
        description: "Configuração Digna relatórios",
        project: "Digna",
      },
      {
        start: "10:30",
        minutes: 30,
        description: "Configuração Digna relatórios",
        project: "Digna",
      },
    ],
  });
}

/** The value under a label in the "Totais" section. */
function total(page: Page, label: string) {
  return page
    .getByRole("region", { name: "Totais" })
    .getByRole("definition")
    .filter({ has: page.locator(`xpath=preceding-sibling::dt[1][normalize-space()="${label}"]`) });
}

test("os analíticos da semana mostram totais, categorias, projetos e atividades (plano 032)", async ({
  page,
}) => {
  await twoDays();
  await page.goto("/time");
  await page.getByRole("link", { name: "Analíticos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Analíticos de tempo" })).toBeVisible();

  await expect(total(page, "Dias registrados")).toHaveText("2");
  await expect(total(page, "Trabalhado")).toHaveText("5h");
  await expect(total(page, "Pausas")).toHaveText("1h");
  await expect(total(page, "Média trabalhada por dia")).toHaveText("2h30");
  await expect(page.getByRole("list", { name: "Por categoria" })).toContainText("3h · 67%");
  await expect(page.getByRole("list", { name: "Por projeto" })).toContainText("Digna");
  await expect(page.getByRole("list", { name: "Por projeto" })).toContainText("Sem projeto");
  const activities = page.getByRole("list", { name: "Atividades que mais tomaram tempo" });
  await expect(activities.getByRole("listitem").first()).toContainText(
    "Configuração Digna relatórios",
  );
  await expect(activities.getByRole("listitem").first()).toContainText("3h · 6 blocos · Projeto");
  await expectNoAxeViolations(page);
});

test("os filtros de período e projeto mudam os números e ficam na URL (plano 032)", async ({
  page,
}) => {
  await twoDays();
  await insertTimeDay({
    date: addDays(monday, -7),
    start: "09:00",
    end: "10:00",
    entries: [{ start: "09:00", minutes: 60, description: "Semana passada", category: "Estudo" }],
  });
  await page.goto("/time/analytics");
  await expect(page.getByRole("heading", { level: 1, name: "Analíticos de tempo" })).toBeVisible();

  await page.getByRole("combobox", { name: "Projeto ou cliente" }).selectOption({ label: "Digna" });
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/projeto=/);
  await expect(total(page, "Tempo filtrado")).toHaveText("3h");

  await page.getByRole("combobox", { name: "Projeto ou cliente" }).selectOption({ label: "Todos" });
  await page.getByRole("combobox", { name: "Período" }).selectOption({ label: "Semana passada" });
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/periodo=lastWeek/);
  await expect(total(page, "Dias registrados")).toHaveText("1");
  await expect(page.getByRole("list", { name: "Atividades que mais tomaram tempo" })).toContainText(
    "Semana passada",
  );
});

test("período sem registros mostra a mensagem (plano 032)", async ({ page }) => {
  await page.goto("/time/analytics?periodo=lastMonth");

  await expect(page.getByText("Nenhum registro neste período.")).toBeVisible();
  await expectNoAxeViolations(page);
});
