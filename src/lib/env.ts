import type { NotifyChannel } from "@/lib/notify-channel";

export function getBailianApiKey(): string {
  return process.env.BAILIAN_API_KEY || process.env.DASHSCOPE_API_KEY || "";
}

export function getBailianBaseUrl(): string {
  return (
    process.env.BAILIAN_BASE_URL ||
    process.env.DASHSCOPE_BASE_URL ||
    "https://coding.dashscope.aliyuncs.com/v1"
  ).replace(/\/$/, "");
}

export function getBailianVisionBaseUrl(): string {
  return (
    process.env.BAILIAN_VISION_BASE_URL ||
    process.env.DASHSCOPE_VISION_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1"
  ).replace(/\/$/, "");
}

export function getBailianVisionApiKey(): string {
  return (
    process.env.BAILIAN_VISION_API_KEY ||
    process.env.DASHSCOPE_VISION_API_KEY ||
    getBailianApiKey()
  );
}

export function getBailianModel(): string {
  return process.env.BAILIAN_MODEL || process.env.DASHSCOPE_MODEL || "qwen-plus";
}

export function getBailianVisionModel(): string {
  return (
    process.env.BAILIAN_VISION_MODEL || process.env.DASHSCOPE_VISION_MODEL || "qwen-vl-max-latest"
  );
}

/** 可选：旧版独立 Agent/HTTP 服务基址；非空时可通过 `/api/agent/*` 透明转发。 */
export function getAgentBackendUrl(): string {
  return (process.env.AGENT_BACKEND_URL ?? "").trim().replace(/\/$/, "");
}

/** 非空时访问 `/api/agent/*` 必须带鉴权（避免桥接裸奔）；详见 README。 */
export function getAgentProxySecret(): string {
  return (process.env.AGENT_PROXY_SECRET ?? "").trim();
}

export function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

export function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function getSupabaseStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "mybroker-screenshots";
}

export type WebhookChannel = NotifyChannel;

export function getWebhookUrl(channel: WebhookChannel): string {
  const map: Record<WebhookChannel, string | undefined> = {
    wecom: process.env.WEBHOOK_WECOM_URL,
    feishu: process.env.WEBHOOK_FEISHU_URL,
    dingtalk: process.env.WEBHOOK_DINGTALK_URL,
  };
  return (map[channel] ?? "").trim();
}

export function getNotifyTemplateHeader(): string {
  return process.env.NOTIFY_TEMPLATE_HEADER ?? "";
}

export function getNotifyTemplateFooter(): string {
  return process.env.NOTIFY_TEMPLATE_FOOTER ?? "";
}

export function getNotifyWeekendTemplateHeader(): string {
  return process.env.NOTIFY_WEEKEND_TEMPLATE_HEADER ?? "";
}

export function getNotifyWeekendTemplateFooter(): string {
  return process.env.NOTIFY_WEEKEND_TEMPLATE_FOOTER ?? "";
}

export function getNotifyRetryTimes(): number {
  const n = Number(process.env.NOTIFY_RETRY_TIMES);
  return Number.isFinite(n) && n >= 0 ? Math.min(10, Math.floor(n)) : 2;
}

export function getAutoPushDailyEnabled(): boolean {
  return (process.env.AUTO_PUSH_DAILY_ENABLED ?? "").toLowerCase() === "true";
}

/** wecom | feishu | dingtalk */
export function getAutoPushDailyChannel(): string {
  return (process.env.AUTO_PUSH_DAILY_CHANNEL ?? "wecom").toLowerCase().trim();
}

export function getAutoPushWeekdaysOnly(): boolean {
  return (process.env.AUTO_PUSH_WEEKDAYS_ONLY ?? "true").toLowerCase() !== "false";
}
