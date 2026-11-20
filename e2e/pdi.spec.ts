import { type Page, expect, test } from "@playwright/test";

import { type CycleData, insertCycle, insertGoal } from "./factories";
import {
  addAction,
  addArea,
  combobox,
  createCycle,
  expectNoAxeViolations,
  resetDatabase,
  textbox,
} from "./helpers";

test.beforeEach(resetDatabase);

const cycle2026 = { title: "PDI 2026", startDate: "2026-01-01", endDate: "2026-12-31" };

/** A cycle written to the database (plan 018), then its page. */
async function openCycle(page: Page, data: Partial<CycleData> = {}) {
  const { id } = await insertCycle({ ...cycle2026, ...data });
  await page.goto(`/pdi/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "PDI 2026" })).toBeVisible();
}

test("PDI vazio convida a criar o primeiro ciclo", async ({ page }) => {
  await page.goto("/pdi");

  await expect(page.getByText("Nenhum ciclo de PDI cadastrado.")).toBeVisible();
  await page.getByRole("link", { name: "Criar ciclo" }).click();

  await expect(page).toHaveURL("/pdi/new");
});

test("cria ciclo, área, ação e check-in", async ({ page }) => {
  await createCycle(page, { ...cycle2026, status: "Ativo" });
  await addArea(page, "PDI 2026", "Comunicação");
  await addAction(page, "PDI 2026", "Comunicação", {
    title: "Curso de oratória",
    category: "Curso",
  });

  await page.getByRole("link", { name: "Registrar check-in" }).click();
  await textbox(page, "Resumo").fill("Primeiro alinhamento com a gestora");
  await page.getByRole("button", { name: "Registrar check-in" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "PDI 2026" })).toBeVisible();
  const areas = page.getByRole("list", { name: "Áreas" });
  await expect(areas.getByRole("heading", { name: "Comunicação" })).toBeVisible();
  await expect(areas.getByRole("heading", { name: "Curso de oratória" })).toBeVisible();
  await expect(page.getByText("Primeiro alinhamento com a gestora")).toBeVisible();
  await expect(page.getByText("0 de 1 ação concluída")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("concluir a ação atualiza o progresso do ciclo e do objetivo", async ({ page }) => {
  const goalId = await insertGoal({ title: "Ser tech lead" });
  await openCycle(page, {
    areas: [
      {
        name: "Liderança",
        actions: [{ title: "Mentorar um júnior", category: "Mentoria", goalId }],
      },
    ],
  });

  await page.getByRole("link", { name: "Editar ação: Mentorar um júnior" }).click();
  await combobox(page, "Status").selectOption({ label: "Concluída" });
  await textbox(page, "Evidência (opcional)").fill("Mentoria semanal por 3 meses");
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page.getByText("1 de 1 ação concluída")).toBeVisible();
  await expect(page.getByText("Mentoria semanal por 3 meses")).toBeVisible();

  await page.getByRole("link", { name: "Ser tech lead" }).click();
  await expect(page.getByText("1 de 1 item concluído")).toBeVisible();
  const section = page.getByRole("region", { name: "Ações de PDI" });
  await expect(section.getByRole("heading", { name: "Mentorar um júnior" })).toBeVisible();
  await expect(section.getByRole("link", { name: "PDI 2026" })).toBeVisible();
});

test("um segundo ciclo ativo mostra o erro no status", async ({ page }) => {
  await insertCycle({ ...cycle2026, status: "ACTIVE" });

  await page.goto("/pdi/new");
  await textbox(page, "Título").fill("PDI paralelo");
  await textbox(page, "Início").fill("2026-06-01");
  await textbox(page, "Fim").fill("2026-12-31");
  await combobox(page, "Status").selectOption({ label: "Ativo" });
  await page.getByRole("button", { name: "Criar ciclo" }).click();

  await expect(combobox(page, "Status")).toHaveAccessibleDescription(
    "Já existe um ciclo ativo. Encerre-o antes de ativar outro.",
  );
});

test("encerrar deixa o ciclo somente leitura e reabrir devolve a edição", async ({ page }) => {
  await openCycle(page, { status: "ACTIVE", areas: [{ name: "Comunicação" }] });

  await page.getByRole("button", { name: "Encerrar ciclo" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Encerrar" }).click();

  await expect(page.getByText("Ciclo encerrado: somente leitura.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar ciclo" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Adicionar área" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Adicionar ação em Comunicação" })).toHaveCount(0);
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Reabrir ciclo" }).click();

  await expect(page.getByRole("link", { name: "Editar ciclo" })).toBeVisible();
  await expect(page.getByText("Ciclo encerrado: somente leitura.")).toHaveCount(0);
});

test("datas invertidas no ciclo mostram o erro no fim", async ({ page }) => {
  await page.goto("/pdi/new");
  await textbox(page, "Título").fill("Datas erradas");
  await textbox(page, "Início").fill("2026-12-31");
  await textbox(page, "Fim").fill("2026-01-01");
  await page.getByRole("button", { name: "Criar ciclo" }).click();

  await expect(textbox(page, "Fim")).toHaveAccessibleDescription(
    "O fim não pode ser antes do início.",
  );
});

test("as páginas do PDI passam na verificação de acessibilidade", async ({ page }) => {
  await insertCycle({ ...cycle2026, areas: [{ name: "Comunicação" }] });

  await page.goto("/pdi");
  await expect(page.getByRole("heading", { level: 1, name: "PDI" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "PDI 2026" }).click();
  await page.getByRole("link", { name: "Adicionar ação em Comunicação" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nova ação" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/pdi/new");
  await expect(page.getByRole("heading", { level: 1, name: "Novo ciclo de PDI" })).toBeVisible();
  await expectNoAxeViolations(page);
});

/** The headings of the areas, or of the actions of one area, in screen order. */
function areaNames(page: Page) {
  return page.getByRole("list", { name: "Áreas" }).getByRole("heading", { level: 3 });
}

function actionTitles(page: Page, area: string) {
  return page
    .getByRole("list", { name: "Áreas" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: area }) })
    .getByRole("heading", { level: 4 });
}

test("as setas mudam a ordem das áreas e das ações (plano 021)", async ({ page }) => {
  await openCycle(page, {
    areas: [
      { name: "Comunicação", actions: [{ title: "Curso", category: "Curso" }] },
      {
        name: "Liderança",
        actions: [
          // Earlier due date listed second: the manual order decides, not the date.
          { title: "Mentoria", category: "Mentoria", dueDate: "2026-12-01" },
          { title: "Leitura", category: "Leitura", dueDate: "2026-06-01" },
        ],
      },
    ],
  });
  await expect(areaNames(page)).toHaveText(["Comunicação", "Liderança"]);
  await expect(actionTitles(page, "Liderança")).toHaveText(["Mentoria", "Leitura"]);
  await expect(page.getByRole("button", { name: "Mover para cima: Comunicação" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Mover para baixo: Leitura" })).toBeDisabled();

  await page.getByRole("button", { name: "Mover para baixo: Comunicação" }).click();
  await expect(areaNames(page)).toHaveText(["Liderança", "Comunicação"]);

  await page.getByRole("button", { name: "Mover para cima: Leitura" }).click();
  await expect(actionTitles(page, "Liderança")).toHaveText(["Leitura", "Mentoria"]);

  // The order is saved: it survives a reload.
  await page.reload();
  await expect(areaNames(page)).toHaveText(["Liderança", "Comunicação"]);
  await expect(actionTitles(page, "Liderança")).toHaveText(["Leitura", "Mentoria"]);
  await expectNoAxeViolations(page);
});

test("ciclo encerrado não mostra as setas (plano 021)", async ({ page }) => {
  await openCycle(page, {
    status: "CLOSED",
    areas: [
      { name: "Comunicação", actions: [{ title: "Curso", category: "Curso" }] },
      { name: "Liderança" },
    ],
  });
  await expect(areaNames(page)).toHaveText(["Comunicação", "Liderança"]);

  await expect(page.getByRole("button", { name: /^Mover para/ })).toHaveCount(0);
});
