import { describe, expect, it } from "vitest";
import { z } from "zod";

import { categoryInputSchema } from "@/modules/categories/schemas";

function fieldErrors(input: unknown) {
  const result = categoryInputSchema.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return z.flattenError(result.error).fieldErrors;
}

describe("categoryInputSchema", () => {
  it("trims the name and treats a missing checkbox as false", () => {
    expect(categoryInputSchema.parse({ name: "  Podcast  " })).toEqual({
      name: "Podcast",
      allowsRoutine: false,
    });
  });

  it.each(["on", "true", true])("treats %j as a checked box", (allowsRoutine) => {
    expect(categoryInputSchema.parse({ name: "Prática", allowsRoutine }).allowsRoutine).toBe(true);
  });

  it("requires a name", () => {
    expect(fieldErrors({ name: " " }).name).toEqual(["Informe um nome."]);
  });

  it("limits the name to 60 characters", () => {
    expect(fieldErrors({ name: "a".repeat(61) }).name).toEqual(["Use no máximo 60 caracteres."]);
  });
});
