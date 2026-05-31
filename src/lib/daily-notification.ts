import { buildMorningBriefing } from "@/lib/morning-briefing";
import { prisma } from "@/lib/prisma";
import { isWeekendLocal } from "@/lib/local-date";
import { markdownToPlain } from "@/lib/markdown-plain";
import { utcTodayEnd, utcTodayMidnight } from "@/lib/parse-ymd";

export type { NotifyChannel } from "@/lib/notify-channel";

export { isWeekendLocal };

function escapeMarkdownLine(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

/** 拼装每日推送正文（Markdown），供企业微信 / 钉钉等使用 */
export async function buildDailyDigestMarkdown(options: {
  header?: string;
  footer?: string;
  weekendHeader?: string;
  weekendFooter?: string;
}): Promise<{ title: string; markdown: string; plain_text: string }> {
  const briefing = await buildMorningBriefing();

  const weekend = isWeekendLocal();
  const head =
    (weekend && options.weekendHeader?.trim()) || options.header?.trim() || "";
  const foot =
    (weekend && options.weekendFooter?.trim()) || options.footer?.trim() || "";

  const today = new Date().toISOString().slice(0, 10);
  const title = `MyBroker 每日简报 · ${today}`;

  const lines: string[] = [];
  lines.push(`## ${title}`);
  if (head) {
    lines.push("");
    lines.push(head);
  }
  lines.push("");
  lines.push("### 昨日回顾");
  if (briefing.yesterday.records.length === 0) {
    lines.push(briefing.yesterday.narrative);
  } else {
    for (const r of briefing.yesterday.records) {
      const tagStr = r.tags.length ? `「${r.tags.join("、")}」` : "";
      lines.push(`- **日报 #${r.id}** ${tagStr}`);
      lines.push(`  ${escapeMarkdownLine(r.summary || "（无摘要）")}`);
    }
  }

  lines.push("");
  lines.push("### 本周重心标签");
  lines.push(
    briefing.week_focus_tags.length
      ? briefing.week_focus_tags.join("、")
      : "（暂无标签聚合）",
  );

  lines.push("");
  lines.push("### 高优先级待办");
  if (!briefing.priority_todos.length) {
    lines.push("（暂无）");
  } else {
    for (const t of briefing.priority_todos) {
      lines.push(`- [ ] ${escapeMarkdownLine(t.content)}（${t.source_date}）`);
    }
  }

  lines.push("");
  lines.push("### 其它未完成待办（节选）");
  if (!briefing.other_open_todos.length) {
    lines.push("（暂无）");
  } else {
    for (const t of briefing.other_open_todos.slice(0, 8)) {
      lines.push(`- ${escapeMarkdownLine(t.content)}（${t.source_date}）`);
    }
  }

  if (foot) {
    lines.push("");
    lines.push(foot);
  }

  let markdown = lines.join("\n");
  markdown = await appendReminderSnippet(markdown);
  const plain_text = markdownToPlain(markdown);

  return { title, markdown, plain_text };
}

/** 逾期 / 今日到期提醒（并入正文） */
async function appendReminderSnippet(markdown: string): Promise<string> {
  const startToday = utcTodayMidnight();
  const endToday = utcTodayEnd();

  const overdue = await prisma.actionItem.findMany({
    where: { status: "todo", dueDate: { lt: startToday } },
    take: 8,
    orderBy: { dueDate: "asc" },
  });

  const dueToday = await prisma.actionItem.findMany({
    where: { status: "todo", dueDate: { gte: startToday, lte: endToday } },
    take: 8,
  });

  if (!overdue.length && !dueToday.length) {
    return markdown;
  }

  const extra: string[] = ["", "### 截止提醒"];
  if (overdue.length) {
    extra.push("**已逾期：**");
    for (const r of overdue) {
      extra.push(`- ${r.content}（截止 ${r.dueDate?.toISOString().slice(0, 10)}）`);
    }
  }
  if (dueToday.length) {
    extra.push("**今日到期：**");
    for (const r of dueToday) {
      extra.push(`- ${r.content}`);
    }
  }
  return markdown + "\n" + extra.join("\n");
}
