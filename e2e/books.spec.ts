import { type Page, expect, test } from "@playwright/test";

import { addDays, formatDateForDisplay, todayInAppTimeZone } from "../src/lib/dates";
import { insertBook, insertGoal } from "./factories";
import { combobox, expectNoAxeViolations, resetDatabase, textbox } from "./helpers";

test.beforeEach(resetDatabase);

const today = todayInAppTimeZone();

async function openBooks(page: Page, query = "") {
  await page.goto(`/books${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Leituras" })).toBeVisible();
}

function group(page: Page, name: string) {
  return page.getByRole("list", { name, exact: true });
}

test("cadastra um livro pela tela, com prazo só para trabalho ou PDI (plano 035)", async ({
  page,
}) => {
  await insertGoal({ title: "Ler mais", status: "IN_PROGRESS" });
  await page.goto("/books/new");
  await expect(page.getByRole("heading", { level: 1, name: "Novo livro" })).toBeVisible();

  await textbox(page, "Título").fill("Duna");
  await textbox(page, "Autor(es)").fill("Frank Herbert");
  await page.getByRole("spinbutton", { name: "Páginas (opcional)" }).fill("600");
  await combobox(page, "Objetivo (opcional)").selectOption({ label: "Ler mais" });
  // Personal books have no due date.
  await expect(textbox(page, "Prazo (opcional)")).toHaveCount(0);
  await combobox(page, "Motivo").selectOption({ label: "Trabalho" });
  await textbox(page, "Prazo (opcional)").fill(addDays(today, 10));
  await page.getByRole("button", { name: "Cadastrar livro" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Duna" })).toBeVisible();
  await expect(page.getByText("Preciso ler", { exact: true })).toBeVisible();
  await expect(page.getByText(formatDateForDisplay(addDays(today, 10)))).toBeVisible();

  await openBooks(page);
  await expect(group(page, "Preciso ler").getByRole("link", { name: "Duna" })).toBeVisible();
});

test("começa a ler e marca como lido, mudando de grupo com as datas", async ({ page }) => {
  const id = await insertBook({ title: "Hábitos Atômicos", authors: "James Clear" });
  await page.goto(`/books/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Hábitos Atômicos" })).toBeVisible();
  await expect(page.getByText("Quero ler", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Começar a ler" }).click();
  await expect(page.getByRole("button", { name: "Marcar como lido" })).toBeVisible();
  await expect(page.getByText("Lendo", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Marcar como lido" }).click();
  await expect(page.getByRole("button", { name: "Ler de novo" })).toBeVisible();
  await expect(page.getByText("Lido", { exact: true })).toBeVisible();

  await openBooks(page, "?situacao=READ");
  const read = group(page, "Lidos");
  await expect(read.getByRole("link", { name: "Hábitos Atômicos" })).toBeVisible();
  const date = formatDateForDisplay(today);
  await expect(read.getByText(`De ${date} a ${date}`)).toBeVisible();
});

test("os filtros mostram cada situação e a lista vazia", async ({ page }) => {
  await openBooks(page);
  await expect(page.getByText("Nenhum livro na estante.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cadastrar livro" })).toBeVisible();

  await insertBook({ title: "Lendo agora", status: "READING", startedOn: today });
  await insertBook({ title: "Obrigatório", reason: "PDI", dueDate: addDays(today, -1) });
  await insertBook({ title: "Vontade", reason: "RECOMMENDATION" });
  await insertBook({
    title: "Terminado",
    status: "READ",
    startedOn: addDays(today, -9),
    finishedOn: today,
  });

  await openBooks(page);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Lendo (1)",
    "Preciso ler (1)",
    "Quero ler (1)",
  ]);
  await expect(group(page, "Preciso ler").getByText(/Prazo vencido em/)).toBeVisible();

  const filters = page.getByRole("navigation", { name: "Filtrar livros" });
  await filters.getByRole("link", { name: "Abandonados" }).click();
  await expect(page.getByText("Nenhum livro abandonado.")).toBeVisible();
  await filters.getByRole("link", { name: "Todos" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Lendo (1)",
    "Preciso ler (1)",
    "Quero ler (1)",
    "Lidos (1)",
  ]);
});

test("edita e exclui um livro com confirmação", async ({ page }) => {
  const id = await insertBook({
    title: "Rascunho",
    status: "READ",
    startedOn: addDays(today, -5),
    finishedOn: addDays(today, -1),
  });
  await page.goto(`/books/${id}/edit`);
  await expect(page.getByRole("heading", { level: 1, name: "Editar livro" })).toBeVisible();

  await textbox(page, "Título").fill("Refatoração");
  await textbox(page, "Término").fill(addDays(today, -6));
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("O término não pode ser antes do início.")).toBeVisible();

  await textbox(page, "Término").fill(addDays(today, -2));
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Refatoração" })).toBeVisible();
  await expect(page.getByText(formatDateForDisplay(addDays(today, -2)))).toBeVisible();

  await page.getByRole("button", { name: "Excluir livro" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Leituras" })).toBeVisible();
  await expect(page.getByText("Nenhum livro na estante.")).toBeVisible();
});

test("a aba Leituras marca Desenvolvimento e passa no axe nos dois temas", async ({ page }) => {
  const id = await insertBook({ title: "Duna", reason: "WORK", dueDate: addDays(today, 3) });

  await openBooks(page);
  await expect(
    page
      .getByRole("navigation", { name: "Desenvolvimento" })
      .getByRole("link", { name: "Leituras" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Desenvolvimento" }),
  ).toHaveAttribute("aria-current", "page");
  await expectNoAxeViolations(page);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`/books/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Duna" })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expectNoAxeViolations(page);
});
