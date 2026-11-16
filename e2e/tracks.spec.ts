import { type Page, expect, test } from "@playwright/test";

import {
  addStep,
  createGoal,
  createTrack,
  expectNoAxeViolations,
  resetDatabase,
  textbox,
} from "./helpers";

test.beforeEach(resetDatabase);

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
  await createGoal(page, { title: "Ser sênior" });

  await createTrack(page, { title: "Frontend moderno", goal: "Ser sênior" });

  await expect(page.getByRole("link", { name: "Ser sênior" })).toBeVisible();
  await expect(page.getByText("Nenhuma etapa ainda", { exact: true })).toBeVisible();
});

test("adiciona etapas em ordem e reordena com os botões", async ({ page }) => {
  await createTrack(page, { title: "React" });
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
  await createGoal(page, { title: "Dominar testes" });
  await createTrack(page, { title: "Testes", goal: "Dominar testes" });
  for (const title of ["Unidade", "Integração", "E2E"]) {
    await addStep(page, "Testes", { title });
  }
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
  const tracks = page.getByRole("region", { name: "Trilhas" });
  await expect(
    tracks.getByRole("progressbar", { name: "Progresso do objetivo Dominar testes" }),
  ).toHaveAttribute("aria-valuenow", "67");
  await expect(tracks.getByText("2 de 3 etapas concluídas").first()).toBeVisible();
});

test("etapa com prazo passado e não concluída aparece como atrasada", async ({ page }) => {
  await createTrack(page, { title: "Certificação" });

  await addStep(page, "Certificação", { title: "Prova", dueDate: "2020-01-31" });

  await expect(page.getByText("Atrasada")).toBeVisible();
  await expect(page.getByText("Prazo: 31/01/2020")).toBeVisible();
  await page.getByRole("button", { name: "Concluir: Prova" }).click();
  await expect(page.getByText("Atrasada")).toHaveCount(0);
});

test("link do recurso inválido mostra o erro no campo", async ({ page }) => {
  await createTrack(page, { title: "Leituras" });
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
  await createTrack(page, { title: "Descartável" });
  await addStep(page, "Descartável", { title: "Primeira" });
  await addStep(page, "Descartável", { title: "Segunda" });

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
  await createTrack(page, { title: "Acessível" });
  await addStep(page, "Acessível", {
    title: "Etapa com tudo",
    dueDate: "2020-01-01",
    resourceUrl: "https://example.com",
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
