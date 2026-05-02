export type ActionPriority = "low" | "medium" | "high";

const LEAD_IN =
  /^(?:todo|待办|下一步|明日计划|follow[- ]?up)[:：]?\s*/i;

export function inferPriority(content: string): ActionPriority {
  if (/(紧急|今天必须|立即|马上|ASAP|优先处理高)/i.test(content)) {
    return "high";
  }
  if (/(择机|后续再说|不着急|长期)/i.test(content)) {
    return "low";
  }
  return "medium";
}

/** 从整段工作记录中抽取待办行（与旧版 Python 规则一致） */
export function extractActionItemsFromText(text: string): string[] {
  const lines = text
    .split(/\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  const items: string[] = [];
  for (const line of lines) {
    if (LEAD_IN.test(line)) {
      const item = line.replace(LEAD_IN, "").trim();
      if (item) {
        items.push(item);
      }
    } else if (/(需要|尽快|本周|截止|推进|跟进)/.test(line)) {
      items.push(line);
    }
  }
  const dedup: string[] = [];
  const seen = new Set<string>();
  for (const x of items) {
    const k = x.trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      dedup.push(x);
    }
  }
  return dedup.slice(0, 20);
}

export function mergeRecordText(raw: string, chat: string, notes: string): string {
  return [raw.trim(), chat.trim(), notes.trim()].filter(Boolean).join("\n");
}
