import { type Page, expect, test } from "@playwright/test";

import { addDays, todayInAppTimeZone } from "../src/lib/dates";
import { type ActionData, insertCycle, insertGoal, insertRoutine } from "./factories";
import { combobox, expectNoAxeViolations, resetDatabase, textbox } from "./helpers";

test.beforeEach(resetDatabase);

// The same "today" the app uses (America/Fortaleza), whatever the machine's zone.
const today = todayInAppTimeZone();
const cycle = { title: "PDI atual", startDate: addDays(today, -30), endDate: addDays(today, 60) };

/**
 * An active cycle with one area and a "Prática" action (its category allows
 * routines), written to the database (plan 018). Opens the cycle page.
 */
async function practiceAction(
  page: Page,
  options: { dueDate?: string; goalId?: string; otherActions?: ActionData[] } = {},
) {
  const created = await insertCycle({
    ...cycle,
    status: "ACTIVE",
    areas: [
      {
        name: "Comunicação",
        actions: [
          {
            title: "Praticar oratória",
            category: "Prática",
            dueDate: options.dueDate,
            goalId: options.goalId,
          },
          ...(options.otherActions ?? []),
        ],
      },
    ],
  });
  await page.goto(`/pdi/${created.id}`);
  await expect(page.getByRole("heading", { level: 1, name: cycle.title })).toBeVisible();
  return { cycleId: created.id, actionId: created.actionIds["Praticar oratória"] ?? "" };
}

/** practiceAction plus an every-day routine linked to it, then the action page. */
async function practiceActionWithRoutine(page: Page) {
  const { cycleId, actionId } = await practiceAction(page);
  await insertRoutine({
    title: "Praticar oratória",
    startDate: today,
    pdiActionId: actionId,
  });
  await page.goto(`/pdi/${cycleId}/actions/${actionId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Praticar oratória" })).toBeVisible();
}

/** From the cycle page: "Criar rotina" on the action, every day, saved. Ends on the action page. */
async function createRoutineFromAction(page: Page, actionTitle: string) {
  await page.getByRole("link", { name: `Criar rotina para: ${actionTitle}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nova rotina" })).toBeVisible();
  for (const day of [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
  ]) {
    await page.getByRole("checkbox", { name: day, exact: true }).check();
  }
  await page.getByRole("button", { name: "Criar rotina" }).click();
  await expect(page.getByRole("heading", { level: 1, name: actionTitle })).toBeVisible();
}

function linkedRoutines(page: Page) {
  return page.getByRole("region", { name: "Rotinas vinculadas" });
}

test("só ações de categoria que permite rotina oferecem criar rotina", async ({ page }) => {
  await practiceAction(page, {
    otherActions: [{ title: "Curso de oratória", category: "Curso" }],
  });

  await expect(
    page.getByRole("link", { name: "Criar rotina para: Praticar oratória" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Criar rotina para: Curso de oratória" }),
  ).toHaveCount(0);
});

test("criar rotina a partir da ação vem preenchido e volta para a ação", async ({ page }) => {
  const dueDate = addDays(today, 20);
  const goalId = await insertGoal({ title: "Falar em público" });
  await practiceAction(page, { dueDate, goalId });

  await page.getByRole("link", { name: "Criar rotina para: Praticar oratória" }).click();
  await expect(textbox(page, "Título")).toHaveValue("Praticar oratória");
  await expect(textbox(page, "Fim (opcional)")).toHaveValue(dueDate);
  await expect(combobox(page, "Objetivo (opcional)")).toHaveValue(/.+/);
  await expect(page.getByRole("note")).toContainText("Vinculada à ação de PDI Praticar oratória");
  await expectNoAxeViolations(page);

  await page.goBack();
  await createRoutineFromAction(page, "Praticar oratória");

  const routines = linkedRoutines(page);
  await routines.getByRole("link", { name: "Praticar oratória" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Praticar oratória" })).toBeVisible();
  await expect(page.getByText("Ação de PDI:")).toBeVisible();
  await expect(page.getByRole("link", { name: "Falar em público" })).toBeVisible();
});

test("o registro em Hoje aparece na ação como evidência", async ({ page }) => {
  await practiceActionWithRoutine(page);

  await page.goto("/today");
  await page.getByRole("button", { name: "Feito: Praticar oratória" }).click();
  await expect(page.getByRole("button", { name: "Desfazer: Praticar oratória" })).toBeVisible();

  await page.goto("/pdi");
  await page.getByRole("link", { name: cycle.title }).click();
  await expect(page.getByText("Rotina: 100% de adesão")).toBeVisible();
  await page.getByRole("link", { name: "Praticar oratória", exact: true }).click();

  await expect(linkedRoutines(page).getByText("1 de 1 dia feito, 100%")).toBeVisible();
  const logs = page.getByRole("list", { name: "Registros" });
  await expect(logs.getByRole("listitem")).toHaveCount(1);
  await expect(logs).toContainText("Feita");
  await expectNoAxeViolations(page);
});

test("concluir a ação pede o destino da rotina; encerrar mantém a evidência", async ({ page }) => {
  await practiceActionWithRoutine(page);

  await page.getByRole("link", { name: "Editar ação" }).click();
  const outcome = page.getByRole("group", { name: "O que fazer com as rotinas vinculadas?" });
  await expect(outcome).toBeHidden();
  await combobox(page, "Status").selectOption({ label: "Concluída" });
  await expect(outcome).toBeVisible();

  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(outcome).toHaveAccessibleDescription(
    /Escolha o que fazer com as rotinas vinculadas\./,
  );

  await outcome.getByRole("radio", { name: "Encerrar a rotina" }).check();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("heading", { level: 1, name: cycle.title })).toBeVisible();

  await page.getByRole("link", { name: "Praticar oratória", exact: true }).click();
  await expect(linkedRoutines(page).getByText("Termina hoje")).toBeVisible();
});

test("cancelar mantendo a rotina sem vínculo tira a rotina da ação", async ({ page }) => {
  await practiceActionWithRoutine(page);

  await page.getByRole("link", { name: "Editar ação" }).click();
  await combobox(page, "Status").selectOption({ label: "Cancelada" });
  await page.getByRole("radio", { name: "Manter a rotina, sem vínculo" }).check();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("heading", { level: 1, name: cycle.title })).toBeVisible();

  await page.getByRole("link", { name: "Praticar oratória", exact: true }).click();
  await expect(linkedRoutines(page).getByText(/Nenhuma rotina vinculada/)).toBeVisible();

  await page.goto("/routines");
  const list = page.getByRole("list", { name: "Rotinas" });
  await expect(list.getByRole("link", { name: "Praticar oratória" })).toBeVisible();
  await expect(list.getByText("PDI", { exact: true })).toHaveCount(0);
});

test("desligar 'permite rotina' bloqueia novas rotinas e mantém a existente", async ({ page }) => {
  await practiceActionWithRoutine(page);

  await page.goto("/settings/categories");
  await page.getByRole("link", { name: "Editar: Prática" }).click();
  await page.getByRole("checkbox", { name: /Permite criar rotina/ }).uncheck();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Categorias de ação" })).toBeVisible();

  await page.goto("/pdi");
  await page.getByRole("link", { name: cycle.title }).click();
  await expect(
    page.getByRole("link", { name: "Criar rotina para: Praticar oratória" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Praticar oratória", exact: true }).click();
  await expect(linkedRoutines(page).getByRole("link", { name: "Praticar oratória" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar rotina" })).toHaveCount(0);
});

test("vincular uma rotina existente pela página da ação (plano 020)", async ({ page }) => {
  const { cycleId, actionId } = await practiceAction(page);
  const routineId = await insertRoutine({
    title: "Ler em voz alta",
    startDate: addDays(today, -3),
    logs: [{ date: addDays(today, -1) }],
  });
  await page.goto(`/pdi/${cycleId}/actions/${actionId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Praticar oratória" })).toBeVisible();
  await expectNoAxeViolations(page);

  await combobox(page, "Vincular rotina existente").selectOption({ label: "Ler em voz alta" });
  await page.getByRole("button", { name: "Vincular", exact: true }).click();

  await expect(linkedRoutines(page).getByRole("link", { name: "Ler em voz alta" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Registros" }).getByRole("listitem")).toHaveCount(1);
  // The only routine is now linked, so the selector goes away.
  await expect(combobox(page, "Vincular rotina existente")).toHaveCount(0);

  await page.goto(`/routines/${routineId}`);
  await expect(page.getByRole("link", { name: "Praticar oratória" })).toBeVisible();
});

test("desvincular pela página da rotina mantém a rotina (plano 020)", async ({ page }) => {
  const { cycleId, actionId } = await practiceAction(page);
  const routineId = await insertRoutine({
    title: "Ler em voz alta",
    startDate: today,
    pdiActionId: actionId,
  });
  await page.goto(`/routines/${routineId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Ler em voz alta" })).toBeVisible();

  await page.getByRole("button", { name: "Desvincular da ação" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Desvincular da ação de PDI?" });
  await expect(dialog).toContainText("A rotina e os registros continuam.");
  await dialog.getByRole("button", { name: "Desvincular" }).click();
  // While the dialog is open the page behind it is hidden from the accessibility
  // tree, so wait for it to close before checking that the link is gone.
  await expect(dialog).toBeHidden();

  await expect(page.getByText("Ação de PDI:")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Praticar oratória" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Desvincular da ação" })).toHaveCount(0);

  await page.goto(`/pdi/${cycleId}/actions/${actionId}`);
  await expect(linkedRoutines(page).getByText(/Nenhuma rotina vinculada/)).toBeVisible();
  // Free again, so it can be linked back.
  await expect(combobox(page, "Vincular rotina existente")).toBeVisible();
});

test("desvincular pela ação; ciclo encerrado não deixa desvincular (plano 020)", async ({
  page,
}) => {
  const { cycleId, actionId } = await practiceAction(page);
  await insertRoutine({ title: "Manhã", startDate: today, pdiActionId: actionId });
  await insertRoutine({ title: "Noite", startDate: today, pdiActionId: actionId });
  await page.goto(`/pdi/${cycleId}/actions/${actionId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Praticar oratória" })).toBeVisible();

  await page.getByRole("button", { name: "Desvincular a rotina Manhã" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Desvincular rotina?" });
  await dialog.getByRole("button", { name: "Desvincular" }).click();
  await expect(dialog).toBeHidden();
  await expect(linkedRoutines(page).getByRole("link", { name: "Manhã" })).toHaveCount(0);
  await expect(linkedRoutines(page).getByRole("link", { name: "Noite" })).toBeVisible();

  const closed = await insertCycle({
    ...cycle,
    title: "PDI anterior",
    status: "CLOSED",
    areas: [{ name: "Comunicação", actions: [{ title: "Apresentar", category: "Prática" }] }],
  });
  const closedActionId = closed.actionIds["Apresentar"] ?? "";
  const routineId = await insertRoutine({
    title: "Apresentar toda semana",
    startDate: today,
    pdiActionId: closedActionId,
  });

  await page.goto(`/pdi/${closed.id}/actions/${closedActionId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Apresentar" })).toBeVisible();
  await expect(
    linkedRoutines(page).getByRole("link", { name: "Apresentar toda semana" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Desvincular/ })).toHaveCount(0);
  await expect(combobox(page, "Vincular rotina existente")).toHaveCount(0);

  await page.goto(`/routines/${routineId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Apresentar toda semana" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Desvincular da ação" })).toHaveCount(0);
});
