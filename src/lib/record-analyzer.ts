import { summarizePeriod as llmSummarizePeriod, summarizeText } from "@/lib/bailian-client";

const TAG_KEYWORDS: Record<string, string[]> = {
  客户沟通: ["客户", "沟通", "电话", "会议", "跟进"],
  合同法务: ["合同", "法务", "条款", "签约"],
  商务推进: ["报价", "商务", "方案", "对接"],
  内容输出: ["文案", "发布", "内容", "宣传"],
  数据分析: ["分析", "数据", "报表", "复盘"],
  项目管理: ["项目", "排期", "里程碑", "任务"],
};

export function decodeJsonList(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  for (const [tag, words] of Object.entries(TAG_KEYWORDS)) {
    if (words.some((w) => text.includes(w))) {
      tags.push(tag);
    }
  }
  return tags.length ? tags : ["日常执行"];
}

export async function analyzeDaily(
  recordDate: Date,
  rawText: string,
  chatText: string,
  screenshotNotes: string,
): Promise<{ summary: string; tags: string[] }> {
  const merged = [rawText.trim(), chatText.trim(), screenshotNotes.trim()].filter(Boolean).join("\n").trim();
  const tags = extractTags(merged);

  const prompt = `请分析经纪人工作记录，输出一句中文总结。日期: ${recordDate.toISOString().slice(0, 10)}\n记录内容:\n${merged}\n要求: 聚焦结果、风险与下一步。`;
  const llmSummary = await summarizeText(prompt);
  if (llmSummary) {
    return { summary: llmSummary.trim(), tags };
  }

  const textLen = merged.length;
  const focus = tags.slice(0, 3).join("、");
  const summary = `${recordDate.toISOString().slice(0, 10)} 主要围绕 ${focus} 开展工作，已沉淀 ${textLen} 字记录。建议明日优先处理高优先级客户跟进与关键事项闭环。`;
  return { summary, tags };
}

function topTagsFromLists(tagsList: string[][]): string[] {
  const counts = new Map<string, number>();
  for (const tags of tagsList) {
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
}

export async function summarizePeriodBlock(
  summaries: string[],
  tagsList: string[][],
  periodLabel: string,
): Promise<{ summary: string; highlights: string[]; risks: string[]; suggestions: string[] }> {
  if (!summaries.length) {
    return {
      summary: `${periodLabel}暂无有效记录。`,
      highlights: ["尽快补充每日工作记录"],
      risks: ["数据缺失导致判断偏差"],
      suggestions: ["建立固定时间的日终填报习惯"],
    };
  }

  const topTags = topTagsFromLists(tagsList);
  const highlights = [
    `核心工作重心：${topTags.join("、")}`,
    `累计记录天数：${summaries.length} 天`,
  ];
  const risks = ["部分工作产出缺少量化结果", "截图与对话可能存在信息碎片化"];
  const suggestions = [
    "每条记录补充结果指标（金额、进度、状态）",
    "按周复盘未完成事项并设置截止时间",
  ];

  const combined = summaries.slice(0, 10).join(" ");
  let summary = `${periodLabel}整体执行方向集中在${topTags.join("、")}。${combined.slice(0, 160)}...`;
  const llmSummary = await llmSummarizePeriod(periodLabel, summaries, topTags);
  if (llmSummary) {
    summary = llmSummary.trim();
  }

  return { summary, highlights, risks, suggestions };
}
