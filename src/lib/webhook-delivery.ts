import type { NotifyChannel } from "@/lib/notify-channel";

export type DeliveryResult = {
  ok: boolean;
  status_code: number;
  message: string;
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 20)}\n…（已截断）`;
}

/** 企业微信群机器人 — Markdown */
export async function sendWecomMarkdown(
  webhookUrl: string,
  markdown: string,
): Promise<DeliveryResult> {
  const body = {
    msgtype: "markdown",
    markdown: { content: truncate(markdown, 3800) },
  };
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let ok = resp.ok;
  if (ok) {
    try {
      const j = JSON.parse(text) as { errcode?: number };
      if (typeof j.errcode === "number" && j.errcode !== 0) {
        ok = false;
      }
    } catch {
      // 非 JSON 则仅以 HTTP 为准
    }
  }
  return {
    ok,
    status_code: resp.status,
    message: text.slice(0, 800),
  };
}

/** 飞书自定义机器人 — 文本 */
export async function sendFeishuText(webhookUrl: string, text: string): Promise<DeliveryResult> {
  const body = {
    msg_type: "text",
    content: { text: truncate(text, 6000) },
  };
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const msg = await resp.text();
  return {
    ok: resp.ok,
    status_code: resp.status,
    message: msg.slice(0, 800),
  };
}

/** 钉钉自定义机器人 — Markdown */
export async function sendDingtalkMarkdown(
  webhookUrl: string,
  title: string,
  markdown: string,
): Promise<DeliveryResult> {
  const body = {
    msgtype: "markdown",
    markdown: {
      title: truncate(title, 80),
      text: truncate(markdown, 18000),
    },
  };
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const msg = await resp.text();
  return {
    ok: resp.ok,
    status_code: resp.status,
    message: msg.slice(0, 800),
  };
}

export async function deliverDailyNotification(
  channel: NotifyChannel,
  webhookUrl: string,
  payload: { title: string; markdown: string; plain_text: string },
): Promise<DeliveryResult> {
  switch (channel) {
    case "wecom":
      return sendWecomMarkdown(webhookUrl, payload.markdown);
    case "feishu":
      return sendFeishuText(webhookUrl, `${payload.title}\n\n${payload.plain_text}`);
    case "dingtalk":
      return sendDingtalkMarkdown(webhookUrl, payload.title, payload.markdown);
    default:
      return { ok: false, status_code: 0, message: "unknown channel" };
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function deliverWithRetries(
  channel: NotifyChannel,
  webhookUrl: string,
  payload: { title: string; markdown: string; plain_text: string },
  maxRetries: number,
): Promise<DeliveryResult & { attempts: number }> {
  let last: DeliveryResult = { ok: false, status_code: 0, message: "" };
  const maxAttempts = Math.max(1, maxRetries + 1);
  for (let i = 0; i < maxAttempts; i++) {
    last = await deliverDailyNotification(channel, webhookUrl, payload);
    if (last.ok) {
      return { ...last, attempts: i + 1 };
    }
    if (i < maxAttempts - 1) {
      await sleep(400 * (i + 1));
    }
  }
  return { ...last, attempts: maxAttempts };
}
