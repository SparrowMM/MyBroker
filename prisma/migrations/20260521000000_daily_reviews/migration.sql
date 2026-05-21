-- CreateTable
CREATE TABLE "daily_reviews" (
    "id" SERIAL NOT NULL,
    "review_date" DATE NOT NULL,
    "priorities_json" TEXT NOT NULL DEFAULT '{}',
    "review_markdown" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_reviews_review_date_key" ON "daily_reviews"("review_date");
