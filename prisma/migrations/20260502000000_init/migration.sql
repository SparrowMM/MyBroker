-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "daily_records" (
    "id" SERIAL NOT NULL,
    "record_date" DATE NOT NULL,
    "raw_text" TEXT NOT NULL DEFAULT '',
    "chat_text" TEXT NOT NULL DEFAULT '',
    "screenshot_paths_json" TEXT NOT NULL DEFAULT '[]',
    "screenshot_notes" TEXT NOT NULL DEFAULT '',
    "analysis_summary" TEXT NOT NULL DEFAULT '',
    "tags_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" SERIAL NOT NULL,
    "source_record_id" INTEGER NOT NULL,
    "source_date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "due_date" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" SERIAL NOT NULL,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "success" INTEGER NOT NULL DEFAULT 0,
    "response_message" TEXT NOT NULL DEFAULT '',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_call_logs" (
    "id" SERIAL NOT NULL,
    "scenario" TEXT NOT NULL DEFAULT 'summary',
    "model" TEXT NOT NULL DEFAULT '',
    "prompt_digest" TEXT NOT NULL DEFAULT '',
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "error_message" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_records_record_date_idx" ON "daily_records"("record_date");

-- CreateIndex
CREATE INDEX "action_items_source_record_id_idx" ON "action_items"("source_record_id");

-- CreateIndex
CREATE INDEX "action_items_source_date_idx" ON "action_items"("source_date");
