import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dailyRecordToJson } from "@/lib/daily-record-json";
import { parseYmd } from "@/lib/parse-ymd";

/** GET ?report_date=YYYY-MM-DD — 指定日的日报汇总（可多条） */
export async function GET(req: NextRequest) {
  const reportDate = parseYmd(req.nextUrl.searchParams.get("report_date"));
  if (!reportDate) {
    return NextResponse.json({ message: "report_date 必填（YYYY-MM-DD）" }, { status: 400 });
  }

  const records = await prisma.dailyRecord.findMany({
    where: { recordDate: reportDate },
    orderBy: { id: "asc" },
  });

  const ymd = reportDate.toISOString().slice(0, 10);

  return NextResponse.json({
    report_date: ymd,
    total_records: records.length,
    records: records.map(dailyRecordToJson),
  });
}
