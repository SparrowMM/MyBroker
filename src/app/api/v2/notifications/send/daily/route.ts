import { NextRequest, NextResponse } from "next/server";
import { sendDailyNotification } from "@/lib/daily-push";
import { parseNotifyChannel } from "@/lib/notify-channel-parse";

/** POST ?channel= — 构建简报并推送到对应 WEBHOOK_*_URL，写入 notification_logs */
export async function POST(req: NextRequest) {
  const ch = parseNotifyChannel(req.nextUrl.searchParams.get("channel"));
  if (!ch) {
    return NextResponse.json(
      { message: "channel 须为 wecom / feishu / dingtalk" },
      { status: 400 },
    );
  }

  let overrideMarkdown: string | undefined;
  const raw = await req.text();
  if (raw.trim()) {
    try {
      const body = JSON.parse(raw) as { markdown?: unknown };
      if (typeof body.markdown === "string") {
        overrideMarkdown = body.markdown;
      }
    } catch {
      // ignore invalid JSON
    }
  }

  const result = await sendDailyNotification(ch, { overrideMarkdown });

  if (!result.ok && result.status_code === 400) {
    return NextResponse.json(
      {
        message: `未配置该渠道 Webhook 环境变量`,
      },
      { status: 400 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        channel: result.channel,
        status_code: result.status_code,
        message: result.message,
        attempts: result.attempts,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    channel: result.channel,
    attempts: result.attempts,
    message: result.message,
  });
}
