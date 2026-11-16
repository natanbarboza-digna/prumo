import { expect, test } from "@playwright/test";

import {
  addAction,
  addArea,
  combobox,
  createCycle,
  createGoal,
  expectNoAxeViolations,
  resetDatabase,
  textbox,
} from "./helpers";

test.beforeEach(resetDatabase);

const cycle2026 = { title: "PDI 2026", startDate: "2026-01-01", endDate: "2026-12-31" };

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
  await createGoal(page, { title: "Ser tech lead" });
  await createCycle(page, cycle2026);
  await addArea(page, "PDI 2026", "Liderança");
  await addAction(page, "PDI 2026", "Liderança", {
    title: "Mentorar um júnior",
    category: "Mentoria",
    goal: "Ser tech lead",
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
  await createCycle(page, { ...cycle2026, status: "Ativo" });

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
  await createCycle(page, { ...cycle2026, status: "Ativo" });
  await addArea(page, "PDI 2026", "Comunicação");

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
  await createCycle(page, cycle2026);
  await addArea(page, "PDI 2026", "Comunicação");

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
