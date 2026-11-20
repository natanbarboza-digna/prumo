import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { checkCommitMessage } from "@/lib/commit-message";

const valid = (message: string) => expect(checkCommitMessage(message), message).toBeNull();
const invalid = (message: string, reason: RegExp) =>
  expect(checkCommitMessage(message), message).toMatch(reason);

describe("checkCommitMessage (plan 030)", () => {
  it("accepts every allowed type, with or without a scope or a breaking-change mark", () => {
    for (const type of [
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
    ]) {
      valid(`${type}: add something`);
    }
    valid("feat(pdi): link existing routines");
    valid("feat(pdi-import)!: change the sheet columns");
    valid("fix!: drop the old route");
    valid("chore: bump prisma to 7.10.1");
  });

  it("accepts a body and a footer after a blank line, and ignores Git's comment lines", () => {
    valid(
      "feat: archive tracks\n\nArchived tracks are read-only.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n",
    );
    valid("docs: record the plan\n# Please enter the commit message for your changes.\n#\n");
  });

  it("lets through the messages Git writes itself", () => {
    valid("Merge branch 'feat/goals' into main");
    valid('Revert "feat: add goals"\n\nThis reverts commit abc123.');
    valid("fixup! feat: add goals");
    valid("squash! feat: add goals");
    valid("amend! feat: add goals");
  });

  it("refuses a first line without a known lowercase type", () => {
    invalid("Adiciona filtro", /falta o tipo/);
    invalid("feature: add goals", /tipo "feature" não existe/);
    invalid("Feat: add goals", /tipo "Feat" não existe/);
  });

  it("refuses a malformed scope or separator", () => {
    invalid("feat(): add goals", /escopo/);
    invalid("feat(PDI): add goals", /escopo/);
    invalid("feat:add goals", /espaço depois dos dois-pontos/);
  });

  it("refuses an empty, capitalized or dotted description", () => {
    invalid("feat: ", /descrição/);
    invalid("feat: Add goals", /minúscula/);
    invalid("feat: add goals.", /ponto final/);
  });

  it("refuses a first line over 72 characters and a body glued to it", () => {
    invalid(`feat: ${"a".repeat(67)}`, /72 caracteres/);
    valid(`feat: ${"a".repeat(66)}`);
    invalid("feat: add goals\nBody right below", /linha em branco/);
  });

  it("refuses an empty message", () => {
    invalid("", /vazia/);
    invalid("# only comments\n", /vazia/);
  });

  // Made before the rule existed (plan 030), one character over the limit; the
  // history is not rewritten, so it is the only exception.
  const KNOWN_EXCEPTIONS = [
    "fix: clear npm audit with typescript-eslint update and minimatch override",
  ];

  it("accepts every commit already in the repository", () => {
    // %B is the raw message; a NUL byte separates them safely.
    const log = execSync("git log --format=%B%x00", { encoding: "utf8" });
    const messages = log
      .split("\0")
      .map((message) => message.trim())
      .filter(Boolean);

    // CI's default checkout has a single commit; locally this is the whole history.
    expect(messages.length).toBeGreaterThan(0);
    const refused = messages
      .map((message) => ({ message: message.split("\n")[0], reason: checkCommitMessage(message) }))
      .filter((item) => item.reason !== null && !KNOWN_EXCEPTIONS.includes(item.message ?? ""));
    expect(refused).toEqual([]);
  });
});
