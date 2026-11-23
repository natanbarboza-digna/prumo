import { type Page, expect, test } from "@playwright/test";

import { addDays, formatDateForDisplay, todayInAppTimeZone } from "../src/lib/dates";
import { expectNoAxeViolations, resetDatabase } from "./helpers";

test.beforeEach(resetDatabase);

// A day in the past, so the import never meets "dia no futuro".
const day = addDays(todayInAppTimeZone(), -7);
const [year, month, date] = day.split("-");
const label = `${date}/${month}`;

const HISTORY = `**${label}**
08:15 - cheguei
08:30 - olhei a caixa de e-mail, chamados
09:00 - atendi ao chamado de pasta segura
10:00 - configuração digna relatórios
12:30 - almoço
13:30 - resolvendo usuário da máxima
14:00 - configuração do ad para o digna relatórios
18:30 - fim do expediente`;

function field(page: Page, name: string) {
  return page.getByRole("textbox", { name, exact: true });
}

async function openImport(page: Page) {
  await page.goto("/time");
  await page.getByRole("link", { name: "Importar histórico" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Importar histórico" })).toBeVisible();
}

async function fill(page: Page, text: string) {
  await field(page, "Texto do histórico").fill(text);
  await page.getByRole("spinbutton", { name: "Ano" }).fill(year ?? "");
  await page
    .getByRole("combobox", { name: "Categoria padrão" })
    .selectOption({ label: "Chamados" });
  await field(page, "Regras de categoria (opcional)").fill(
    "chamado = Chamados\nconfiguração = Projeto",
  );
  await field(page, "Regras de projeto (opcional)").fill("digna = Digna\nmáxima = Máxima");
  await page.getByRole("button", { name: "Conferir" }).click();
}

test("colar o histórico mostra a prévia e confirmar grava os dias (plano 033)", async ({
  page,
}) => {
  await openImport(page);
  await expectNoAxeViolations(page);

  await fill(page, HISTORY);

  await expect(
    page.getByRole("heading", { level: 2, name: "Confira antes de importar" }),
  ).toBeFocused();
  // 08:30, 09:00–10:00 (2), 10:00–12:30 (5), lunch (2), 13:30, 14:00–18:30 (9).
  await expect(page.getByRole("status")).toHaveText(
    "Serão criados 1 dia e 20 registros (18 de trabalho e 2 pausas).",
  );
  await expect(page.getByText("Projetos novos: Digna, Máxima.")).toBeVisible();
  const days = page.getByRole("list", { name: "Dias do histórico" });
  await days.getByText(formatDateForDisplay(day), { exact: false }).click();
  await expect(days).toContainText("12:30–13:00 Pausa");
  await expect(days).toContainText("configuração digna relatórios · Projeto · Digna");
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Confirmar importação" }).click();

  await expect(page).toHaveURL(new RegExp(`/time\\?dia=${day}`));
  await expect(page.getByText("Entrada 08:15 · Saída 18:30")).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "08:30–09:00" })).toBeVisible();
});

test("um problema lista a linha e não grava nada (plano 033)", async ({ page }) => {
  await openImport(page);

  await fill(page, `**${label}**\n08:00 - e-mail\n08:10 - fora da grade\n09:00 - fim`);

  const problems = page.getByRole("list", { name: "Problemas na importação" });
  await expect(problems).toContainText("Texto, linha 2:");
  await expect(problems).toContainText("blocos de 30 minutos");
  await expect(page.getByRole("button", { name: "Confirmar importação" })).toHaveCount(0);

  await page.goto(`/time?dia=${day}`);
  await expect(page.getByRole("heading", { level: 2, name: "Começar o dia" })).toBeVisible();
});
