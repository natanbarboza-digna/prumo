-- AlterTable
ALTER TABLE "routines" ADD COLUMN     "pdi_action_id" UUID;

-- CreateIndex
CREATE INDEX "routines_pdi_action_id_idx" ON "routines"("pdi_action_id");

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "routines_pdi_action_id_fkey" FOREIGN KEY ("pdi_action_id") REFERENCES "pdi_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
