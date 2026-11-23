import type { PrismaClient } from "@/generated/prisma/client";

/** Time categories created by the seed (plan 031). Nothing depends on these names. */
export const DEFAULT_TIME_CATEGORIES = [
  "Atendimento",
  "Chamados",
  "Projeto",
  "Reunião",
  "Estudo",
] as const;

/** Creates the default time categories that do not exist yet; edited ones are left alone. */
export async function ensureDefaultTimeCategories(client: PrismaClient): Promise<void> {
  for (const name of DEFAULT_TIME_CATEGORIES) {
    await client.timeCategory.upsert({ where: { name }, create: { name }, update: {} });
  }
}
