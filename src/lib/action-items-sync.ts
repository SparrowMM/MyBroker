import { prisma } from "@/lib/prisma";
import {
  extractActionItemsFromText,
  inferPriority,
  mergeRecordText,
} from "@/lib/action-items-logic";
import { ymdToUtcMidnight } from "@/lib/parse-ymd";

function addDaysToYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * 扫描近 N 个自然日内的日报，抽取待办并入库；同一窗口内「内容完全相同」的条目会跳过（去重）。
 */
export async function syncActionItemsFromRecords(days: number): Promise<{
  scanned_records: number;
  inserted: number;
  skipped_duplicate: number;
  window_start: string;
  window_end: string;
}> {
  const n = Math.min(90, Math.max(1, days));
  const endYmd = new Date().toISOString().slice(0, 10);
  const startYmd = addDaysToYmd(endYmd, -(n - 1));
  const from = ymdToUtcMidnight(startYmd);
  const to = ymdToUtcMidnight(endYmd);
  to.setUTCHours(23, 59, 59, 999);

  const records = await prisma.dailyRecord.findMany({
    where: { recordDate: { gte: from, lte: to } },
    orderBy: { recordDate: "asc" },
  });

  let inserted = 0;
  let skippedDuplicate = 0;
  const now = new Date();

  for (const rec of records) {
    const merged = mergeRecordText(rec.rawText, rec.chatText, rec.screenshotNotes);
    const items = extractActionItemsFromText(merged);
    for (const content of items) {
      const existing = await prisma.actionItem.findFirst({
        where: {
          content,
          sourceDate: { gte: from, lte: to },
        },
      });
      if (existing) {
        skippedDuplicate += 1;
        continue;
      }
      const priority = inferPriority(content);
      const recordDay = rec.recordDate.toISOString().slice(0, 10);
      await prisma.actionItem.create({
        data: {
          sourceRecordId: rec.id,
          sourceDate: ymdToUtcMidnight(recordDay),
          content,
          priority,
          status: "todo",
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
      });
      inserted += 1;
    }
  }

  return {
    scanned_records: records.length,
    inserted,
    skipped_duplicate: skippedDuplicate,
    window_start: startYmd,
    window_end: endYmd,
  };
}
