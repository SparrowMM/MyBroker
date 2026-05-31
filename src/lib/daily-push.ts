import { buildDailyDigestMarkdown } from "@/lib/daily-notification";
import { markdownToPlain } from "@/lib/markdown-plain";
import type { NotifyChannel } from "@/lib/notify-channel";
import {
  getNotifyRetryTimes,
  getNotifyTemplateFooter,
  getNotifyTemplateHeader,
  getNotifyWeekendTemplateFooter,
  getNotifyWeekendTemplateHeader,
  getWebhookUrl,
} from "@/lib/env";
import { writeNotificationLog } from "@/lib/notification-log";
import { deliverWithRetries } from "@/lib/webhook-delivery";

export type DailyPushResult = {
  ok: boolean;
  channel: NotifyChannel;
  title: string;
  status_code: number;
  message: string;
  attempts: number;
};

/** 构建简报并推送（写入 notification_logs） */
export async function sendDailyNotification(
  channel: NotifyChannel,
  options?: { overrideMarkdown?: string },
): Promise<DailyPushResult> {
  const url = getWebhookUrl(channel);
  if (!url) {
    return {
      ok: false,
      channel,
      title: "",
      status_code: 400,
      message: "未配置对应 Webhook URL",
      attempts: 0,
    };
  }

  const built = await buildDailyDigestMarkdown({
    header: getNotifyTemplateHeader(),
    footer: getNotifyTemplateFooter(),
    weekendHeader: getNotifyWeekendTemplateHeader(),
    weekendFooter: getNotifyWeekendTemplateFooter(),
  });

  const override = options?.overrideMarkdown?.trim();
  const payload = override
    ? {
        title: built.title,
        markdown: override,
        plain_text: markdownToPlain(override),
      }
    : built;

  const retries = getNotifyRetryTimes();
  const result = await deliverWithRetries(channel, url, payload, retries);

  await writeNotificationLog({
    channel,
    title: payload.title,
    content: payload.markdown,
    success: result.ok,
    responseMessage: result.message,
    attempts: result.attempts,
  });

  return {
    ok: result.ok,
    channel,
    title: payload.title,
    status_code: result.status_code,
    message: result.message,
    attempts: result.attempts,
  };
}
