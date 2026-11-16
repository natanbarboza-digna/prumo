import type { PrismaClient } from "@/generated/prisma/client";

/** Categories created by the seed. Nothing in the app depends on these names. */
export const DEFAULT_CATEGORIES = [
  { name: "Prática", allowsRoutine: true },
  { name: "Curso", allowsRoutine: false },
  { name: "Leitura", allowsRoutine: false },
  { name: "Mentoria", allowsRoutine: false },
] as const;

/**
 * Creates the default categories that do not exist yet. Safe to run again: an
 * existing category (even one the user edited) is left untouched.
 */
export async function ensureDefaultCategories(client: PrismaClient): Promise<void> {
  for (const category of DEFAULT_CATEGORIES) {
    await client.actionCategory.upsert({
      where: { name: category.name },
      create: category,
      update: {},
    });
  }
}
