import { NextRequest, NextResponse } from "next/server";
import { syncActionItemsFromRecords } from "@/lib/action-items-sync";

/** POST — 从近 N 天日报抽取待办入库（默认 14） */
export async function POST(req: NextRequest) {
  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 14));
  const result = await syncActionItemsFromRecords(days);
  return NextResponse.json({ ok: true, ...result });
}
