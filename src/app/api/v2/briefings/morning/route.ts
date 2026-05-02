import { NextResponse } from "next/server";
import { buildMorningBriefing } from "@/lib/morning-briefing";

/** GET — 晨会简报（昨日 + 本周标签 + 待办摘要） */
export async function GET() {
  const data = await buildMorningBriefing();
  return NextResponse.json(data);
}
