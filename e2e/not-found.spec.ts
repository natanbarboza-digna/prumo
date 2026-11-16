import { expect, test } from "@playwright/test";

test("rota inexistente mostra a página de não encontrado", async ({ page }) => {
  const response = await page.goto("/rota-que-nao-existe");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Página não encontrada" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Voltar ao início" }).click();

  await expect(page).toHaveURL("/");
});
