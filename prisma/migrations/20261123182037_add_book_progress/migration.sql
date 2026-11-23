-- AlterTable
ALTER TABLE "books" ADD COLUMN     "duration_minutes" INTEGER,
ADD COLUMN     "rating" SMALLINT,
ADD COLUMN     "review" TEXT;

-- CreateTable
CREATE TABLE "book_logs" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_quotes" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "location" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_logs_book_id_date_key" ON "book_logs"("book_id", "date");

-- CreateIndex
CREATE INDEX "book_quotes_book_id_idx" ON "book_quotes"("book_id");

-- AddForeignKey
ALTER TABLE "book_logs" ADD CONSTRAINT "book_logs_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_quotes" ADD CONSTRAINT "book_quotes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
