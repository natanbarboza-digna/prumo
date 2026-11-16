import { defineConfig, devices } from "@playwright/test";

import { readTestDatabaseUrl } from "./src/test/test-database";

// A dedicated port so the e2e server never collides with your own `npm run dev`.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // `next dev` compiles each route on its first visit, which can take several
  // seconds; these limits leave room for that.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Fortaleza",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: baseURL,
    // Always start a fresh server so it is guaranteed to use the test database.
    reuseExistingServer: false,
    timeout: 120_000,
    // Variables set here win over .env, so the app talks to the test database.
    env: { DATABASE_URL: readTestDatabaseUrl() },
  },
});
