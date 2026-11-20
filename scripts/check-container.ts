// `npm run container:check` (plan 025): after `npm run container:up`, waits for
// the production build in the local container to answer, then checks that the
// login page loads and that a visitor without a session is sent to it. On
// failure, prints the app's latest logs and exits with an error.

import { execSync } from "node:child_process";

const BASE_URL = "http://localhost:3200";
const TIMEOUT_MS = 90_000;
const RETRY_MS = 2_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls /login until it answers 200, or gives up after TIMEOUT_MS. */
async function waitForApp(): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let last = "sem resposta";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/login`);
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await wait(RETRY_MS);
  }
  throw new Error(`O app não respondeu em ${TIMEOUT_MS / 1000} s (${last}).`);
}

async function checkLoginPage(): Promise<void> {
  const response = await fetch(`${BASE_URL}/login`);
  const html = await response.text();
  if (!response.ok || !html.includes("Prumo")) {
    throw new Error(`/login respondeu ${response.status} sem a página de login.`);
  }
}

async function checkRedirectWithoutSession(): Promise<void> {
  const response = await fetch(`${BASE_URL}/`, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  if (response.status < 300 || response.status >= 400 || !location.includes("/login")) {
    throw new Error(`/ sem sessão respondeu ${response.status} (${location || "sem Location"}).`);
  }
}

// tsx runs this file as CommonJS, which has no top-level await.
async function main(): Promise<void> {
  console.log(`Esperando o app em ${BASE_URL}…`);
  await waitForApp();
  await checkLoginPage();
  console.log("ok: /login responde com a página de login");
  await checkRedirectWithoutSession();
  console.log("ok: / sem sessão redireciona para /login");
  console.log("Contêiner pronto.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  try {
    console.error("\nÚltimos logs do app:");
    console.error(
      execSync("docker compose --profile app logs --tail 30 app", { encoding: "utf8" }),
    );
  } catch {
    // Docker itself is down: the message above already says what failed.
  }
  process.exitCode = 1;
});
