import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dailyRecordToJson } from "@/lib/daily-record-json";
import { parseYmd } from "@/lib/parse-ymd";
import { analyzeDaily } from "@/lib/record-analyzer";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await context.params;
  const id = parseId(idStr);
  if (id === null) {
    return NextResponse.json({ message: "无效的 id" }, { status: 400 });
  }

  const row = await prisma.dailyRecord.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ message: "记录不存在" }, { status: 404 });
  }

  return NextResponse.json(dailyRecordToJson(row));
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await context.params;
  const id = parseId(idStr);
  if (id === null) {
    return NextResponse.json({ message: "无效的 id" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "JSON 解析失败" }, { status: 400 });
  }

  const existing = await prisma.dailyRecord.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "记录不存在" }, { status: 404 });
  }

  let recordDate = existing.recordDate;
  if (payload.record_date !== undefined) {
    const d = parseYmd(String(payload.record_date));
    if (!d) {
      return NextResponse.json({ message: "record_date 格式需为 YYYY-MM-DD" }, { status: 400 });
    }
    recordDate = d;
  }

  const rawText = payload.raw_text !== undefined ? String(payload.raw_text) : existing.rawText;
  const chatText = payload.chat_text !== undefined ? String(payload.chat_text) : existing.chatText;
  const screenshotNotes =
    payload.screenshot_notes !== undefined ? String(payload.screenshot_notes) : existing.screenshotNotes;

  let screenshotPathsJson = existing.screenshotPathsJson;
  if (payload.screenshot_paths !== undefined) {
    const sp = payload.screenshot_paths;
    screenshotPathsJson = JSON.stringify(Array.isArray(sp) ? sp.map((x) => String(x)) : []);
  }

  const { summary, tags } = await analyzeDaily(recordDate, rawText, chatText, screenshotNotes);
  const now = new Date();

  const updated = await prisma.dailyRecord.update({
    where: { id },
    data: {
      recordDate,
      rawText,
      chatText,
      screenshotPathsJson,
      screenshotNotes,
      analysisSummary: summary,
      tagsJson: JSON.stringify(tags),
      updatedAt: now,
    },
  });

  return NextResponse.json({ ok: true, record: dailyRecordToJson(updated) });
}
