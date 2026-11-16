-- CreateEnum
CREATE TYPE "pdi_cycle_status" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "pdi_action_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "action_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "allows_routine" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdi_cycles" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "pdi_cycle_status" NOT NULL DEFAULT 'PLANNED',
    "manager_name" VARCHAR(120),
    "career_objective" TEXT,
    "self_assessment" TEXT,
    "manager_feedback" TEXT,
    "final_rating" VARCHAR(60),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdi_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdi_areas" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "expected_outcome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdi_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdi_actions" (
    "id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "expected_result" TEXT,
    "due_date" DATE,
    "status" "pdi_action_status" NOT NULL DEFAULT 'NOT_STARTED',
    "evidence" TEXT,
    "manager_comment" TEXT,
    "goal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdi_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdi_check_ins" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "next_steps" TEXT,
    "manager_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdi_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "action_categories_name_key" ON "action_categories"("name");

-- CreateIndex
CREATE INDEX "pdi_cycles_status_idx" ON "pdi_cycles"("status");

-- CreateIndex
CREATE INDEX "pdi_areas_cycle_id_idx" ON "pdi_areas"("cycle_id");

-- CreateIndex
CREATE INDEX "pdi_actions_area_id_idx" ON "pdi_actions"("area_id");

-- CreateIndex
CREATE INDEX "pdi_actions_category_id_idx" ON "pdi_actions"("category_id");

-- CreateIndex
CREATE INDEX "pdi_actions_goal_id_idx" ON "pdi_actions"("goal_id");

-- CreateIndex
CREATE INDEX "pdi_check_ins_cycle_id_date_idx" ON "pdi_check_ins"("cycle_id", "date");

-- AddForeignKey
ALTER TABLE "pdi_areas" ADD CONSTRAINT "pdi_areas_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "pdi_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_actions" ADD CONSTRAINT "pdi_actions_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "pdi_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_actions" ADD CONSTRAINT "pdi_actions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "action_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_actions" ADD CONSTRAINT "pdi_actions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_check_ins" ADD CONSTRAINT "pdi_check_ins_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "pdi_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
