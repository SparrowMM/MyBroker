import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dailyRecordToJson } from "@/lib/daily-record-json";
import { dedupeDailyReportText } from "@/lib/daily-record-structure";
import { analyzeDaily } from "@/lib/record-analyzer";
import { jsonErrorResponse } from "@/lib/api-error";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** POST — 按当前字段重新跑日报分析（不写请求体也可） */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await context.params;
  const id = parseId(idStr);
  if (id === null) {
    return NextResponse.json({ ok: false, message: "无效的 id" }, { status: 400 });
  }

  try {
    const existing = await prisma.dailyRecord.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, message: "记录不存在" }, { status: 404 });
    }

    const rawText = dedupeDailyReportText(existing.rawText);
    const { summary, tags } = await analyzeDaily(
      existing.recordDate,
      rawText,
      existing.chatText,
      existing.screenshotNotes,
    );

    const updated = await prisma.dailyRecord.update({
      where: { id },
      data: {
        ...(rawText !== existing.rawText ? { rawText } : {}),
        analysisSummary: summary,
        tagsJson: JSON.stringify(tags),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, record: dailyRecordToJson(updated) });
  } catch (err) {
    return jsonErrorResponse(err, "重新分析失败");
  }
}
