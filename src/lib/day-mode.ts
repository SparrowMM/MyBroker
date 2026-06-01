/** 工作日 / 休息日判定，供复盘、顾问与推送隔离使用 */

import {
  isLifeContent,
  isWorkProjectName,
  type ParsedDailyRecord,
} from "@/lib/daily-record-structure";
import { analyzeDayMetrics, workTimeEntries } from "@/lib/broker-team";

export type DayMode = "work" | "rest";

const EXPLICIT_REST_RE =
  /休息日|休息一天|全天休息|调休|请假|生活日报|personal\s*day|off\s*day|不工作/i;
const EXPLICIT_WORK_RE = /工作日报|加班日|工作日报/;

const WORKISH_PENDING_RE =
  /农场|社媒|矩阵|项目|Agent|Master|换肤|动效|评审|周会|需求|TC|Deep Research|趋势洞察|交付|对焦|待确认|模版|文案/;

/** 指定日历日是否为周六或周日 */
export function isWeekendYmd(ymd: string): boolean {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
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
  merged.lifeLines = [...new Set(merged.lifeLines)];
  return merged;
}

function hasWorkProjects(parsed: ParsedDailyRecord): boolean {
  return parsed.projects.some(
    (p) => isWorkProjectName(p.name) || p.items.some((i) => !isLifeContent(i) && WORKISH_PENDING_RE.test(i)),
  );
}

function hasWorkishLines(lines: string[]): boolean {
  return lines.some((l) => !isLifeContent(l) && WORKISH_PENDING_RE.test(l));
}

/** 材料中是否出现可识别的工作信号 */
export function hasWorkSignals(parsed: ParsedDailyRecord, material: string): boolean {
  if (EXPLICIT_WORK_RE.test(material)) return true;
  if (parsed.sections.priorities.length > 0) return true;
  if (hasWorkProjects(parsed)) return true;
  if (workTimeEntries(analyzeDayMetrics(material).timeEntries).length > 0) return true;
  if (hasWorkishLines(parsed.sections.tomorrow)) return true;
  if (hasWorkishLines(parsed.sections.pending)) return true;
  if (hasWorkishLines(parsed.sections.risks)) return true;

  const workProgress = parsed.sections.progress.filter(
    (l) => !isLifeContent(l) && WORKISH_PENDING_RE.test(l),
  );
  return workProgress.length > 0;
}

/** 材料中是否有生活向记录 */
export function hasLifeSignals(parsed: ParsedDailyRecord, material: string): boolean {
  if (parsed.lifeLines.length > 0) return true;
  if (parsed.sections.progress.some((l) => isLifeContent(l))) return true;
  return /家庭|运动|健身|跑步|休息|放松|游戏|睡眠|孩子|带娃|打扫|清洁|陪伴/.test(material);
}

/**
 * 判定日历日模式：
 * - 显式「休息日/生活日报」→ rest
 * - 有工作信号 → work（含周末加班）
 * - 周末且无工作信号 → rest
 * - 工作日仅有生活记录 → rest
 * - 空记录：周末 rest，工作日 work（便于补记工作）
 */
export function classifyDayMode(
  ymd: string,
  parsedList: ParsedDailyRecord[],
  material: string,
): DayMode {
  const text = material.trim();
  const parsed = mergeParsedRecords(parsedList);

  if (EXPLICIT_REST_RE.test(text)) return "rest";
  if (hasWorkSignals(parsed, text)) return "work";
  if (isWeekendYmd(ymd)) return "rest";
  if (hasLifeSignals(parsed, text)) return "rest";
  if (!text) return isWeekendYmd(ymd) ? "rest" : "work";
  return "rest";
}

export function dayModeLabel(mode: DayMode): string {
  return mode === "rest" ? "休息日" : "工作日";
}
