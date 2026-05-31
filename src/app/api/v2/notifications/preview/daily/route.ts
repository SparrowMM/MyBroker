import { NextRequest, NextResponse } from "next/server";
import { buildDailyDigestMarkdown } from "@/lib/daily-notification";
import {
  getNotifyTemplateFooter,
  getNotifyTemplateHeader,
  getNotifyWeekendTemplateFooter,
  getNotifyWeekendTemplateHeader,
} from "@/lib/env";
import { parseNotifyChannel } from "@/lib/notify-channel-parse";

/** GET ?channel=wecom|feishu|dingtalk — 仅预览，不发送、不写库 */
export async function GET(req: NextRequest) {
  const ch = parseNotifyChannel(req.nextUrl.searchParams.get("channel"));
  if (!ch) {
    return NextResponse.json(
      { message: "channel 须为 wecom / feishu / dingtalk" },
      { status: 400 },
    );
  }

  const payload = await buildDailyDigestMarkdown({
    header: getNotifyTemplateHeader(),
    footer: getNotifyTemplateFooter(),
    weekendHeader: getNotifyWeekendTemplateHeader(),
    weekendFooter: getNotifyWeekendTemplateFooter(),
  });

  return NextResponse.json({
    channel: ch,
    title: payload.title,
    markdown: payload.markdown,
    plain_text: payload.plain_text,
  });
}
