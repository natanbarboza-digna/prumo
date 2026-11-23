// Tells the hooks and CI whether to run every check (plan 038).
//
//   tsx scripts/hook-scope.ts --commit <message-file>   commit-msg hook (staged files)
//   tsx scripts/hook-scope.ts --push                     pre-push hook (refs on stdin)
//   tsx scripts/hook-scope.ts --range <range>            CI (also writes full=… to $GITHUB_OUTPUT)
//
// Exits with 0 to run everything and with 10 when docs and chore commits only
// touch files outside the code; any error also means "run everything".

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

import { needsFullChecks } from "../src/lib/hook-scope";

const SKIP = 10;
const ZERO = /^0+$/;

/** git with plain arguments (no shell), returning its output. */
function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

/** Messages and changed files of the commits `logArgs` selects. */
function commitsOf(logArgs: string[]): { messages: string[]; files: string[] } {
  // Each commit: \x1e, its message, \x1f, then the file names it touched.
  const log = git(["log", "--format=%x1e%B%x1f", "--name-only", ...logArgs]);
  const messages: string[] = [];
  const files = new Set<string>();
  for (const entry of log.split("\x1e").slice(1)) {
    const [message = "", names = ""] = entry.split("\x1f");
    messages.push(message.trim());
    for (const name of names.split(/\r?\n/)) if (name.trim()) files.add(name.trim());
  }
  return { messages, files: [...files] };
}

/**
 * The commits a push sends. Git writes one line per ref on stdin:
 * "<local ref> <local sha> <remote ref> <remote sha>". A deleted ref sends
 * nothing; a new one sends the commits no remote branch has yet.
 */
function pushedCommits(): { messages: string[]; files: string[] } {
  const input = readFileSync(0, "utf8");
  const messages: string[] = [];
  const files: string[] = [];
  for (const line of input.split(/\r?\n/)) {
    const [, localSha = "", , remoteSha = ""] = line.trim().split(/\s+/);
    if (!localSha || ZERO.test(localSha)) continue;
    const range = ZERO.test(remoteSha)
      ? [localSha, "--not", "--remotes"]
      : [`${remoteSha}..${localSha}`];
    const commits = commitsOf(range);
    messages.push(...commits.messages);
    files.push(...commits.files);
  }
  return { messages, files };
}

function main(): number {
  const [mode, value] = process.argv.slice(2);
  let scope: { messages: string[]; files: string[] };

  if (mode === "--commit") {
    if (!value) throw new Error("Informe o arquivo da mensagem.");
    scope = {
      messages: [readFileSync(value, "utf8")],
      files: git(["diff", "--cached", "--name-only"]).split(/\r?\n/).filter(Boolean),
    };
  } else if (mode === "--push") {
    scope = pushedCommits();
  } else if (mode === "--range") {
    if (!value) throw new Error("Informe o intervalo: --range base..head");
    scope = commitsOf([value]);
  } else {
    throw new Error("Use --commit <arquivo>, --push ou --range <intervalo>.");
  }

  const full = needsFullChecks(scope.messages, scope.files);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `full=${full}\n`);
  return full ? 0 : SKIP;
}

try {
  process.exitCode = main();
} catch (error) {
  // Unreadable range or unexpected input: in doubt, run everything.
  console.error(`hook-scope: ${error instanceof Error ? error.message : String(error)}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "full=true\n");
  process.exitCode = 0;
}
