import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeJsonList, summarizePeriodBlock } from "@/lib/record-analyzer";
import { endOfCalendarMonth, startOfCalendarMonth } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const year = Number(req.nextUrl.searchParams.get("year"));
  const month = Number(req.nextUrl.searchParams.get("month"));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ message: "year 与 month 参数无效" }, { status: 400 });
  }

  const start = startOfCalendarMonth(year, month);
  const end = endOfCalendarMonth(year, month);

  const records = await prisma.dailyRecord.findMany({
    where: {
      recordDate: { gte: start, lte: end },
    },
    orderBy: { recordDate: "asc" },
  });

  const summaries = records.map((r) => r.analysisSummary);
  const tagsList = records.map((r) => decodeJsonList(r.tagsJson));
  const { summary, highlights, risks, suggestions } = await summarizePeriodBlock(
    summaries,
    tagsList,
    `${year}年${month}月`,
  );

  return NextResponse.json({
    period: "monthly",
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    total_records: records.length,
    summary,
    highlights,
    risks,
    suggestions,
  });
}
