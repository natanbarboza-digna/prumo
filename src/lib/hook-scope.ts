// Which checks a commit or a push needs (plan 038). Pure, so the unit tests
// cover it; scripts/hook-scope.ts reads the commits and files from Git and the
// hooks and CI act on the answer.

/** Commit types that skip the test suite. */
export const LIGHT_TYPES = ["docs", "chore"] as const;

/** Files that make even a docs or chore commit run everything. */
const CODE_PATHS = [/^package(-lock)?\.json$/, /^prisma\//, /^src\//, /^e2e\//, /^scripts\//];

/** True for "docs: …", "chore(deps)!: …" and the like, by the first non-comment line. */
export function isLightCommit(message: string): boolean {
  const header = message.split(/\r?\n/).find((line) => !line.startsWith("#")) ?? "";
  const type = /^([a-z]+)(\([^)]*\))?!?:/.exec(header)?.[1];
  return type !== undefined && (LIGHT_TYPES as readonly string[]).includes(type);
}

/**
 * False only when every commit is light and no file touches code, dependencies
 * or the database. With no commit to judge, the answer is to run everything.
 */
export function needsFullChecks(messages: readonly string[], files: readonly string[]): boolean {
  if (messages.length === 0) return true;
  if (!messages.every(isLightCommit)) return true;
  return files
    .map((file) => file.replaceAll("\\", "/"))
    .some((file) => CODE_PATHS.some((pattern) => pattern.test(file)));
}
