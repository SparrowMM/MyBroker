import type { DailyRecord } from "@prisma/client";
import { decodeJsonList } from "@/lib/record-analyzer";

export function dailyRecordToJson(r: DailyRecord) {
  return {
    id: r.id,
    record_date: r.recordDate.toISOString().slice(0, 10),
    raw_text: r.rawText,
    chat_text: r.chatText,
    screenshot_paths: decodeJsonList(r.screenshotPathsJson),
    screenshot_notes: r.screenshotNotes,
    analysis_summary: r.analysisSummary,
    tags: decodeJsonList(r.tagsJson),
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}
