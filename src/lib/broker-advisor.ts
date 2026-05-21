import { chat } from "@/lib/bailian-client";
import { mergeRecordText } from "@/lib/action-items-logic";
import type { BrokerDailyReview, BrokerPriorities, BrokerPriorityItem } from "@/lib/broker-types";
import { prisma } from "@/lib/prisma";
import { decodeJsonList } from "@/lib/record-analyzer";
import { ymdToUtcMidnight } from "@/lib/parse-ymd";

export type { BrokerDailyReview, BrokerPriorities, BrokerPriorityItem } from "@/lib/broker-types";

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function loadDayContext(ymd: string) {
  const dayStart = ymdToUtcMidnight(ymd);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const records = await prisma.dailyRecord.findMany({
    where: { recordDate: dayStart },
    orderBy: { id: "asc" },
  });

  const lookbackStart = ymdToUtcMidnight(addDaysYmd(ymd, -3));
  const recentRecords = await prisma.dailyRecord.findMany({
    where: { recordDate: { gte: lookbackStart, lte: dayEnd } },
    orderBy: { recordDate: "desc" },
    take: 40,
  });

  const openTodos = await prisma.actionItem.findMany({
    where: { status: "todo" },
    take: 80,
  });
  const prank = (p: string) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
  openTodos.sort(
    (a, b) =>
      prank(a.priority) - prank(b.priority) || a.sourceDate.getTime() - b.sourceDate.getTime(),
  );

  const recordBlocks = records.map((r, i) => {
    const merged = mergeRecordText(r.rawText, r.chatText, r.screenshotNotes);
    const tags = decodeJsonList(r.tagsJson);
    return `#${i + 1} 标签:${tags.join("、") || "无"}\n摘要:${r.analysisSummary || "（无）"}\n原文节选:${merged.slice(0, 800)}`;
  });

  const recentBlocks = recentRecords
    .filter((r) => r.recordDate.toISOString().slice(0, 10) !== ymd)
    .slice(0, 8)
    .map((r) => {
      const d = r.recordDate.toISOString().slice(0, 10);
      return `${d}: ${r.analysisSummary || mergeRecordText(r.rawText, r.chatText, r.screenshotNotes).slice(0, 120)}`;
    });

  const todoLines = openTodos.slice(0, 20).map((t) => {
    const due = t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "无";
    return `- [${t.priority}] ${t.content}（来源 ${t.sourceDate.toISOString().slice(0, 10)}，截止 ${due}）`;
  });

  return { records, recordBlocks, recentBlocks, openTodos, todoLines };
}

function fallbackPriorities(ymd: string, ctx: Awaited<ReturnType<typeof loadDayContext>>): BrokerPriorities {
  const topThree: BrokerPriorityItem[] = [];
  for (const t of ctx.openTodos.filter((x) => x.priority === "high").slice(0, 3)) {
    topThree.push({
      title: t.content.slice(0, 80),
      reason: "来自未完成的高优先级待办",
      kind: "work",
    });
  }
  for (const r of ctx.records.slice(0, 3 - topThree.length)) {
    if (topThree.length >= 3) break;
    topThree.push({
      title: (r.analysisSummary || r.rawText).slice(0, 80),
      reason: `今日记录 #${r.id} 的跟进`,
      kind: "work",
    });
  }
  while (topThree.length < 3) {
    topThree.push({
      title: topThree.length === 0 ? "补记今日关键事项" : "处理一条未完成待办",
      reason: "记录较少时的默认建议",
      kind: topThree.length === 2 ? "life" : "work",
    });
  }

  return {
    review_date: ymd,
    generated_at: new Date().toISOString(),
    source: "fallback",
    top_three: topThree.slice(0, 3),
    decision: {
      question: "今天应先推进哪条线？",
      options: ["客户/对外事项", "内部项目/文档", "先休息再处理"],
      recommendation:
        ctx.records.length === 0
          ? "先花 5 分钟补记今天做的事，再决定优先级。"
          : "优先闭环今日记录里提到的对外承诺。",
    },
    broker_note:
      ctx.records.length === 0
        ? "今天还没有记录；随手记一两句，日终复盘会更准。"
        : `今日 ${ctx.records.length} 条记录，${ctx.openTodos.length} 项待办未完成。`,
  };
}

function fallbackReviewMarkdown(ymd: string, ctx: Awaited<ReturnType<typeof loadDayContext>>): string {
  const lines: string[] = [];
  lines.push(`## ${ymd} 日终复盘`);
  lines.push("");
  lines.push("### 今天做了什么");
  if (!ctx.records.length) {
    lines.push("- （今日暂无记录，建议补记后再生成）");
  } else {
    for (const r of ctx.records) {
      lines.push(`- ${r.analysisSummary || r.rawText.slice(0, 120)}`);
    }
  }
  lines.push("");
  lines.push("### 工作");
  lines.push("- **亮点**：" + (ctx.records.length ? "已沉淀当日工作记录" : "待补充"));
  lines.push("- **卡点**：待办未闭环项需关注");
  lines.push("- **明天建议**：优先处理高优待办");
  lines.push("");
  lines.push("### 生活");
  const lifeHint = ctx.recordBlocks.some((b) => /休息|运动|家庭|健康|睡眠/.test(b));
  if (lifeHint) {
    lines.push("- 记录中提到生活相关事项，注意节奏与恢复。");
  } else {
    lines.push("- 今日记录未提及生活话题；若今天较累，可适当安排休息。");
  }
  lines.push("");
  lines.push("### 未完成待办");
  if (!ctx.openTodos.length) {
    lines.push("- （暂无）");
  } else {
    for (const t of ctx.openTodos.slice(0, 8)) {
      lines.push(`- [${t.priority}] ${t.content}`);
    }
  }
  lines.push("");
  lines.push("### 经纪人寄语");
  lines.push(
    ctx.records.length
      ? "今天有记录就有复盘基础；明天先把最重要的一件事做完。"
      : "空记录的一天很难帮你做决策；明天记得随手记。",
  );
  return lines.join("\n");
}

export async function generateBrokerPriorities(
  ymd: string,
  force = false,
): Promise<{ data: BrokerPriorities; cached: boolean }> {
  const existing = await prisma.dailyReview.findUnique({
    where: { reviewDate: ymdToUtcMidnight(ymd) },
  });
  if (existing?.prioritiesJson && !force) {
    try {
      const parsed = JSON.parse(existing.prioritiesJson) as BrokerPriorities;
      if (parsed.top_three?.length) {
        return { data: parsed, cached: true };
      }
    } catch {
      // regenerate
    }
  }

  const ctx = await loadDayContext(ymd);
  const prompt = `你是用户的私人经纪人，只服务一个人。根据以下材料，输出今日行动优先级（JSON  only）。

日期: ${ymd}
今日记录（${ctx.records.length} 条）:
${ctx.recordBlocks.join("\n---\n") || "（无）"}

近几日摘要:
${ctx.recentBlocks.join("\n") || "（无）"}

未完成待办:
${ctx.todoLines.join("\n") || "（无）"}

JSON 字段:
- top_three: 数组，最多3项，每项 { title, reason, kind }，kind 为 work|life|mixed
- decision: { question, options: string[2-4], recommendation }
- broker_note: 一句经纪人口吻的提醒（≤80字）

要求:
1) 只根据材料推断，不编造客户名/金额；
2) 生活建议仅当记录或待办中出现休息/健康/家庭等线索；
3) 中文简洁可执行。`;

  const raw = await chat(
    [
      {
        role: "system",
        content:
          "你是私人经纪人助理。只返回合法 JSON，不要 markdown 代码块。",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.35, scenario: "broker_priorities", maxTokens: 1200 },
  );

  let data: BrokerPriorities;
  const parsed = raw ? extractJsonObject(raw) : null;
  if (parsed && Array.isArray(parsed.top_three)) {
    data = {
      review_date: ymd,
      generated_at: new Date().toISOString(),
      source: "llm",
      top_three: (parsed.top_three as BrokerPriorityItem[]).slice(0, 3),
      decision: {
        question: String((parsed.decision as Record<string, unknown>)?.question ?? "今天应先做什么？"),
        options: Array.isArray((parsed.decision as Record<string, unknown>)?.options)
          ? ((parsed.decision as Record<string, unknown>).options as string[]).map(String).slice(0, 4)
          : ["推进工作", "处理生活", "暂缓观察"],
        recommendation: String(
          (parsed.decision as Record<string, unknown>)?.recommendation ?? "按材料选择一项先闭环。",
        ),
      },
      broker_note: String(parsed.broker_note ?? "").slice(0, 200),
    };
  } else {
    data = fallbackPriorities(ymd, ctx);
  }

  const now = new Date();
  await prisma.dailyReview.upsert({
    where: { reviewDate: ymdToUtcMidnight(ymd) },
    create: {
      reviewDate: ymdToUtcMidnight(ymd),
      prioritiesJson: JSON.stringify(data),
      reviewMarkdown: existing?.reviewMarkdown ?? "",
      createdAt: now,
      updatedAt: now,
    },
    update: {
      prioritiesJson: JSON.stringify(data),
      updatedAt: now,
    },
  });

  return { data, cached: false };
}

export async function generateBrokerDailyReview(
  ymd: string,
  force = false,
): Promise<{ data: BrokerDailyReview; cached: boolean }> {
  const existing = await prisma.dailyReview.findUnique({
    where: { reviewDate: ymdToUtcMidnight(ymd) },
  });
  if (existing?.reviewMarkdown?.trim() && !force) {
    return {
      data: {
        review_date: ymd,
        generated_at: existing.updatedAt.toISOString(),
        source: "llm",
        markdown: existing.reviewMarkdown,
      },
      cached: true,
    };
  }

  const ctx = await loadDayContext(ymd);
  const prompt = `你是用户的私人经纪人。请为 ${ymd} 写一份日终复盘（Markdown，不要 JSON）。

今日记录:
${ctx.recordBlocks.join("\n---\n") || "（今日无记录）"}

未完成待办:
${ctx.todoLines.join("\n") || "（无）"}

结构必须包含以下二级标题（按顺序）:
## ${ymd} 日终复盘
### 今天做了什么
### 工作（含亮点、卡点、明天工作建议，可用列表）
### 生活（仅根据记录延伸；无生活线索则写一句温和提醒，勿编造具体事件）
### 未完成待办
### 经纪人寄语

要求: 中文、具体、可执行；不编造未出现的客户/金额；每条列表不超过 8 项。`;

  const raw = await chat(
    [
      {
        role: "system",
        content: "你是私人经纪人，擅长日终复盘与温和的生活工作平衡建议。",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.4, scenario: "broker_daily_review", maxTokens: 2000 },
  );

  const markdown = raw?.trim() ? raw.trim() : fallbackReviewMarkdown(ymd, ctx);
  const data: BrokerDailyReview = {
    review_date: ymd,
    generated_at: new Date().toISOString(),
    source: raw?.trim() ? "llm" : "fallback",
    markdown,
  };

  const now = new Date();
  const row = await prisma.dailyReview.findUnique({
    where: { reviewDate: ymdToUtcMidnight(ymd) },
  });
  await prisma.dailyReview.upsert({
    where: { reviewDate: ymdToUtcMidnight(ymd) },
    create: {
      reviewDate: ymdToUtcMidnight(ymd),
      prioritiesJson: row?.prioritiesJson ?? "{}",
      reviewMarkdown: markdown,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      reviewMarkdown: markdown,
      updatedAt: now,
    },
  });

  return { data, cached: false };
}
