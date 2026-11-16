import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names and drops falsy values", () => {
    expect(cn("px-2", false, undefined, "py-1")).toBe("px-2 py-1");
  });

  it("keeps the last Tailwind class when two conflict", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
