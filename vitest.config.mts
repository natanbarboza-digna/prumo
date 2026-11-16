import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Read .env.test into a plain object (without touching process.env here) and
// hand it only to the integration project, so unit tests never see a database.
const testEnv: Record<string, string> = {};
loadEnv({ path: ".env.test", processEnv: testEnv, quiet: true });

export default defineConfig({
  resolve: {
    // Makes the `@/*` alias from tsconfig.json work inside tests.
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["src/**/*.int.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          environment: "node",
          env: testEnv,
          globalSetup: ["src/test/global-setup.ts"],
          setupFiles: ["src/test/integration-setup.ts"],
          // Tests share one database; running files one at a time avoids
          // one test's cleanup wiping another test's data.
          fileParallelism: false,
        },
      },
    ],
  },
});
