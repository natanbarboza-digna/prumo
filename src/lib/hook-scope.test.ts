import { describe, expect, it } from "vitest";

import { isLightCommit, needsFullChecks } from "@/lib/hook-scope";

describe("isLightCommit (plan 038)", () => {
  it.each([
    "docs: add readme",
    "chore: bump node",
    "docs(readme): fix typo",
    "chore(deps)!: drop x",
  ])("takes %j as light", (message) => {
    expect(isLightCommit(message)).toBe(true);
  });

  it.each(["feat: add books", "fix: date", "test: cover x", "Adiciona filtro", "", "docsy: x"])(
    "takes %j as not light",
    (message) => {
      expect(isLightCommit(message)).toBe(false);
    },
  );

  it("looks only at the first line, skipping Git's comment lines", () => {
    expect(isLightCommit("# comment\ndocs: plan\n\nfeat: in the body")).toBe(true);
  });
});

describe("needsFullChecks", () => {
  it("skips only when every commit is light and no file is code", () => {
    expect(
      needsFullChecks(["docs: add readme", "chore: ignore files"], ["README.md", ".gitignore"]),
    ).toBe(false);
  });

  it("runs everything when one commit is not light", () => {
    expect(needsFullChecks(["docs: plan", "feat: add books"], ["README.md"])).toBe(true);
  });

  it.each([
    "package.json",
    "package-lock.json",
    "prisma/schema.prisma",
    "prisma/migrations/x/migration.sql",
    "src/lib/dates.ts",
    "e2e/books.spec.ts",
    "scripts/create-user.ts",
  ])("runs everything when a light commit touches %s", (file) => {
    expect(needsFullChecks(["chore: update"], ["README.md", file])).toBe(true);
  });

  it("runs everything when there is no commit to judge", () => {
    expect(needsFullChecks([], ["README.md"])).toBe(true);
  });

  it("accepts Windows paths", () => {
    expect(needsFullChecks(["chore: x"], ["src\\lib\\dates.ts"])).toBe(true);
  });
});
