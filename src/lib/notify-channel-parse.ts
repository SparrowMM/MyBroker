import type { NotifyChannel } from "@/lib/notify-channel";

export function parseNotifyChannel(s: string | null): NotifyChannel | null {
  const c = (s ?? "").toLowerCase().trim();
  if (c === "wecom" || c === "wework") {
    return "wecom";
  }
  if (c === "feishu" || c === "lark") {
    return "feishu";
  }
  if (c === "dingtalk" || c === "ding") {
    return "dingtalk";
  }
  return null;
}
