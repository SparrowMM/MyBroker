import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeJsonList } from "@/lib/record-analyzer";

export async function GET(req: NextRequest) {
  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 14));
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const records = await prisma.dailyRecord.findMany({
    where: { recordDate: { lte: end } },
    orderBy: { recordDate: "desc" },
    take: days,
  });

  return NextResponse.json({
    days,
    total_records: records.length,
    latest_records: records.map((r) => ({
      id: r.id,
      date: r.recordDate.toISOString().slice(0, 10),
      summary: r.analysisSummary,
      tags: decodeJsonList(r.tagsJson),
    })),
  });
}
