import { type Page, expect, test } from "@playwright/test";

import { addDays, todayInAppTimeZone } from "../src/lib/dates";
import { insertBook, insertReadingGoal } from "./factories";
import { expectNoAxeViolations, resetDatabase } from "./helpers";

test.beforeEach(resetDatabase);

const today = todayInAppTimeZone();
const year = Number(today.slice(0, 4));

async function openAnalytics(page: Page, query = "") {
  await page.goto(`/books/analytics${query}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Analíticos de leitura" }),
  ).toBeVisible();
}

function region(page: Page, name: string) {
  return page.getByRole("region", { name, exact: true });
}

test("define a meta do ano pela tela e vê o anel e o ritmo (plano 037)", async ({ page }) => {
  await insertBook({ title: "Lido", status: "READ", startedOn: today, finishedOn: today });
  await openAnalytics(page);
  const goal = region(page, `Meta de ${year}`);

  await goal.getByRole("spinbutton", { name: `Livros em ${year}` }).fill("12");
  await goal.getByRole("button", { name: `Definir meta de ${year}` }).click();

  await expect(goal.getByRole("img", { name: "1 de 12 livros da meta" })).toBeVisible();
  await expect(goal.getByText("1 de 12 livros", { exact: true })).toBeVisible();
  await expect(goal.getByRole("button", { name: "Salvar meta" })).toBeVisible();
});

test("mostra os números do ano, as barras e os autores, e troca de ano", async ({ page }) => {
  await insertReadingGoal({ year, books: 10 });
  await insertBook({
    title: "Ensaio",
    authors: "José Saramago",
    genre: "Romance",
    pages: 300,
    status: "READ",
    startedOn: addDays(today, -9),
    finishedOn: today,
    rating: 4,
    logs: [
      { date: addDays(today, -9), position: 100 },
      { date: today, position: 300 },
    ],
  });
  await insertBook({
    title: "Antigo",
    authors: "Clarice Lispector",
    status: "READ",
    startedOn: `${year - 1}-03-01`,
    finishedOn: `${year - 1}-03-15`,
  });

  await openAnalytics(page);
  const numbers = region(page, `${year} em números`);
  await expect(numbers.getByText("Lidos")).toBeVisible();
  await expect(numbers.getByRole("definition").first()).toHaveText("1");
  await expect(numbers.getByText("300", { exact: true })).toBeVisible();
  await expect(numbers.getByText("★ 4")).toBeVisible();
  await expect(
    page.getByRole("figure", { name: "Livros lidos por mês" }).getByRole("row"),
  ).toHaveCount(13);
  await expect(
    page.getByRole("figure", { name: "Páginas por semana (últimas 12)" }).getByRole("row"),
  ).toHaveCount(13);
  await expect(region(page, "Tempo por livro").getByText("10 dias por livro")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Autores mais lidos" }).getByText("José Saramago"),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page
    .getByRole("navigation", { name: "Ano" })
    .getByRole("link", { name: String(year - 1) })
    .click();
  await expect(
    page.getByRole("heading", { level: 2, name: `${year - 1} em números` }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Autores mais lidos" }).getByText("Clarice Lispector"),
  ).toBeVisible();
});

test("ano sem leitura mostra a mensagem", async ({ page }) => {
  await openAnalytics(page, "?ano=2020");

  await expect(page.getByText("Nenhuma leitura registrada em 2020.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para Leituras" })).toHaveAttribute(
    "href",
    "/books",
  );
});

test("a tela de analíticos passa no axe no tema escuro", async ({ page }) => {
  await insertReadingGoal({ year, books: 5 });
  await insertBook({ title: "Lido", status: "READ", startedOn: today, finishedOn: today });
  await page.emulateMedia({ colorScheme: "dark" });
  await openAnalytics(page);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await expectNoAxeViolations(page);
});
