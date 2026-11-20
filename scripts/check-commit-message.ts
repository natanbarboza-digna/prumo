// Checks commit messages against the project's rule (plan 030).
//
//   tsx scripts/check-commit-message.ts <message-file>   the commit-msg hook
//   npm run check:commits -- <range>                      e.g. main~5..main (CI)
//
// Exits with an error, saying why, when a message does not follow the rule.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { COMMIT_TYPES, checkCommitMessage } from "../src/lib/commit-message";

function explain(header: string, reason: string): string {
  return [
    "commit-msg: a mensagem não segue o padrão (Conventional Commits).",
    `  Primeira linha: "${header}"`,
    `  Motivo: ${reason}`,
    `  Tipos: ${COMMIT_TYPES.join(", ")}.`,
  ].join("\n");
}

/** The messages of a commit range, oldest first, as [hash, message] pairs. */
function messagesIn(range: string): [string, string][] {
  // execFile (no shell): the range is passed as a plain argument.
  const log = execFileSync("git", ["log", "--reverse", "--format=%H%x1f%B%x1e", range], {
    encoding: "utf8",
  });
  return log
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash = "", message = ""] = entry.split("\x1f");
      return [hash, message];
    });
}

function main(): void {
  const [first, second] = process.argv.slice(2);

  if (first === "--range") {
    if (!second) throw new Error("Informe o intervalo: npm run check:commits -- main~5..main");
    const failures = messagesIn(second).flatMap(([hash, message]) => {
      const reason = checkCommitMessage(message);
      const header = message.split("\n")[0] ?? "";
      return reason ? [`${hash.slice(0, 7)}: ${explain(header, reason)}`] : [];
    });
    if (failures.length > 0) {
      console.error(failures.join("\n\n"));
      process.exitCode = 1;
      return;
    }
    console.log("Mensagens de commit no padrão.");
    return;
  }

  if (!first) throw new Error("Informe o arquivo da mensagem (o Git passa o caminho ao hook).");
  const message = readFileSync(first, "utf8");
  const reason = checkCommitMessage(message);
  if (reason) {
    const header = message.split(/\r?\n/).find((line) => !line.startsWith("#")) ?? "";
    console.error(explain(header, reason));
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
