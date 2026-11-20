// Manual order kept in a "position" column with a unique (parent, position)
// index: track steps (plan 002) and PDI areas and actions (plan 021).

import { Prisma } from "@/generated/prisma/client";

/** Tables with a manual order, and the column of the list each row belongs to. */
const ORDERED = {
  track_steps: "track_id",
  pdi_areas: "cycle_id",
  pdi_actions: "area_id",
} as const;

type OrderedTable = keyof typeof ORDERED;

/**
 * Shifts the rows after `position` back by one, so positions stay 1, 2, 3…
 * after a row leaves the list (deleted, or moved to another list).
 *
 * Postgres checks the unique index row by row, so a plain "position - 1" could
 * collide midway. The rows are flipped to negative values first, then brought
 * back one lower. Table and column names come from the fixed list above, never
 * from input, which is what makes Prisma.raw safe here.
 */
export async function closeGap(
  tx: Prisma.TransactionClient,
  table: OrderedTable,
  parentId: string,
  position: number,
): Promise<void> {
  const name = Prisma.raw(`"${table}"`);
  const parent = Prisma.raw(`"${ORDERED[table]}"`);
  await tx.$executeRaw`
    UPDATE ${name} SET position = -position
    WHERE ${parent} = ${parentId}::uuid AND position > ${position}`;
  await tx.$executeRaw`
    UPDATE ${name} SET position = -position - 1
    WHERE ${parent} = ${parentId}::uuid AND position < 0`;
}
