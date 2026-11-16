// Shared e2e helpers. Form fields are located with getByRole, which skips the
// hidden copies of pages that Next keeps in the DOM for back navigation.
import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";

import {
  readTestDatabaseUrl,
  resetTestDatabase,
  seedTestDatabase,
} from "../src/test/test-database";

/** Empties the test database and seeds the default action categories again. */
export async function resetDatabase(): Promise<void> {
  const url = readTestDatabaseUrl();
  await resetTestDatabase(url);
  await seedTestDatabase(url);
}

export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

export function textbox(page: Page, name: string) {
  return page.getByRole("textbox", { name, exact: true });
}

export function combobox(page: Page, name: string) {
  return page.getByRole("combobox", { name, exact: true });
}

type NewGoal = { title: string; description?: string; status?: string; targetDate?: string };

export async function createGoal(page: Page, goal: NewGoal): Promise<void> {
  await page.goto("/goals/new");
  await textbox(page, "Título").fill(goal.title);
  if (goal.description) await textbox(page, "Descrição (opcional)").fill(goal.description);
  if (goal.status) await combobox(page, "Status").selectOption({ label: goal.status });
  if (goal.targetDate) await textbox(page, "Data-alvo (opcional)").fill(goal.targetDate);
  await page.getByRole("button", { name: "Criar objetivo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: goal.title })).toBeVisible();
}

type NewTrack = { title: string; description?: string; goal?: string };

/** Creates a track through the form and waits on its detail page. */
export async function createTrack(page: Page, track: NewTrack): Promise<void> {
  await page.goto("/tracks/new");
  await textbox(page, "Título").fill(track.title);
  if (track.description) await textbox(page, "Descrição (opcional)").fill(track.description);
  if (track.goal) await combobox(page, "Objetivo (opcional)").selectOption({ label: track.goal });
  await page.getByRole("button", { name: "Criar trilha" }).click();
  await expect(page.getByRole("heading", { level: 1, name: track.title })).toBeVisible();
}

type NewStep = { title: string; status?: string; dueDate?: string; resourceUrl?: string };

/** From a track detail page, adds a step and waits back on that page. */
export async function addStep(page: Page, trackTitle: string, step: NewStep): Promise<void> {
  await page.getByRole("link", { name: "Adicionar etapa" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nova etapa" })).toBeVisible();
  await textbox(page, "Título").fill(step.title);
  if (step.status) await combobox(page, "Status").selectOption({ label: step.status });
  if (step.dueDate) await textbox(page, "Prazo (opcional)").fill(step.dueDate);
  if (step.resourceUrl) await textbox(page, "Link do recurso (opcional)").fill(step.resourceUrl);
  await page.getByRole("button", { name: "Adicionar etapa" }).click();
  await expect(page.getByRole("heading", { level: 1, name: trackTitle })).toBeVisible();
}

type NewRoutine = {
  title: string;
  /** Checkbox names ("Segunda-feira"); every day when omitted. */
  days?: string[];
  timeOfDay?: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
};

const ALL_DAYS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

/** Creates a routine through the form and waits on its detail page. */
export async function createRoutine(page: Page, routine: NewRoutine): Promise<void> {
  await page.goto("/routines/new");
  await textbox(page, "Título").fill(routine.title);
  for (const day of routine.days ?? ALL_DAYS) {
    await page.getByRole("checkbox", { name: day, exact: true }).check();
  }
  if (routine.timeOfDay) await textbox(page, "Horário (opcional)").fill(routine.timeOfDay);
  if (routine.startDate) await textbox(page, "Início").fill(routine.startDate);
  if (routine.endDate) await textbox(page, "Fim (opcional)").fill(routine.endDate);
  if (routine.goal) {
    await combobox(page, "Objetivo (opcional)").selectOption({ label: routine.goal });
  }
  await page.getByRole("button", { name: "Criar rotina" }).click();
  await expect(page.getByRole("heading", { level: 1, name: routine.title })).toBeVisible();
}

type NewCycle = {
  title: string;
  startDate: string;
  endDate: string;
  status?: "Planejado" | "Ativo";
};

/** Creates a PDI cycle through the form and waits on its detail page. */
export async function createCycle(page: Page, cycle: NewCycle): Promise<void> {
  await page.goto("/pdi/new");
  await textbox(page, "Título").fill(cycle.title);
  await textbox(page, "Início").fill(cycle.startDate);
  await textbox(page, "Fim").fill(cycle.endDate);
  if (cycle.status) await combobox(page, "Status").selectOption({ label: cycle.status });
  await page.getByRole("button", { name: "Criar ciclo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: cycle.title })).toBeVisible();
}

/** From a cycle page, adds an area and waits back on that page. */
export async function addArea(page: Page, cycleTitle: string, name: string): Promise<void> {
  await page.getByRole("link", { name: "Adicionar área" }).click();
  await textbox(page, "Nome da área ou competência").fill(name);
  await page.getByRole("button", { name: "Adicionar área" }).click();
  await expect(page.getByRole("heading", { level: 1, name: cycleTitle })).toBeVisible();
}

type NewAction = { title: string; category: string; goal?: string; dueDate?: string };

/** From a cycle page, adds an action to an area and waits back on that page. */
export async function addAction(
  page: Page,
  cycleTitle: string,
  area: string,
  action: NewAction,
): Promise<void> {
  await page.getByRole("link", { name: `Adicionar ação em ${area}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nova ação" })).toBeVisible();
  await textbox(page, "Título").fill(action.title);
  await combobox(page, "Categoria").selectOption({ label: action.category });
  if (action.dueDate) await textbox(page, "Prazo (opcional)").fill(action.dueDate);
  if (action.goal) await combobox(page, "Objetivo (opcional)").selectOption({ label: action.goal });
  await page.getByRole("button", { name: "Adicionar ação" }).click();
  await expect(page.getByRole("heading", { level: 1, name: cycleTitle })).toBeVisible();
}
