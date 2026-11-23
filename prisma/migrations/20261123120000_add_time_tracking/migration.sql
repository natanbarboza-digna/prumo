-- CreateEnum
CREATE TYPE "time_entry_kind" AS ENUM ('WORK', 'BREAK');

-- CreateTable
CREATE TABLE "time_days" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER,
    "slot_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL,
    "day_id" UUID NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "kind" "time_entry_kind" NOT NULL,
    "description" VARCHAR(300),
    "category_id" UUID,
    "project_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "time_days_date_key" ON "time_days"("date");

-- CreateIndex
CREATE INDEX "time_entries_category_id_idx" ON "time_entries"("category_id");

-- CreateIndex
CREATE INDEX "time_entries_project_id_idx" ON "time_entries"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_day_id_start_minute_key" ON "time_entries"("day_id", "start_minute");

-- CreateIndex
CREATE UNIQUE INDEX "time_categories_name_key" ON "time_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "time_projects_name_key" ON "time_projects"("name");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "time_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "time_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "time_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

