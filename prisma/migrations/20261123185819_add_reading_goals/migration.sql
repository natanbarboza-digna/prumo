-- CreateTable
CREATE TABLE "reading_goals" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "books" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reading_goals_year_key" ON "reading_goals"("year");
