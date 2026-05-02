import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeJsonList } from "@/lib/record-analyzer";
import { parseYmd } from "@/lib/parse-ymd";

export async function GET(req: NextRequest) {
  const start = parseYmd(req.nextUrl.searchParams.get("start_date"));
  const end = parseYmd(req.nextUrl.searchParams.get("end_date"));
  if (!start || !end) {
    return NextResponse.json({ message: "start_date 与 end_date 必填（YYYY-MM-DD）" }, { status: 400 });
  }

  const records = await prisma.dailyRecord.findMany({
    where: {
      recordDate: { gte: start, lte: end },
    },
    orderBy: { recordDate: "asc" },
  });

  return NextResponse.json(
    records.map((r) => ({
      date: r.recordDate.toISOString().slice(0, 10),
      summary: r.analysisSummary,
      tags: decodeJsonList(r.tagsJson),
    })),
  );
}
