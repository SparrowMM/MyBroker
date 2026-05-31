import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeJsonList } from "@/lib/record-analyzer";
import { parseYmd } from "@/lib/parse-ymd";

/** GET ?start_date=&end_date= — 区间内日报数量、覆盖天数、标签频次 */
export async function GET(req: NextRequest) {
  const start = parseYmd(req.nextUrl.searchParams.get("start_date"));
  const end = parseYmd(req.nextUrl.searchParams.get("end_date"));
  if (!start || !end) {
    return NextResponse.json(
      { message: "start_date 与 end_date 必填（YYYY-MM-DD）" },
      { status: 400 },
    );
  }
  if (start.getTime() > end.getTime()) {
    return NextResponse.json({ message: "start_date 不能晚于 end_date" }, { status: 400 });
  }

  const records = await prisma.dailyRecord.findMany({
    where: { recordDate: { gte: start, lte: end } },
    orderBy: { recordDate: "asc" },
  });

  const dayKeys = new Set<string>();
  const tagCounts = new Map<string, number>();
  for (const r of records) {
    dayKeys.add(r.recordDate.toISOString().slice(0, 10));
    for (const t of decodeJsonList(r.tagsJson)) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }

  const tags_top = Object.fromEntries(
    [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
  );

  return NextResponse.json({
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    total_records: records.length,
    distinct_days: dayKeys.size,
    tags_top,
  });
}
