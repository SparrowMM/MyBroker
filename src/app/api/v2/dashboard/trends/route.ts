import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utcWeekMondayKey } from "@/lib/dates";

/** GET ?days=30 — 近 N 天每日条数、按周桶聚合条数 */
export async function GET(req: NextRequest) {
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  const records = await prisma.dailyRecord.findMany({
    where: { recordDate: { gte: start, lte: end } },
    orderBy: { recordDate: "asc" },
  });

  const byDate = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    byDate.set(d.toISOString().slice(0, 10), 0);
  }

  const byWeek = new Map<string, number>();

  for (const r of records) {
    const key = r.recordDate.toISOString().slice(0, 10);
    byDate.set(key, (byDate.get(key) ?? 0) + 1);
    const wk = utcWeekMondayKey(r.recordDate);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
  }

  const by_date = [...byDate.entries()].map(([date, record_count]) => ({ date, record_count }));

  const by_week_start = [...byWeek.entries()]
    .map(([week_start_monday, record_count]) => ({ week_start_monday, record_count }))
    .sort((a, b) => a.week_start_monday.localeCompare(b.week_start_monday));

  return NextResponse.json({
    days,
    window_start: start.toISOString().slice(0, 10),
    window_end: end.toISOString().slice(0, 10),
    total_records: records.length,
    by_date,
    by_week_start,
  });
}
