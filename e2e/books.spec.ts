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

// ---------------------------------------------------------------------------
// Reading progress, rating and quotes (plan 036)
// ---------------------------------------------------------------------------

async function openBook(page: Page, id: string, title: string) {
  await page.goto(`/books/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

function section(page: Page, name: string) {
  return page.getByRole("region", { name, exact: true });
}

test("registra a leitura de um livro físico e vê página, ritmo e previsão", async ({ page }) => {
  const id = await insertBook({
    title: "Refatoração",
    pages: 400,
    status: "READING",
    startedOn: addDays(today, -4),
    logs: [{ date: addDays(today, -4), position: 20 }],
  });
  await openBook(page, id, "Refatoração");
  const progress = section(page, "Progresso");

  await textbox(page, "Página").fill("100");
  await progress.getByRole("button", { name: "Registrar leitura" }).click();

  await expect(progress.getByText("Página 100 de 400 (25%)")).toBeVisible();
  // 100 pages in 5 days.
  await expect(progress.getByText("Ritmo: 20 páginas por dia")).toBeVisible();
  await expect(
    progress.getByText(`Previsão de término: ${formatDateForDisplay(addDays(today, 15))}`),
  ).toBeVisible();
  const logs = progress.getByRole("list", { name: "Registros de leitura" });
  await expect(logs.getByRole("listitem")).toHaveCount(2);
  await expect(logs.getByRole("listitem").first()).toContainText("+80 páginas");

  // Today's log is replaced, but a page before the earlier day's log is refused.
  await textbox(page, "Página").fill("10");
  await progress.getByRole("button", { name: "Registrar leitura" }).click();
  await expect(progress.getByText("Informe de 20 a 400.")).toBeVisible();
});

test("registra um audiolivro em HH:MM contra a duração", async ({ page }) => {
  const id = await insertBook({
    title: "Ouvido",
    format: "AUDIOBOOK",
    durationMinutes: 600,
    status: "READING",
    startedOn: today,
  });
  await openBook(page, id, "Ouvido");
  const progress = section(page, "Progresso");

  await textbox(page, "Tempo ouvido (HH:MM)").fill("3:20");
  await progress.getByRole("button", { name: "Registrar leitura" }).click();

  await expect(progress.getByText("3h20 de 10h (33%)")).toBeVisible();
});

test("marca como lido, dá nota e resenha, e vê a nota na lista", async ({ page }) => {
  const id = await insertBook({ title: "Hábitos", status: "READING", startedOn: today });
  await openBook(page, id, "Hábitos");

  await page.getByRole("button", { name: "Marcar como lido" }).click();
  const rating = section(page, "Avaliação");
  await expect(rating).toBeVisible();
  await rating.getByRole("radio", { name: "4 ★" }).check();
  await textbox(page, "Resenha (opcional)").fill("Prático e direto.");
  await rating.getByRole("button", { name: "Salvar avaliação" }).click();
  await expect(rating.getByRole("status")).toHaveText("Avaliação salva.");

  await openBooks(page, "?situacao=READ");
  await expect(group(page, "Lidos").getByRole("listitem")).toContainText("★ 4 de 5");
});

test("adiciona, edita e exclui um trecho", async ({ page }) => {
  const id = await insertBook({ title: "Citações" });
  await openBook(page, id, "Citações");
  const quotes = section(page, "Trechos");

  await textbox(page, "Trecho").fill("Primeiro, refatore.");
  await textbox(page, "Onde está (opcional)").fill("p. 50");
  await quotes.getByRole("button", { name: "Adicionar trecho" }).click();
  const list = quotes.getByRole("list", { name: "Trechos" });
  await expect(list.getByText("Primeiro, refatore.")).toBeVisible();

  await list.getByRole("link", { name: /Editar trecho 1/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Editar trecho" })).toBeVisible();
  await textbox(page, "Trecho").fill("Primeiro, refatore; depois, mude.");
  await page.getByRole("button", { name: "Salvar trecho" }).click();
  await expect(list.getByText("Primeiro, refatore; depois, mude.")).toBeVisible();

  await list.getByRole("button", { name: /Excluir trecho 1/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await expect(quotes.getByText("Nenhum trecho marcado ainda.")).toBeVisible();
});

test("a página do livro com progresso, avaliação e trechos passa no axe", async ({ page }) => {
  const id = await insertBook({
    title: "Completo",
    pages: 300,
    status: "READ",
    startedOn: addDays(today, -10),
    finishedOn: today,
    rating: 5,
    logs: [
      { date: addDays(today, -10), position: 100 },
      { date: addDays(today, -5), position: 300 },
    ],
    quotes: [{ text: "Um trecho", location: "p. 3" }],
  });
  await openBook(page, id, "Completo");

  await expectNoAxeViolations(page);
});
