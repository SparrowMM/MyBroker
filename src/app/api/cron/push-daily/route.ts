import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { isWeekendLocal } from "@/lib/daily-notification";
import { sendDailyNotification } from "@/lib/daily-push";
import {
  getAutoPushDailyChannel,
  getAutoPushDailyEnabled,
  getAutoPushWeekdaysOnly,
} from "@/lib/env";
import { parseNotifyChannel } from "@/lib/notify-channel-parse";

async function run(req: NextRequest) {
  const auth = verifyCronSecret(req);
  if (!auth.ok) {
    const status = auth.reason === "CRON_SECRET 未配置" ? 503 : 401;
    return NextResponse.json({ ok: false, message: auth.reason }, { status });
  }

  if (!getAutoPushDailyEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "AUTO_PUSH_DAILY_ENABLED 未开启",
    });
  }

  if (getAutoPushWeekdaysOnly() && isWeekendLocal()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "AUTO_PUSH_WEEKDAYS_ONLY：周末不推送",
    });
  }

  const rawChannel = getAutoPushDailyChannel();
  const channel = parseNotifyChannel(rawChannel);
  if (!channel) {
    return NextResponse.json(
      {
        ok: false,
        message: `AUTO_PUSH_DAILY_CHANNEL 无效：${rawChannel}（须为 wecom/feishu/dingtalk）`,
      },
      { status: 400 },
    );
  }

  const result = await sendDailyNotification(channel);

  if (!result.ok && result.attempts === 0) {
    return NextResponse.json(
      {
        ok: false,
        channel: result.channel,
        message: result.message,
      },
      { status: 400 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        channel: result.channel,
        title: result.title,
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
    title: result.title,
    attempts: result.attempts,
    message: result.message,
    trigger: "cron",
  });
}

/** Vercel Cron 使用 GET；手动也可用 POST */
export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
