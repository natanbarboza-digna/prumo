import { describe, expect, it } from "vitest";

import { likePattern, searchQuerySchema } from "@/modules/search/schemas";

describe("searchQuerySchema (plan 027)", () => {
  it("trims the term and keeps it between 2 and 100 characters", () => {
    expect(searchQuerySchema.parse("  inglês ")).toBe("inglês");
    expect(searchQuerySchema.parse("ab")).toBe("ab");
  });

  it("gives null when there is nothing worth searching", () => {
    expect(searchQuerySchema.parse(undefined)).toBeNull();
    expect(searchQuerySchema.parse("")).toBeNull();
    expect(searchQuerySchema.parse("   ")).toBeNull();
    expect(searchQuerySchema.parse("a")).toBeNull();
    expect(searchQuerySchema.parse("a".repeat(101))).toBeNull();
    expect(searchQuerySchema.parse(["a", "b"])).toBeNull();
  });
});

describe("likePattern", () => {
  it("wraps the term to match anywhere in the text", () => {
    expect(likePattern("inglês")).toBe("%inglês%");
  });

  it("escapes the LIKE wildcards and the escape character itself", () => {
    expect(likePattern("50%")).toBe("%50!%%");
    expect(likePattern("a_b")).toBe("%a!_b%");
    expect(likePattern("uau!")).toBe("%uau!!%");
  });
});
