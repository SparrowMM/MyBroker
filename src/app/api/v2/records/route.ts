import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dailyRecordToJson } from "@/lib/daily-record-json";
import { dedupeDailyReportText } from "@/lib/daily-record-structure";
import { analyzeDaily } from "@/lib/record-analyzer";
import { parseYmd } from "@/lib/parse-ymd";
import { jsonErrorResponse } from "@/lib/api-error";

/** GET /api/v2/records — 列表；支持 record_date、start_date+end_date、limit */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const recordDate = parseYmd(sp.get("record_date"));
    const startDate = parseYmd(sp.get("start_date"));
    const endDate = parseYmd(sp.get("end_date"));

    const where: Prisma.DailyRecordWhereInput = {};

    if (recordDate) {
      where.recordDate = recordDate;
    } else if (startDate && endDate) {
      where.recordDate = { gte: startDate, lte: endDate };
    } else if (startDate) {
      where.recordDate = { gte: startDate };
    } else if (endDate) {
      where.recordDate = { lte: endDate };
    }

    const closedRange = !!(startDate && endDate);
    const reqLimit = Number(sp.get("limit"));
    const limit = closedRange
      ? Math.min(5000, Math.max(1, Number.isFinite(reqLimit) && reqLimit > 0 ? reqLimit : 2000))
      : Math.min(500, Math.max(1, Number.isFinite(reqLimit) && reqLimit > 0 ? reqLimit : 100));

    const rows = await prisma.dailyRecord.findMany({
      where,
      orderBy: { recordDate: "desc" },
      take: limit,
    });

    return NextResponse.json(rows.map(dailyRecordToJson));
  } catch (err) {
    return jsonErrorResponse(err, "查询日报失败");
  }
}

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 解析失败" }, { status: 400 });
  }

  const recordDateRaw = payload.record_date;
  if (!recordDateRaw) {
    return NextResponse.json({ ok: false, message: "record_date 必填" }, { status: 400 });
  }

  const parsedDate = parseYmd(String(recordDateRaw));
  if (!parsedDate) {
    return NextResponse.json(
      { ok: false, message: "record_date 格式需为 YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const rawText = dedupeDailyReportText(String(payload.raw_text ?? ""));
  const chatText = String(payload.chat_text ?? "");
  const screenshotNotes = String(payload.screenshot_notes ?? "");
  const screenshotPathsRaw = payload.screenshot_paths;
  const screenshotPaths = Array.isArray(screenshotPathsRaw)
    ? screenshotPathsRaw.map((x) => String(x))
    : [];

  if (!rawText.trim() && !chatText.trim() && !screenshotNotes.trim()) {
    return NextResponse.json(
      { ok: false, message: "至少填写工作描述 / 对话纪要 / 截图说明中的一项" },
      { status: 400 },
    );
  }

  try {
    const { summary, tags } = await analyzeDaily(parsedDate, rawText, chatText, screenshotNotes);
    const now = new Date();

    const record = await prisma.dailyRecord.create({
      data: {
        recordDate: parsedDate,
        rawText,
        chatText,
        screenshotPathsJson: JSON.stringify(screenshotPaths),
        screenshotNotes,
        analysisSummary: summary,
        tagsJson: JSON.stringify(tags),
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json({
      ok: true,
      record: dailyRecordToJson(record),
    });
  } catch (err) {
    return jsonErrorResponse(err, "保存日报失败");
  }
}
