import { NextRequest, NextResponse } from "next/server";
import { generateBrokerPriorities } from "@/lib/broker-advisor";
import { parseYmd } from "@/lib/parse-ymd";
import { jsonErrorResponse } from "@/lib/api-error";

function resolveDate(sp: URLSearchParams): string | null {
  const raw = sp.get("date") ?? sp.get("review_date");
  if (!raw) {
    return new Date().toISOString().slice(0, 10);
  }
  const d = parseYmd(raw);
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function GET(req: NextRequest) {
  const ymd = resolveDate(req.nextUrl.searchParams);
  if (!ymd) {
    return NextResponse.json({ message: "date 须为 YYYY-MM-DD" }, { status: 400 });
  }
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    const { data, cached } = await generateBrokerPriorities(ymd, refresh);
    return NextResponse.json({ ok: true, cached, priorities: data });
  } catch (err) {
    return jsonErrorResponse(err, "生成今日优先级失败");
  }
}

export async function POST(req: NextRequest) {
  let body: { date?: string; review_date?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // empty body ok
  }
  const raw = body.date ?? body.review_date;
  const ymd = raw ? (parseYmd(String(raw))?.toISOString().slice(0, 10) ?? null) : resolveDate(new URLSearchParams());
  if (!ymd) {
    return NextResponse.json({ message: "date 须为 YYYY-MM-DD" }, { status: 400 });
  }
  try {
    const { data, cached } = await generateBrokerPriorities(ymd, true);
    return NextResponse.json({ ok: true, cached, priorities: data });
  } catch (err) {
    return jsonErrorResponse(err, "生成今日优先级失败");
  }
}
