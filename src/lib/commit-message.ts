// The commit message rule (plan 030): Conventional Commits, as in CLAUDE.md.
// Pure, so the unit tests cover it; scripts/check-commit-message.ts applies it
// to the commit-msg hook and to CI.

/** The types of CLAUDE.md plus the other standard Conventional Commits ones. */
export const COMMIT_TYPES = [
  "feat",
  "fix",
  "test",
  "refactor",
  "docs",
  "chore",
  "ci",
  "build",
  "perf",
  "style",
  "revert",
] as const;

export const COMMIT_HEADER_MAX = 72;

/** Messages Git writes itself: merges, reverts and autosquash commits. */
const GIT_GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/;

/** type, optional (scope), optional !, then ": " and the rest. */
const HEADER = /^([A-Za-z]+)(\(([^)]*)\))?(!)?:( ?)(.*)$/;

const SCOPE = /^[a-z0-9-]+$/;

const EXAMPLE = 'Use "tipo: descrição", por exemplo "feat: add track filter".';

/** Null when the message follows the rule; otherwise why not, in pt-BR. */
export function checkCommitMessage(message: string): string | null {
  // Git drops its "#" comment lines from the final message, so they do not count.
  const lines = message
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("#"))
    .map((line) => line.trimEnd());
  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  const header = lines[0] ?? "";

  if (header.trim() === "") return "a mensagem está vazia.";
  if (GIT_GENERATED.test(header)) return null;

  const match = HEADER.exec(header);
  if (!match) return `falta o tipo. ${EXAMPLE}`;
  const [, type = "", scopePart, scope, , space, description = ""] = match;

  if (!(COMMIT_TYPES as readonly string[]).includes(type)) {
    return `o tipo "${type}" não existe. Tipos: ${COMMIT_TYPES.join(", ")}.`;
  }
  if (scopePart !== undefined && !SCOPE.test(scope ?? "")) {
    return "o escopo, entre parênteses, deve ter só letras minúsculas, números e hífen.";
  }
  if (description.trim() === "") return "falta a descrição depois do tipo.";
  if (space !== " ") return 'falta um espaço depois dos dois-pontos ("feat: …").';
  if (!/^[a-z0-9]/.test(description)) {
    return "a descrição deve começar com letra minúscula (ou número).";
  }
  if (description.endsWith(".")) return "a descrição não termina com ponto final.";
  if (header.length > COMMIT_HEADER_MAX) {
    return `a primeira linha passa de ${COMMIT_HEADER_MAX} caracteres (tem ${header.length}).`;
  }
  if (lines.length > 1 && lines[1] !== "") {
    return "falta a linha em branco entre a primeira linha e o corpo.";
  }
  return null;
}
