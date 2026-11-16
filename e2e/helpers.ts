// Shared e2e helpers. Form fields are located with getByRole, which skips the
// hidden copies of pages that Next keeps in the DOM for back navigation.
import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";

import { readTestDatabaseUrl, resetTestDatabase } from "../src/test/test-database";

export async function resetDatabase(): Promise<void> {
  await resetTestDatabase(readTestDatabaseUrl());
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
