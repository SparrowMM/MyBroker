import { chat } from "@/lib/bailian-client";
import { mergeRecordText } from "@/lib/action-items-logic";
import type { BrokerDailyReview, BrokerPriorities, BrokerPriorityItem } from "@/lib/broker-types";
import {
  dedupeDailyReportText,
  formatParsedRecordForBroker,
  parseDailyRecordMarkdown,
  type DailyRecordProject,
  type ParsedDailyRecord,
} from "@/lib/daily-record-structure";
import {
  BROKER_REVIEW_SYSTEM,
  buildBrokerReviewUserPrompt,
  reviewMarkdownMatchesDate,
  REVIEW_HEADINGS,
} from "@/lib/broker-review-voice";
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
    const merged = dedupeDailyReportText(
      mergeRecordText(r.rawText, r.chatText, r.screenshotNotes),
    );
    const tags = decodeJsonList(r.tagsJson);
    const parsed = parseDailyRecordMarkdown(merged);
    const structured = formatParsedRecordForBroker(parsed, tags);
    return `#${i + 1}\n${structured}\n---\n原文节选（供核对细节）:\n${merged.slice(0, 3500)}`;
  });

  const parsedRecords = records.map((r) =>
    parseDailyRecordMarkdown(
      dedupeDailyReportText(mergeRecordText(r.rawText, r.chatText, r.screenshotNotes)),
    ),
  );

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

  return { records, recordBlocks, parsedRecords, recentBlocks, openTodos, todoLines };
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

function dedupeProjects(projects: DailyRecordProject[]): DailyRecordProject[] {
  const map = new Map<string, DailyRecordProject>();
  for (const p of projects) {
    const hit = map.get(p.name);
    if (hit) {
      for (const item of p.items) {
        if (!hit.items.includes(item)) hit.items.push(item);
      }
    } else {
      map.set(p.name, { name: p.name, items: [...p.items] });
    }
  }
  return [...map.values()];
}

function mergeParsedRecords(parsedList: ParsedDailyRecord[]): ParsedDailyRecord {
  const merged: ParsedDailyRecord = {
    sections: { priorities: [], progress: [], risks: [], tomorrow: [], pending: [] },
    projects: [],
    lifeLines: [],
  };
  for (const p of parsedList) {
    merged.sections.priorities.push(...p.sections.priorities);
    merged.sections.progress.push(...p.sections.progress);
    merged.sections.risks.push(...p.sections.risks);
    merged.sections.tomorrow.push(...p.sections.tomorrow);
    merged.sections.pending.push(...p.sections.pending);
    merged.projects.push(...p.projects);
    merged.lifeLines.push(...p.lifeLines);
  }
  merged.projects = dedupeProjects(merged.projects);
  merged.lifeLines = [...new Set(merged.lifeLines)];
  merged.sections.priorities = [...new Set(merged.sections.priorities)];
  merged.sections.pending = [...new Set(merged.sections.pending)];
  return merged;
}

function fallbackReviewMarkdown(ymd: string, ctx: Awaited<ReturnType<typeof loadDayContext>>): string {
  const lines: string[] = [];
  const parsed = mergeParsedRecords(ctx.parsedRecords);
  const hasContent =
    parsed.sections.progress.length > 0 ||
    parsed.projects.length > 0 ||
    parsed.sections.pending.length > 0;

  lines.push(REVIEW_HEADINGS.title(ymd));
  lines.push("");
  lines.push("> 笔调来自本地整理（模型未响应），事实仍取自你的日报。");
  lines.push("");
  lines.push(REVIEW_HEADINGS.slice);
  if (!ctx.records.length) {
    lines.push("页面上还空着。随便写两三句，夜里复盘才有温度。");
  } else if (parsed.projects.length) {
    const vignettes = parsed.projects.map((proj) => {
      if (!proj.items.length) return `${proj.name} 在今日露了面，细节还藏在标题里。`;
      const acts = proj.items.slice(0, 4).join("、");
      return `**${proj.name}** — ${acts}${proj.items.length > 4 ? "…" : ""}`;
    });
    lines.push(vignettes.join("\n\n"));
  } else {
    lines.push(parsed.sections.progress.slice(0, 8).map((x) => `- ${x}`).join("\n"));
  }

  lines.push("");
  lines.push(REVIEW_HEADINGS.workbench);
  const lights: string[] = [];
  for (const proj of parsed.projects) {
    if (proj.items.length) {
      lights.push(`${proj.name} 往前走了 ${proj.items.length} 步，痕迹都留在记录里。`);
    }
  }
  if (!lights.length && parsed.sections.progress.length) {
    lights.push(`今日记下 ${parsed.sections.progress.length} 条线，像多张底片叠在同一天。`);
  }
  lines.push("- **闪过的光**");
  for (const x of (lights.length ? lights : ["材料尚薄，等你补几笔具体动作"]).slice(0, 4)) {
    lines.push(`  - ${x}`);
  }

  const mists: string[] = [...parsed.sections.risks.filter((x) => !/^待补充$/i.test(x))];
  if (!parsed.sections.tomorrow.length) {
    mists.push("明日计划还是空白，夜里少了一盏指向明天的灯。");
  }
  if (parsed.sections.pending.length) {
    mists.push(`${parsed.sections.pending.length} 件事仍停在「待确认」栏，像没收完的尾奏。`);
  }
  lines.push("- **未散的雾**");
  for (const x of (mists.length ? mists : ["风险栏若也空着，不妨用一句话写下此刻最大的不确定"]).slice(0, 4)) {
    lines.push(`  - ${x}`);
  }

  const lamps = [...parsed.sections.tomorrow, ...parsed.sections.pending.slice(0, 3)];
  lines.push("- **明日的一盏灯**");
  for (const x of (lamps.length ? lamps : ["先把待确认里最重要的一件收束，再写明日计划"]).slice(0, 4)) {
    lines.push(`  - ${x}`);
  }

  lines.push("");
  lines.push(REVIEW_HEADINGS.life);
  if (parsed.lifeLines.length) {
    lines.push(parsed.lifeLines.map((x) => x.replace(/^✅\s*/, "")).join("；") + "。");
    lines.push("工作再满，也记得给独处留一点余温。");
  } else if (hasContent) {
    lines.push("今天几乎全是工作台的声音；明天若能留半小时给自己，会轻松很多。");
  } else {
    lines.push("记录里没写到生活——若今天其实很累，也值得被看见。");
  }

  lines.push("");
  lines.push(REVIEW_HEADINGS.pending);
  const pendingFromRecord = parsed.sections.pending;
  if (pendingFromRecord.length) {
    for (const x of pendingFromRecord) {
      lines.push(`- ${x}`);
    }
  }
  if (ctx.openTodos.length) {
    for (const t of ctx.openTodos.slice(0, 8)) {
      lines.push(`- ${t.content}`);
    }
  }
  if (!pendingFromRecord.length && !ctx.openTodos.length) {
    lines.push("- 暂无悬而未决；若心里有数，可写在日报「待确认事项」。");
  }

  lines.push("");
  lines.push(REVIEW_HEADINGS.closing);
  const topPending = parsed.sections.pending.at(-1) ?? parsed.sections.pending[0];
  const topProject = parsed.projects[0]?.name;
  if (topPending) {
    lines.push(
      `今天铺开的线头不少。明天不必全收，先把「${topPending.slice(0, 36)}」这一节拉直，其它的会跟上来。`,
    );
  } else if (topProject) {
    lines.push(
      `${topProject} 已有实感进展。睡前补两行明日计划，明天的你会少一分茫然。`,
    );
  } else if (ctx.records.length) {
    lines.push("骨架已在。补全风险与明日计划后重新生成，可换一版更细的夜谈。");
  } else {
    lines.push("空白的一天很难替你点灯。明天随手记一两句就好。");
  }
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
2) 若记录中有「工作优先级 / 当前工作打标 / P1-P5 / 重点事情」，优先对齐用户已声明的重点，再参考待办与今日进展；
3) 生活建议仅当记录或待办中出现休息/健康/家庭等线索；
4) 中文简洁可执行。`;

  const raw = await chat(
    [
      {
        role: "system",
        content:
          "你是私人经纪人助理。只返回合法 JSON，不要 markdown 代码块。",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.35, scenario: "broker_priorities", maxTokens: 1200, timeoutSec: 60 },
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

function emptyBrokerDailyReview(ymd: string): BrokerDailyReview {
  return {
    review_date: ymd,
    generated_at: new Date().toISOString(),
    source: "fallback",
    markdown: "",
  };
}

async function clearReviewMarkdown(ymd: string): Promise<void> {
  const reviewDate = ymdToUtcMidnight(ymd);
  const row = await prisma.dailyReview.findUnique({ where: { reviewDate } });
  if (!row?.reviewMarkdown?.trim()) return;
  await prisma.dailyReview.update({
    where: { reviewDate },
    data: { reviewMarkdown: "", updatedAt: new Date() },
  });
}

/** 记录在复盘生成/更新后又变动时，缓存视为过期 */
async function isDailyReviewStale(ymd: string, reviewUpdatedAt: Date): Promise<boolean> {
  const dayStart = ymdToUtcMidnight(ymd);
  const latestRecord = await prisma.dailyRecord.findFirst({
    where: { recordDate: dayStart },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  if (!latestRecord) return false;
  return latestRecord.updatedAt.getTime() > reviewUpdatedAt.getTime();
}

async function readValidCachedReview(
  ymd: string,
  existing: { reviewMarkdown: string; updatedAt: Date },
): Promise<BrokerDailyReview | null> {
  const md = existing.reviewMarkdown.trim();
  if (!md) return null;
  if (!reviewMarkdownMatchesDate(md, ymd)) return null;
  if (await isDailyReviewStale(ymd, existing.updatedAt)) return null;

  const source: BrokerDailyReview["source"] =
    md.includes("笔调来自本地整理") || md.includes("本地结构化复盘") ? "fallback" : "llm";
  return {
    review_date: ymd,
    generated_at: existing.updatedAt.toISOString(),
    source,
    markdown: md,
  };
}

export async function generateBrokerDailyReview(
  ymd: string,
  force = false,
): Promise<{ data: BrokerDailyReview; cached: boolean }> {
  const existing = await prisma.dailyReview.findUnique({
    where: { reviewDate: ymdToUtcMidnight(ymd) },
  });
  if (existing?.reviewMarkdown?.trim() && !force) {
    const cached = await readValidCachedReview(ymd, existing);
    if (cached) {
      return { data: cached, cached: true };
    }
    await clearReviewMarkdown(ymd);
    return { data: emptyBrokerDailyReview(ymd), cached: false };
  }

  if (!force) {
    return { data: emptyBrokerDailyReview(ymd), cached: false };
  }

  const ctx = await loadDayContext(ymd);
  const prompt = buildBrokerReviewUserPrompt(
    ymd,
    ctx.recordBlocks.join("\n\n────\n\n") || "（今日无记录）",
    ctx.todoLines.join("\n") || "（无）",
  );

  const raw = await chat(
    [
      { role: "system", content: BROKER_REVIEW_SYSTEM },
      { role: "user", content: prompt },
    ],
    {
      temperature: 0.52,
      scenario: "broker_daily_review",
      maxTokens: 2800,
      timeoutSec: 90,
    },
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
