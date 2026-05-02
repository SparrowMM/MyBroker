import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeJsonList, summarizePeriodBlock } from "@/lib/record-analyzer";
import { endOfIsoWeek, startOfIsoWeek } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const year = Number(req.nextUrl.searchParams.get("year"));
  const week = Number(req.nextUrl.searchParams.get("week"));
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
    return NextResponse.json({ message: "year 与 week 参数无效" }, { status: 400 });
  }

  const start = startOfIsoWeek(year, week);
  const end = endOfIsoWeek(year, week);

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
    `${year}年第${week}周`,
  );

  return NextResponse.json({
    period: "weekly",
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    total_records: records.length,
    summary,
    highlights,
    risks,
    suggestions,
  });
}
