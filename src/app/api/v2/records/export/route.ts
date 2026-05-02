import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCsv } from "@/lib/csv";
import { dailyRecordToJson } from "@/lib/daily-record-json";
import { decodeJsonList } from "@/lib/record-analyzer";
import { parseYmd } from "@/lib/parse-ymd";

const CSV_HEADERS = [
  "id",
  "record_date",
  "raw_text",
  "chat_text",
  "screenshot_notes",
  "analysis_summary",
  "tags",
  "screenshot_paths",
  "created_at",
  "updated_at",
];

/** GET ?start_date=&end_date=&format=csv|json — 导出区间内日报 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const start = parseYmd(sp.get("start_date"));
  const end = parseYmd(sp.get("end_date"));
  const format = (sp.get("format") ?? "csv").toLowerCase();

  if (!start || !end) {
    return NextResponse.json(
      { message: "start_date 与 end_date 必填（YYYY-MM-DD）" },
      { status: 400 },
    );
  }
  if (start.getTime() > end.getTime()) {
    return NextResponse.json({ message: "start_date 不能晚于 end_date" }, { status: 400 });
  }

  const rows = await prisma.dailyRecord.findMany({
    where: { recordDate: { gte: start, lte: end } },
    orderBy: [{ recordDate: "asc" }, { id: "asc" }],
  });

  if (format === "json") {
    return NextResponse.json({
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      total: rows.length,
      records: rows.map(dailyRecordToJson),
    });
  }

  if (format !== "csv") {
    return NextResponse.json({ message: "format 须为 csv 或 json" }, { status: 400 });
  }

  const bodyRows: string[][] = rows.map((r) => {
    const tags = decodeJsonList(r.tagsJson).join(";");
    const paths = decodeJsonList(r.screenshotPathsJson).join(";");
    return [
      String(r.id),
      r.recordDate.toISOString().slice(0, 10),
      r.rawText,
      r.chatText,
      r.screenshotNotes,
      r.analysisSummary,
      tags,
      paths,
      r.createdAt.toISOString(),
      r.updatedAt.toISOString(),
    ];
  });

  const csv = buildCsv(CSV_HEADERS, bodyRows);
  const bom = "\uFEFF";
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const filename = `mybroker-records-${startStr}_${endStr}.csv`;

  return new NextResponse(bom + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
