-- CreateEnum
CREATE TYPE "book_status" AS ENUM ('TO_READ', 'READING', 'READ', 'ABANDONED');

-- CreateEnum
CREATE TYPE "book_reason" AS ENUM ('PERSONAL', 'RECOMMENDATION', 'WORK', 'PDI');

-- CreateEnum
CREATE TYPE "book_format" AS ENUM ('PHYSICAL', 'EBOOK', 'AUDIOBOOK');

-- CreateTable
CREATE TABLE "books" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "authors" VARCHAR(200) NOT NULL,
    "format" "book_format" NOT NULL DEFAULT 'PHYSICAL',
    "pages" INTEGER,
    "genre" VARCHAR(60),
    "recommended_by" VARCHAR(120),
    "notes" TEXT,
    "status" "book_status" NOT NULL DEFAULT 'TO_READ',
    "reason" "book_reason" NOT NULL DEFAULT 'PERSONAL',
    "due_date" DATE,
    "started_on" DATE,
    "finished_on" DATE,
    "goal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "books_status_idx" ON "books"("status");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
