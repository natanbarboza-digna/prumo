// `npm run test:e2e:dev`: the same tests against `next dev` (plan 018). For
// iterating on one spec, where building first (about a minute) does not pay off:
//   npm run test:e2e:dev -- e2e/routines.spec.ts
import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

export default defineConfig({
  ...base,
  webServer: base.webServer && {
    ...base.webServer,
    command: `npx next dev --port ${new URL(base.use?.baseURL ?? "").port}`,
    timeout: 120_000,
  },
});
