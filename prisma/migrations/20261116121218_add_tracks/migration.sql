-- CreateEnum
CREATE TYPE "track_step_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "tracks" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "goal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_steps" (
    "id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "track_step_status" NOT NULL DEFAULT 'NOT_STARTED',
    "due_date" DATE,
    "resource_url" VARCHAR(2000),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "track_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracks_goal_id_idx" ON "tracks"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "track_steps_track_id_position_key" ON "track_steps"("track_id", "position");

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_steps" ADD CONSTRAINT "track_steps_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
