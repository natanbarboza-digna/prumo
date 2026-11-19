// `npm install` runs this (the "prepare" script): points Git at .githooks so
// the pre-commit hook is on (plan 012). Outside a Git checkout, such as while
// building the Docker image, there is no Git: skip quietly instead of failing.
import { execSync } from "node:child_process";

try {
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
} catch {
  // Not a Git repository or Git not installed.
}
