-- Manual order of PDI areas and actions (plan 021). The columns start empty,
-- get the order the cycle page showed until now, and only then become required.

-- AlterTable
ALTER TABLE "pdi_areas" ADD COLUMN "position" INTEGER;
ALTER TABLE "pdi_actions" ADD COLUMN "position" INTEGER;

-- Areas: creation order inside each cycle.
UPDATE "pdi_areas" AS a
SET "position" = o.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "cycle_id" ORDER BY "created_at", "id") AS rn
  FROM "pdi_areas"
) AS o
WHERE a."id" = o."id";

-- Actions: due date first (none last), then creation, inside each area.
UPDATE "pdi_actions" AS a
SET "position" = o.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "area_id" ORDER BY "due_date" ASC NULLS LAST, "created_at", "id"
  ) AS rn
  FROM "pdi_actions"
) AS o
WHERE a."id" = o."id";

ALTER TABLE "pdi_areas" ALTER COLUMN "position" SET NOT NULL;
ALTER TABLE "pdi_actions" ALTER COLUMN "position" SET NOT NULL;

-- DropIndex (the unique indexes below start with the same column)
DROP INDEX "pdi_areas_cycle_id_idx";
DROP INDEX "pdi_actions_area_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "pdi_areas_cycle_id_position_key" ON "pdi_areas"("cycle_id", "position");
CREATE UNIQUE INDEX "pdi_actions_area_id_position_key" ON "pdi_actions"("area_id", "position");
