/** 模型未响应时的日终复盘本地生成（保留细节、区分工作/生活） */

import type { ParsedDailyRecord, DailyRecordProject } from "@/lib/daily-record-structure";
import { isLifeContent, isWorkProjectName } from "@/lib/daily-record-structure";
import {
  analyzeDayMetrics,
  buildFallbackTeamMessages,
  formatTeamSectionMarkdown,
  formatMinutes,
  workTimeEntries,
  type DayMetrics,
} from "@/lib/broker-team";
import { REVIEW_HEADINGS } from "@/lib/broker-review-voice";

export type FallbackReviewContext = {
  records: { length: number };
  recordBlocks: string[];
  todoLines: string[];
  openTodos: { content: string }[];
  parsedRecords: ParsedDailyRecord[];
};

function workProjects(parsed: ParsedDailyRecord): DailyRecordProject[] {
  return parsed.projects.filter(
    (p) => isWorkProjectName(p.name) || p.items.some((i) => !isLifeContent(i)),
  );
}

function collectLifeSnippets(material: string, parsed: ParsedDailyRecord): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.replace(/^[-*•✅□\s]+/, "").trim();
    if (t.length > 4 && !out.includes(t)) out.push(t.slice(0, 100));
  };
  for (const x of parsed.lifeLines) push(x);
  for (const line of material.split(/\n/)) {
    if (isLifeContent(line)) push(line);
  }
  return out.slice(0, 6);
}

function buildSliceParagraphs(
  projects: DailyRecordProject[],
  material: string,
  metrics: DayMetrics,
): string[] {
  const paras: string[] = [];

  const slotOrder = ["上午", "中午", "下午", "晚上"];
  for (const slot of slotOrder) {
    const chunk = material.match(new RegExp(`${slot}[^\\n]{8,200}`, "m"));
    if (chunk && /农场|社媒|矩阵|工作|周会|评审|对焦/.test(chunk[0])) {
      paras.push(chunk[0].replace(/\s+/g, " ").trim().slice(0, 220));
    }
  }

  for (const p of projects) {
    const name = p.name.replace(/\*\*/g, "").trim();
    if (!isWorkProjectName(name) && !p.items.some((i) => /农场|社媒|矩阵|评审|换肤|动效/.test(i))) {
      continue;
    }
    const items = p.items.filter((i) => !isLifeContent(i)).slice(0, 6);
    if (!items.length && !name) continue;
    const body = items.length ? items.join("；") : "有进展记录";
    paras.push(`**${name}**：${body}${items.length > 6 ? "…" : ""}`);
  }

  if (!paras.length) {
    const workLines = material
      .split(/\n/)
      .filter((l) => /农场|社媒|矩阵|min|分钟|小时|周会/.test(l) && !isLifeContent(l))
      .slice(0, 10);
    if (workLines.length) paras.push(workLines.join("\n"));
  }

  if (metrics.timeEntries.length && paras.length < 2) {
    const brief = workTimeEntries(metrics.timeEntries)
      .slice(0, 5)
      .map((e) => `${e.label} ${formatMinutes(e.minutes)}`)
      .join("、");
    if (brief) paras.push(`今日用时脉络：${brief}。`);
  }

  return paras;
}

function buildLights(
  projects: DailyRecordProject[],
  metrics: DayMetrics,
): string[] {
  const lights: string[] = [];
  const workTimes = workTimeEntries(metrics.timeEntries);

  for (const e of workTimes.slice(0, 3)) {
    lights.push(`**${e.label.slice(0, 36)}** 记下 ${formatMinutes(e.minutes)}，时间账本清楚。`);
  }

  for (const p of projects) {
    const wins = p.items.filter(
      (i) => /完成|评审|定稿|通过|拉回|对齐|推进/.test(i) && !isLifeContent(i),
    );
    if (wins.length) {
      lights.push(
        `**${p.name.replace(/\*\*/g, "").slice(0, 24)}**：${wins.slice(0, 2).join("；")}。`,
      );
    }
  }

  if (!lights.length && projects.length) {
    lights.push(`**${projects[0].name.replace(/\*\*/g, "").slice(0, 28)}** 在今日留了痕迹。`);
  }

  return [...new Set(lights)].slice(0, 5);
}

function buildMists(parsed: ParsedDailyRecord): string[] {
  const mists: string[] = [
    ...parsed.sections.risks.filter((x) => !/^待补充$/i.test(x)),
  ];
  if (!parsed.sections.tomorrow.length) {
    mists.push("明日计划还是空白，夜里少了一盏指向明天的灯。");
  }
  if (parsed.sections.pending.length) {
    mists.push(
      `${parsed.sections.pending.length} 件事仍停在「待确认」：${parsed.sections.pending[0].slice(0, 48)}…`,
    );
  }
  return mists;
}

export function buildFallbackReviewMarkdown(
  ymd: string,
  parsed: ParsedDailyRecord,
  material: string,
  ctx: FallbackReviewContext,
): string {
  const lines: string[] = [];
  const projects = workProjects(parsed);
  const metrics = analyzeDayMetrics(material);
  const hasContent =
    parsed.sections.progress.length > 0 || projects.length > 0 || parsed.sections.pending.length > 0;

  lines.push(REVIEW_HEADINGS.title(ymd));
  lines.push("");
  lines.push("> 笔调来自本地整理（模型未响应），事实仍取自你的日报。");
  lines.push("");
  lines.push(REVIEW_HEADINGS.slice);

  if (!ctx.records.length) {
    lines.push("页面上还空着。随便写两三句，夜里复盘才有温度。");
  } else {
    const paras = buildSliceParagraphs(projects, material, metrics);
    lines.push(paras.length ? paras.join("\n\n") : "今日记录已收到，补全时段后重新生成可更细。");
  }

  lines.push("");
  lines.push(REVIEW_HEADINGS.workbench);

  const lights = buildLights(projects, metrics);
  lines.push("- **闪过的光**");
  for (const x of (lights.length ? lights : ["材料尚薄，等你补几笔具体动作"]).slice(0, 5)) {
    lines.push(`  - ${x}`);
  }

  const mists = buildMists(parsed);
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
  const lifeSnippets = collectLifeSnippets(material, parsed);
  if (lifeSnippets.length) {
    lines.push(lifeSnippets.join("；") + "。");
    lines.push("这些时刻和会议、交付一样，值得被写进一天的账本。");
  } else if (hasContent) {
    lines.push("今天几乎全是工作台的声音；明天若能留半小时给自己，会轻松很多。");
  } else {
    lines.push("记录里没写到生活——若今天其实很累，也值得被看见。");
  }

  lines.push("");
  lines.push(REVIEW_HEADINGS.pending);
  const pendingFromRecord = parsed.sections.pending;
  if (pendingFromRecord.length) {
    for (const x of pendingFromRecord) lines.push(`- ${x}`);
  }
  if (ctx.openTodos.length) {
    for (const t of ctx.openTodos.slice(0, 8)) lines.push(`- ${t.content}`);
  }
  if (!pendingFromRecord.length && !ctx.openTodos.length) {
    lines.push("- 暂无悬而未决；若心里有数，可写在日报「待确认事项」。");
  }

  const teamMsgs = buildFallbackTeamMessages(material, parsed);
  const teamMd = formatTeamSectionMarkdown(teamMsgs);
  lines.push("");
  lines.push(teamMd || `${REVIEW_HEADINGS.team}\n今日顾问未出镜，首席已收束。`);

  lines.push("");
  lines.push(REVIEW_HEADINGS.closing);
  const topPending = parsed.sections.pending[0];
  const topProject = projects[0]?.name.replace(/\*\*/g, "");
  if (topPending) {
    lines.push(
      `今天铺开的线头不少。明天不必全收，先把「${topPending.slice(0, 36)}」这一节拉直，其它的会跟上来。`,
    );
  } else if (topProject) {
    lines.push(
      `${topProject} 已有实感进展。睡前补两行明日计划，明天的你会少一分茫然。`,
    );
  } else if (ctx.records.length) {
    lines.push("骨架已在。若已配置模型 Key，可点重新生成换一版 AI 夜谈；否则本地整理会尽量保留你写的细节。");
  } else {
    lines.push("空白的一天很难替你点灯。明天随手记一两句就好。");
  }

  return lines.join("\n");
}
