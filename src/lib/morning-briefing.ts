import { prisma } from "@/lib/prisma";
import { decodeJsonList } from "@/lib/record-analyzer";
import { ymdToUtcMidnight } from "@/lib/parse-ymd";

function yesterdayYmd(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** 晨会简报：昨日纪要 + 本周未完成待办摘要（确定性拼装，不额外调用 LLM） */
export async function buildMorningBriefing() {
  const y = yesterdayYmd();
  const yStart = ymdToUtcMidnight(y);

  const yesterdayRecords = await prisma.dailyRecord.findMany({
    where: { recordDate: yStart },
    orderBy: { id: "asc" },
  });

  const yesterdaySummaries = yesterdayRecords.map((r) => ({
    id: r.id,
    date: y,
    summary: r.analysisSummary,
    tags: decodeJsonList(r.tagsJson),
  }));

  const openAll = await prisma.actionItem.findMany({
    where: { status: "todo" },
    take: 200,
  });
  const prank = (p: string) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
  openAll.sort(
    (a, b) =>
      prank(a.priority) - prank(b.priority) || a.sourceDate.getTime() - b.sourceDate.getTime(),
  );
  const highTodo = openAll.filter((i) => i.priority === "high").slice(0, 8);
  const restTodo = openAll.filter((i) => i.priority !== "high").slice(0, 12);

  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  weekAgo.setUTCHours(0, 0, 0, 0);

  const weeklyRecords = await prisma.dailyRecord.findMany({
    where: { recordDate: { gte: weekAgo } },
    orderBy: { recordDate: "desc" },
    take: 14,
  });

  const weekFocus = weeklyRecords.flatMap((r) => decodeJsonList(r.tagsJson));
  const tagCounts = new Map<string, number>();
  for (const t of weekFocus) {
    tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  return {
    generated_at: new Date().toISOString(),
    yesterday: {
      date: y,
      records: yesterdaySummaries,
      narrative:
        yesterdaySummaries.length === 0
          ? `${y} 尚无日报，建议优先补齐昨日记录。`
          : `昨日共 ${yesterdaySummaries.length} 条日报，摘要见各条 summary。`,
    },
    week_focus_tags: topTags,
    priority_todos: highTodo.map((i) => ({
      id: i.id,
      content: i.content,
      source_date: i.sourceDate.toISOString().slice(0, 10),
      priority: i.priority,
    })),
    other_open_todos: restTodo.map((i) => ({
      id: i.id,
      content: i.content,
      source_date: i.sourceDate.toISOString().slice(0, 10),
      priority: i.priority,
    })),
  };
}
