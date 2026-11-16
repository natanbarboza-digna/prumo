-- CreateEnum
CREATE TYPE "weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "routine_log_status" AS ENUM ('DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "routines" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "weekdays" "weekday"[],
    "time_of_day" VARCHAR(5),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "goal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_logs" (
    "id" UUID NOT NULL,
    "routine_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "routine_log_status" NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routine_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routines_goal_id_idx" ON "routines"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "routine_logs_routine_id_date_key" ON "routine_logs"("routine_id", "date");

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "routines_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_logs" ADD CONSTRAINT "routine_logs_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
