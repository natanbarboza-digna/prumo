import { type Locator, type Page, expect, test } from "@playwright/test";

import { addDays, todayInAppTimeZone } from "../src/lib/dates";
import { insertTimeDay } from "./factories";
import { expectNoAxeViolations, resetDatabase, textbox } from "./helpers";

test.beforeEach(resetDatabase);

const today = todayInAppTimeZone();
const yesterday = addDays(today, -1);

function block(page: Page, label: string) {
  return page
    .getByRole("list", { name: "Blocos do dia" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: label }) });
}

/** The summary value under a label ("Presença", "Trabalhado", "Pausas", "Sem registro"). */
function summary(page: Page, label: string) {
  return page
    .getByRole("region", { name: "Resumo do dia" })
    .getByRole("definition")
    .filter({
      has: page.locator(`xpath=preceding-sibling::dt[1][normalize-space()="${label}"]`),
    });
}

/** A field of a block: inputs with suggestions and selects are both comboboxes. */
function field(scope: Locator, name: string) {
  return scope.getByRole("combobox", { name, exact: true });
}

async function openDay(page: Page, date: string) {
  await page.goto(`/time?dia=${date}`);
  await expect(page.getByRole("heading", { level: 1, name: "Tempo" })).toBeVisible();
}

test("Tempo no menu; começar um dia às 08:15 mostra o bloco curto (plano 031)", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Tempo" })
    .click();
  await expect(page.getByRole("heading", { level: 2, name: "Começar o dia" })).toBeVisible();

  await page.getByRole("link", { name: "← Dia anterior" }).click();
  await expect(page).toHaveURL(new RegExp(`dia=${yesterday}`));
  await textbox(page, "Entrada").fill("08:15");
  await textbox(page, "Saída").fill("12:00");
  await page.getByRole("button", { name: "Começar o dia" }).click();

  await expect(page.getByRole("heading", { level: 3, name: "08:15–08:30" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "11:30–12:00" })).toBeVisible();
  await expect(summary(page, "Presença")).toHaveText("3h45");
  await expectNoAxeViolations(page);
});

test("preencher, repetir o anterior e marcar pausa atualizam o resumo (plano 031)", async ({
  page,
}) => {
  await insertTimeDay({ date: yesterday, start: "08:00", end: "10:00" });
  await openDay(page, yesterday);

  const first = block(page, "08:00–08:30");
  await field(first, "O que foi feito (08:00–08:30)").fill("Configuração dos relatórios");
  await field(first, "Categoria (08:00–08:30)").selectOption({ label: "Projeto" });
  await field(first, "Projeto ou cliente (08:00–08:30)").fill("Digna");
  await first.getByRole("button", { name: "Salvar 08:00–08:30" }).click();
  await expect(summary(page, "Sem registro")).toHaveText("1h30");

  await page.getByRole("button", { name: "Repetir o anterior em 08:30–09:00" }).click();
  await expect(field(block(page, "08:30–09:00"), "O que foi feito (08:30–09:00)")).toHaveValue(
    "Configuração dos relatórios",
  );
  await page.getByRole("button", { name: "Pausa em 09:00–09:30" }).click();
  await expect(block(page, "09:00–09:30")).toContainText("Pausa");

  await expect(summary(page, "Presença")).toHaveText("2h");
  await expect(summary(page, "Pausas")).toHaveText("30min");
  await expect(summary(page, "Trabalhado")).toHaveText("1h30");
  await expect(summary(page, "Sem registro")).toHaveText("30min");

  await page.getByRole("link", { name: "Projetos e clientes" }).click();
  await expect(page.getByRole("list", { name: "Projetos e clientes" })).toContainText("Digna");
});

test("dividir um bloco e preencher as duas metades (plano 031)", async ({ page }) => {
  await insertTimeDay({ date: yesterday, start: "14:00", end: "15:00" });
  await openDay(page, yesterday);

  await page.getByRole("link", { name: "Dividir 14:00–14:30" }).click();
  const split = block(page, "14:00–14:30");
  for (const [label, text] of [
    ["14:00–14:15", "Configuração do AD"],
    ["14:15–14:30", "Atendimento Hanna e Eugênio"],
  ] as const) {
    await field(split, `O que foi feito (${label})`).fill(text);
    await field(split, `Categoria (${label})`).selectOption({ label: "Atendimento" });
    await split.getByRole("button", { name: `Salvar ${label}` }).click();
    await expect(field(split, `O que foi feito (${label})`)).toHaveValue(text);
  }

  await expect(summary(page, "Sem registro")).toHaveText("30min");
  await expect(split.getByRole("button", { name: "Juntar 14:00–14:30" })).toBeVisible();
});

test("encerrar o dia de hoje e voltar a um dia anterior (plano 031)", async ({ page }) => {
  // From midnight with 1-hour blocks: today's grid stays short whatever the time.
  await insertTimeDay({ date: today, start: "00:00", slotMinutes: 60 });
  await insertTimeDay({ date: addDays(today, -2), start: "09:00", end: "10:00" });
  await openDay(page, today);
  await expect(page.getByText("Dia em aberto")).toBeVisible();

  await page.getByRole("button", { name: "Encerrar o dia" }).click();
  await expect(page.getByText(/Saída \d\d:\d\d/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Encerrar o dia" })).toHaveCount(0);

  await page.getByRole("link", { name: "← Dia anterior" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Começar o dia" })).toBeVisible();
  await page.getByRole("link", { name: "← Dia anterior" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "09:00–09:30" })).toBeVisible();
});

test("categorias de tempo: criar, arquivar e as páginas passam no axe (plano 031)", async ({
  page,
}) => {
  await page.goto("/time/categories");
  await expect(page.getByRole("heading", { level: 1, name: "Categorias de tempo" })).toBeVisible();
  await expectNoAxeViolations(page);

  await textbox(page, "Nome da nova categoria").fill("Leitura técnica");
  await page.getByRole("button", { name: "Criar" }).click();
  const list = page.getByRole("list", { name: "Categorias de tempo" });
  await expect(list).toContainText("Leitura técnica");

  await page.getByRole("button", { name: "Arquivar Leitura técnica" }).click();
  await expect(page.getByRole("button", { name: "Desarquivar Leitura técnica" })).toBeVisible();

  await page.goto("/time/projects");
  await expect(page.getByRole("heading", { level: 1, name: "Projetos e clientes" })).toBeVisible();
  await expectNoAxeViolations(page);
});
