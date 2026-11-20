import { type Page, expect, test } from "@playwright/test";

import { type StepData, insertGoal, insertTrack } from "./factories";
import { addStep, createTrack, expectNoAxeViolations, resetDatabase, textbox } from "./helpers";

test.beforeEach(resetDatabase);

/** A track (and its steps) written to the database (plan 018), then its page. */
async function openTrack(
  page: Page,
  title: string,
  options: { goalId?: string; steps?: StepData[] } = {},
) {
  const { id } = await insertTrack({ title, ...options });
  await page.goto(`/tracks/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

function stepHeadings(page: Page) {
  return page.getByRole("list", { name: "Etapas" }).getByRole("heading", { level: 3 });
}

test("lista vazia convida a criar a primeira trilha", async ({ page }) => {
  await page.goto("/tracks");

  await expect(page.getByText("Você ainda não tem trilhas cadastradas.")).toBeVisible();
  await page.getByRole("link", { name: "Criar trilha" }).click();

  await expect(page).toHaveURL("/tracks/new");
});

test("cria uma trilha vinculada a um objetivo", async ({ page }) => {
  await insertGoal({ title: "Ser sênior" });

  await createTrack(page, { title: "Frontend moderno", goal: "Ser sênior" });

  await expect(page.getByRole("link", { name: "Ser sênior" })).toBeVisible();
  await expect(page.getByText("Nenhuma etapa ainda", { exact: true })).toBeVisible();
});

test("adiciona etapas em ordem e reordena com os botões", async ({ page }) => {
  await openTrack(page, "React");
  await addStep(page, "React", { title: "Componentes" });
  await addStep(page, "React", { title: "Hooks" });
  await addStep(page, "React", { title: "Server Components" });

  await expect(stepHeadings(page)).toHaveText(["1.Componentes", "2.Hooks", "3.Server Components"]);
  await expect(page.getByRole("button", { name: "Mover para cima: Componentes" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Mover para baixo: Server Components" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Mover para cima: Server Components" }).click();

  await expect(stepHeadings(page)).toHaveText(["1.Componentes", "2.Server Components", "3.Hooks"]);
});

test("concluir etapas atualiza o progresso da trilha e do objetivo", async ({ page }) => {
  const goalId = await insertGoal({ title: "Dominar testes" });
  await openTrack(page, "Testes", {
    goalId,
    steps: [{ title: "Unidade" }, { title: "Integração" }, { title: "E2E" }],
  });
  await expect(page.getByText("0 de 3 etapas concluídas")).toBeVisible();

  await page.getByRole("button", { name: "Concluir: Unidade" }).click();

  await expect(page.getByText("1 de 3 etapas concluídas")).toBeVisible();
  await expect(page.getByText("Em andamento").filter({ visible: true })).toHaveCount(1);

  await page.getByRole("button", { name: "Concluir: Integração" }).click();
  await expect(page.getByText("2 de 3 etapas concluídas")).toBeVisible();
  await page.getByRole("button", { name: "Concluir: E2E" }).click();

  await expect(page.getByText("3 de 3 etapas concluídas")).toBeVisible();
  // Three step badges plus the track badge. filter({ visible: true }) skips the
  // hidden copies of pages Next keeps in the DOM (e.g. the step form options).
  await expect(page.getByText("Concluída", { exact: true }).filter({ visible: true })).toHaveCount(
    4,
  );

  await page.getByRole("button", { name: "Reabrir: E2E" }).click();
  await expect(page.getByText("2 de 3 etapas concluídas")).toBeVisible();

  await page.getByRole("link", { name: "Dominar testes" }).click();
  const progress = page.getByRole("region", { name: "Progresso" });
  await expect(
    progress.getByRole("progressbar", { name: "Progresso do objetivo Dominar testes" }),
  ).toHaveAttribute("aria-valuenow", "67");
  await expect(progress.getByText("2 de 3 itens concluídos")).toBeVisible();
  const tracks = page.getByRole("region", { name: "Trilhas" });
  await expect(tracks.getByText("2 de 3 etapas concluídas").first()).toBeVisible();
});

test("etapa com prazo passado e não concluída aparece como atrasada", async ({ page }) => {
  await openTrack(page, "Certificação", { steps: [{ title: "Prova", dueDate: "2020-01-31" }] });

  await expect(page.getByText("Atrasada")).toBeVisible();
  await expect(page.getByText("Prazo: 31/01/2020")).toBeVisible();
  await page.getByRole("button", { name: "Concluir: Prova" }).click();
  await expect(page.getByText("Atrasada")).toHaveCount(0);
});

test("link do recurso inválido mostra o erro no campo", async ({ page }) => {
  await openTrack(page, "Leituras");
  await page.getByRole("link", { name: "Adicionar etapa" }).click();
  await textbox(page, "Título").fill("Artigo");
  const url = textbox(page, "Link do recurso (opcional)");
  await url.fill("javascript:alert(1)");

  await page.getByRole("button", { name: "Adicionar etapa" }).click();

  await expect(url).toBeFocused();
  await expect(url).toHaveAccessibleDescription(
    "Informe um link começando com http:// ou https://.",
  );

  await url.fill("https://nextjs.org/docs");
  await page.getByRole("button", { name: "Adicionar etapa" }).click();
  await expect(page.getByRole("link", { name: /https:\/\/nextjs\.org\/docs/ })).toHaveAttribute(
    "target",
    "_blank",
  );
});

test("excluir etapa e trilha pedem confirmação", async ({ page }) => {
  await openTrack(page, "Descartável", { steps: [{ title: "Primeira" }, { title: "Segunda" }] });

  await page.getByRole("button", { name: "Excluir: Primeira" }).click();
  const stepDialog = page.getByRole("alertdialog", { name: "Excluir etapa?" });
  await stepDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(stepHeadings(page)).toHaveCount(2);

  await page.getByRole("button", { name: "Excluir: Primeira" }).click();
  await stepDialog.getByRole("button", { name: "Excluir" }).click();
  await expect(stepHeadings(page)).toHaveText(["1.Segunda"]);

  await page.getByRole("button", { name: "Excluir trilha" }).click();
  await page
    .getByRole("alertdialog", { name: "Excluir trilha?" })
    .getByRole("button", { name: "Excluir" })
    .click();

  await expect(page).toHaveURL("/tracks");
  await expect(page.getByText("Você ainda não tem trilhas cadastradas.")).toBeVisible();
});

test("lista, detalhe e formulários de trilha passam no axe", async ({ page }) => {
  await openTrack(page, "Acessível", {
    steps: [{ title: "Etapa com tudo", dueDate: "2020-01-01", resourceUrl: "https://example.com" }],
  });
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Adicionar etapa" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nova etapa" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/tracks");
  await expect(page.getByRole("heading", { level: 1, name: "Trilhas" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/tracks/new");
  await expect(page.getByRole("heading", { level: 1, name: "Nova trilha" })).toBeVisible();
  await expectNoAxeViolations(page);
});

function trackLinks(page: Page) {
  return page.getByRole("list", { name: "Trilhas" }).getByRole("heading", { level: 2 });
}

function trackFilter(page: Page) {
  return page.getByRole("navigation", { name: "Filtrar trilhas" });
}

test("arquivar deixa a trilha somente leitura e fora da lista padrão (plano 024)", async ({
  page,
}) => {
  await openTrack(page, "Inglês", { steps: [{ title: "Gramática" }] });

  await page.getByRole("button", { name: "Arquivar trilha" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Arquivar trilha?" });
  await dialog.getByRole("button", { name: "Arquivar" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("note")).toContainText("somente leitura");
  await expect(page.getByRole("button", { name: "Desarquivar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar trilha" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Adicionar etapa" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Concluir: Gramática" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Excluir trilha" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/tracks");
  await expect(page.getByText("Você ainda não tem trilhas cadastradas.")).toBeVisible();
  await trackFilter(page).getByRole("link", { name: "Arquivadas" }).click();
  await expect(trackLinks(page)).toHaveText(["Inglês"]);
  await expect(page.getByRole("list", { name: "Trilhas" })).toContainText("Arquivada");
});

test("desarquivar devolve a edição e a trilha à lista (plano 024)", async ({ page }) => {
  const { id } = await insertTrack({ title: "Inglês", archivedAt: new Date() });
  await page.goto(`/tracks/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Inglês" })).toBeVisible();

  await page.getByRole("button", { name: "Desarquivar" }).click();

  await expect(page.getByRole("button", { name: "Arquivar trilha" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Adicionar etapa" })).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
  await page.goto("/tracks");
  await expect(trackLinks(page)).toHaveText(["Inglês"]);
});

test("os filtros da lista mostram só as trilhas da situação (plano 024)", async ({ page }) => {
  await insertTrack({ title: "Não começada", steps: [{ title: "A" }] });
  await insertTrack({
    title: "Começada",
    steps: [{ title: "A", status: "DONE" }, { title: "B" }],
  });
  await insertTrack({ title: "Terminada", steps: [{ title: "A", status: "DONE" }] });
  await insertTrack({ title: "Guardada", archivedAt: new Date() });

  await page.goto("/tracks");
  await expect(page.getByRole("heading", { level: 1, name: "Trilhas" })).toBeVisible();
  await expect(trackFilter(page).locator('[aria-current="page"]')).toHaveText("Ativas");
  await expect(trackLinks(page)).toHaveCount(3);

  await trackFilter(page).getByRole("link", { name: "Em andamento" }).click();
  await expect(trackLinks(page)).toHaveText(["Começada"]);
  await trackFilter(page).getByRole("link", { name: "Concluídas" }).click();
  await expect(trackLinks(page)).toHaveText(["Terminada"]);
  await trackFilter(page).getByRole("link", { name: "Todas" }).click();
  await expect(trackLinks(page)).toHaveCount(4);
  await expectNoAxeViolations(page);
});

test("duplicar cria a cópia com as etapas do zero e abre a cópia (plano 026)", async ({ page }) => {
  await openTrack(page, "Inglês", {
    steps: [
      { title: "Gramática", status: "DONE", dueDate: "2026-10-01" },
      { title: "Conversação", status: "IN_PROGRESS" },
    ],
  });

  await page.getByRole("button", { name: "Duplicar trilha" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Cópia de Inglês" })).toBeVisible();
  await expect(stepHeadings(page)).toHaveText(["1.Gramática", "2.Conversação"]);
  const steps = page.getByRole("list", { name: "Etapas" });
  await expect(steps.getByText("Não iniciada")).toHaveCount(2);
  await expect(steps.getByText("Prazo:")).toHaveCount(0);

  await page.goto("/tracks");
  await expect(trackLinks(page)).toHaveText(["Cópia de Inglês", "Inglês"]);
});

test("duplicar uma trilha arquivada gera uma cópia ativa (plano 026)", async ({ page }) => {
  const { id } = await insertTrack({
    title: "Roteiro antigo",
    steps: [{ title: "Primeira" }],
    archivedAt: new Date(),
  });
  await page.goto(`/tracks/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Roteiro antigo" })).toBeVisible();

  await page.getByRole("button", { name: "Duplicar trilha" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Cópia de Roteiro antigo" }),
  ).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Arquivar trilha" })).toBeVisible();
});
