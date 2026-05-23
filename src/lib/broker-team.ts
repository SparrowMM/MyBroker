/** 经纪人团：专长顾问触发、用时/睡眠解析与本地回退文案 */

import type { ParsedDailyRecord } from "@/lib/daily-record-structure";

export type TeamMemberId = "career" | "recovery" | "parenting";

export type TeamMemberDef = {
  id: TeamMemberId;
  label: string;
  patterns: RegExp[];
};

export const TEAM_MEMBERS: TeamMemberDef[] = [
  {
    id: "career",
    label: "职业教练",
    patterns: [
      /对焦|会议|方案|Agent|Master|角色|周会|评审|项目|农场|社媒/,
      /待确认|明日|优先级|进展|交付|练手|打标/,
      /用时|耗时|时间效率|番茄|日程/,
    ],
  },
  {
    id: "recovery",
    label: "复原顾问",
    patterns: [
      /凌晨|失眠|睡眠|熬夜|疲惫|很累|累|看盘|游戏|刷手机/,
      /入睡|起床|合眼|深睡|浅睡|睡眠质量|收屏|作息/,
      /无力|焦虑|压力|放松|运动|健身|休息|独处/,
    ],
  },
  {
    id: "parenting",
    label: "育儿同伴",
    patterns: [/孩子|带娃|哭闹|育儿|母亲|宝宝|幼儿|幼儿园|哄睡/],
  },
];

/** 用户记录中的单项用时（分钟） */
export type TimeUsageEntry = {
  label: string;
  minutes: number;
  raw: string;
};

/** 睡眠相关摘录（支持后续补记） */
export type SleepSnapshot = {
  bedtime?: string;
  wake?: string;
  durationHours?: number;
  lines: string[];
};

export type DayMetrics = {
  timeEntries: TimeUsageEntry[];
  sleep: SleepSnapshot;
  totalWorkMinutes: number;
};

export type TeamMessage = {
  id: TeamMemberId;
  label: string;
  text: string;
};

export type TeamSignalScores = Record<TeamMemberId, number>;

const TIME_ON_LINE =
  /(\d+(?:\.\d+)?)\s*(?:h|小时|hr)(?:\s*(\d+)\s*(?:m|分|分钟))?|(\d+)\s*(?:min|minutes?|m|分钟|分)(?:钟)?|(\d+(?:\.\d+)?)h\b|(\d+)min\b|用时[：:\s]*(\d+)\s*(?:分钟|分)?/gi;

const MEETING_RANGE =
  /(\d{1,2})[：:](\d{2})\s*[-–—到至]\s*(\d{1,2})[：:](\d{2})/g;

const SLEEP_BED = /(?:入睡|睡觉|合眼)[：:\s]*(\d{1,2}[：:点]\d{0,2}|\d{1,2}\s*点(?:半)?)/i;
const SLEEP_WAKE = /(?:起床|醒来|醒)[：:\s]*(\d{1,2}[：:点]\d{0,2}|\d{1,2}\s*点(?:半)?)/i;
const SLEEP_DURATION = /(?:睡了|睡眠(?:时长)?)[：:\s]*(\d+(?:\.\d+)?)\s*(?:个)?小时/i;
const SLEEP_AT = /(\d{1,2})[：:](\d{2})\s*(?:入睡|睡下|合眼)/i;
const SLEEP_LATE = /(?:熬夜|凌晨)[到至\s]*(\d{1,2})\s*点|(\d{1,2})\s*点(?:才|方)?合眼/i;

const LIFE_TIME_EXCLUDE =
  /孩子|带娃|哭闹|育儿|教育|无助|水煮|牛肉|吃饭|用餐|见面|约会|游戏|看盘|泡面|学弟|情绪安抚|母亲|哄睡/;

const WORK_TIME_HINT =
  /农场|社媒|矩阵|项目|方案|评审|TC|Agent|Master|换肤|动效|周会|需求|加班|Deep Research|统计|技术/;

const FOCUS_HINT = /对焦|会议|周会|评审|对齐|沟通|同步|反馈/;
const OUTPUT_HINT = /交付|方案|产出|完成|评审通过|写完|定稿|实现|确认|逻辑/;

export function isWorkTimeEntry(entry: TimeUsageEntry): boolean {
  if (LIFE_TIME_EXCLUDE.test(entry.label)) return false;
  return WORK_TIME_HINT.test(entry.label) || WORK_TIME_HINT.test(entry.raw);
}

export function workTimeEntries(entries: TimeUsageEntry[]): TimeUsageEntry[] {
  return entries.filter(isWorkTimeEntry);
}

export function formatMinutes(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h}小时${r}分` : `${h}小时`;
  }
  return `${m}分钟`;
}

function lineLabel(line: string, matchRaw: string): string {
  const stripped = line
    .replace(/^[-*•✅□\s]+/, "")
    .replace(matchRaw, "")
    .replace(/\s+/g, " ")
    .trim();
  return (stripped || line.trim()).slice(0, 48);
}

function parseMinutesFromMatch(m: RegExpExecArray): number | null {
  if (m[1] != null) {
    const h = parseFloat(m[1]);
    const mins = m[2] ? parseInt(m[2], 10) : 0;
    return Math.round(h * 60 + mins);
  }
  if (m[3] != null) return parseInt(m[3], 10);
  if (m[4] != null) return Math.round(parseFloat(m[4]) * 60);
  if (m[5] != null) return parseInt(m[5], 10);
  if (m[6] != null) return parseInt(m[6], 10);
  return null;
}

/** 从日报原文提取带时长的条目 */
export function parseTimeUsageFromText(text: string): TimeUsageEntry[] {
  const entries: TimeUsageEntry[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.trim();
    if (!line || LIFE_TIME_EXCLUDE.test(line)) continue;

    let rangeM: RegExpExecArray | null;
    MEETING_RANGE.lastIndex = 0;
    while ((rangeM = MEETING_RANGE.exec(line)) !== null) {
      const start = parseInt(rangeM[1], 10) * 60 + parseInt(rangeM[2], 10);
      const end = parseInt(rangeM[3], 10) * 60 + parseInt(rangeM[4], 10);
      const minutes = end >= start ? end - start : end + 24 * 60 - start;
      const label = lineLabel(line, rangeM[0]);
      const key = `${label}:${minutes}`;
      if (!seen.has(key) && minutes > 0 && minutes < 24 * 60) {
        seen.add(key);
        entries.push({ label, minutes, raw: rangeM[0] });
      }
    }

    TIME_ON_LINE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TIME_ON_LINE.exec(line)) !== null) {
      const minutes = parseMinutesFromMatch(m);
      if (minutes == null || minutes <= 0 || minutes > 12 * 60) continue;
      const label = lineLabel(line, m[0]);
      const key = `${label}:${minutes}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ label, minutes, raw: m[0] });
    }
  }

  return entries.sort((a, b) => b.minutes - a.minutes);
}

/** 从日报提取睡眠相关字段（有则填，无则留空） */
export function parseSleepFromText(text: string): SleepSnapshot {
  const snap: SleepSnapshot = { lines: [] };
  const t = text.trim();
  if (!t) return snap;

  const bed = t.match(SLEEP_BED);
  if (bed) snap.bedtime = bed[1].replace(/\s+/g, "");

  const wake = t.match(SLEEP_WAKE);
  if (wake) snap.wake = wake[1].replace(/\s+/g, "");

  const dur = t.match(SLEEP_DURATION);
  if (dur) snap.durationHours = parseFloat(dur[1]);

  const at = t.match(SLEEP_AT);
  if (at && !snap.bedtime) snap.bedtime = `${at[1]}:${at[2]}`;

  const late = t.match(SLEEP_LATE);
  if (late && !snap.bedtime) {
    const hour = late[1] ?? late[2];
    if (hour) snap.bedtime = `${hour}点`;
  }

  for (const raw of t.split(/\n/)) {
    const line = raw.trim();
    if (/睡眠|入睡|起床|熬夜|失眠|合眼|深睡|作息/.test(line) && line.length < 120) {
      snap.lines.push(line.replace(/^[-*•✅□\s]+/, "").slice(0, 80));
    }
  }
  snap.lines = [...new Set(snap.lines)].slice(0, 5);

  return snap;
}

export function analyzeDayMetrics(text: string): DayMetrics {
  const timeEntries = parseTimeUsageFromText(text);
  const sleep = parseSleepFromText(text);
  const work = workTimeEntries(timeEntries);
  const totalWorkMinutes = work.reduce((s, e) => s + e.minutes, 0);
  return { timeEntries, sleep, totalWorkMinutes };
}

function sleepHasData(sleep: SleepSnapshot): boolean {
  return Boolean(
    sleep.bedtime || sleep.wake || sleep.durationHours != null || sleep.lines.length > 0,
  );
}

function scoreMember(text: string, member: TeamMemberDef): number {
  let n = 0;
  for (const re of member.patterns) {
    const m = text.match(new RegExp(re.source, "gi"));
    if (m) n += m.length;
  }
  return n;
}

export function scoreTeamSignals(text: string): TeamSignalScores {
  const t = text.trim();
  const metrics = analyzeDayMetrics(t);
  let career = scoreMember(t, TEAM_MEMBERS[0]);
  let recovery = scoreMember(t, TEAM_MEMBERS[1]);
  const parenting = scoreMember(t, TEAM_MEMBERS[2]);

  if (metrics.timeEntries.length >= 1) career += 2 + Math.min(metrics.timeEntries.length, 4);
  if (metrics.totalWorkMinutes >= 120) career += 1;
  if (sleepHasData(metrics.sleep)) recovery += 3;
  if (/凌晨|熬夜|失眠|三点|两点|一点半/.test(t)) recovery += 2;

  return { career, recovery, parenting };
}

/** 从材料中选出最多 max 位顾问（复原顾问与育儿同伴同日不并存） */
export function selectTeamMembers(text: string, max = 2): TeamMemberId[] {
  const scores = scoreTeamSignals(text);
  const metrics = analyzeDayMetrics(text);
  const ranked = (Object.keys(scores) as TeamMemberId[])
    .map((id) => ({ id, score: scores[id] }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return text.trim().length > 80 ? ["career"] : [];
  }

  const picked: TeamMemberId[] = [];
  for (const { id } of ranked) {
    if (picked.length >= max) break;
    if (id === "recovery" && picked.includes("parenting")) continue;
    if (id === "parenting" && picked.includes("recovery")) continue;
    picked.push(id);
  }

  if (metrics.timeEntries.length >= 1 && !picked.includes("career")) {
    if (picked.length >= max) picked.pop();
    picked.unshift("career");
  }
  if (sleepHasData(metrics.sleep) && !picked.includes("recovery") && !picked.includes("parenting")) {
    if (picked.length >= max) picked.pop();
    picked.push("recovery");
  }
  if (/睡眠|入睡|熬夜|失眠/.test(text) && !picked.includes("recovery") && !picked.includes("parenting")) {
    if (picked.length >= max) picked.pop();
    picked.push("recovery");
  }

  return picked.slice(0, max);
}

export function teamMemberById(id: TeamMemberId): TeamMemberDef {
  const m = TEAM_MEMBERS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown team member: ${id}`);
  return m;
}

function formatTimeExcerpt(metrics: DayMetrics): string {
  const work = workTimeEntries(metrics.timeEntries);
  if (!work.length) {
    return "- 用时摘录：（材料中未解析到工作向时长，职业教练可提醒明日记清每项用时）";
  }
  const lines = work.slice(0, 8).map((e) => {
    const kind = FOCUS_HINT.test(e.label)
      ? "偏对焦"
      : OUTPUT_HINT.test(e.label)
        ? "偏产出"
        : "待分类";
    return `  · ${e.label || "未命名"}：${formatMinutes(e.minutes)}（${kind}）`;
  });
  const total = formatMinutes(metrics.totalWorkMinutes);
  return `- 用时摘录（用户重视时间效率，职业教练须引用并粗分对焦/产出，合计约 ${total}）：\n${lines.join("\n")}`;
}

function formatSleepExcerpt(sleep: SleepSnapshot): string {
  if (!sleepHasData(sleep)) {
    return "- 睡眠摘录：（暂无；若用户日后补记入睡/起床/时长，复原顾问须据此给睡眠窗建议）";
  }
  const parts: string[] = [];
  if (sleep.bedtime) parts.push(`入睡 ${sleep.bedtime}`);
  if (sleep.wake) parts.push(`起床 ${sleep.wake}`);
  if (sleep.durationHours != null) parts.push(`时长约 ${sleep.durationHours} 小时`);
  for (const line of sleep.lines.slice(0, 3)) {
    if (!parts.some((p) => line.includes(p))) parts.push(line);
  }
  return `- 睡眠摘录（用户重视睡眠，复原顾问须据此给一条睡眠窗或收屏建议）：${parts.join("；")}`;
}

/** 写入 LLM 用户 prompt 的触发提示 */
export function formatTeamTriggerHints(text: string): string {
  const scores = scoreTeamSignals(text);
  const selected = selectTeamMembers(text);
  const metrics = analyzeDayMetrics(text);
  const lines: string[] = [
    "【顾问触发（团留言参考，勿编造未出现的事实）】",
    "【用户侧重】时间效率（记录含用时）+ 睡眠健康（现已或未来将记录睡眠）",
  ];
  for (const m of TEAM_MEMBERS) {
    const on = selected.includes(m.id);
    const score = scores[m.id];
    let extra = "";
    if (m.id === "career" && on) {
      extra = " → 须引用下方用时摘录，指出对焦是否偏多、明天守哪一段产出时间";
    }
    if (m.id === "recovery" && on) {
      extra = sleepHasData(metrics.sleep)
        ? " → 须引用下方睡眠摘录，给睡眠窗/收屏一条"
        : " → 材料缺睡眠数据时，温柔提醒补记入睡或起床时间";
    }
    lines.push(`- ${m.label}：${on ? "建议出镜" : "不出镜"}（信号 ${score}）${extra}`);
  }
  lines.push(
    `- 今日最多 ${selected.length} 位：${selected.map((id) => teamMemberById(id).label).join("、") || "无"}`,
  );
  lines.push(formatTimeExcerpt(metrics));
  lines.push(formatSleepExcerpt(metrics.sleep));
  return lines.join("\n");
}

export function formatTeamSectionMarkdown(messages: TeamMessage[]): string {
  if (!messages.length) return "";
  const lines = ["### 团留言", ""];
  for (const msg of messages) {
    lines.push(`- **${msg.label}**：${msg.text}`);
  }
  return lines.join("\n");
}

function splitFocusOutput(entries: TimeUsageEntry[]): {
  focusMin: number;
  outputMin: number;
  topFocus?: TimeUsageEntry;
  topOutput?: TimeUsageEntry;
} {
  let focusMin = 0;
  let outputMin = 0;
  let topFocus: TimeUsageEntry | undefined;
  let topOutput: TimeUsageEntry | undefined;

  for (const e of workTimeEntries(entries)) {
    if (FOCUS_HINT.test(e.label)) {
      focusMin += e.minutes;
      if (!topFocus || e.minutes > topFocus.minutes) topFocus = e;
    } else if (OUTPUT_HINT.test(e.label)) {
      outputMin += e.minutes;
      if (!topOutput || e.minutes > topOutput.minutes) topOutput = e;
    }
  }
  return { focusMin, outputMin, topFocus, topOutput };
}

/** 本地回退：各顾问一句人话 + 可执行小动作 */
export function buildFallbackTeamMessages(
  materialText: string,
  parsed: ParsedDailyRecord,
): TeamMessage[] {
  const ids = selectTeamMembers(materialText);
  const metrics = analyzeDayMetrics(materialText);
  const msgs: TeamMessage[] = [];
  const pending = parsed.sections.pending[0]?.slice(0, 40);
  const tomorrow = parsed.sections.tomorrow[0]?.slice(0, 40);
  const workTimes = workTimeEntries(metrics.timeEntries);
  const { focusMin, outputMin, topFocus, topOutput } = splitFocusOutput(workTimes);

  for (const id of ids) {
    const { label } = teamMemberById(id);
    if (id === "career") {
      if (workTimes.length >= 2) {
        const ratio =
          focusMin + outputMin > 0
            ? `对焦约 ${formatMinutes(focusMin)}、产出约 ${formatMinutes(outputMin)}`
            : `今日工作向合计约 ${formatMinutes(metrics.totalWorkMinutes)}`;
        const defend = topOutput
          ? `明天守 ${formatMinutes(Math.max(30, topOutput.minutes))} 给「${topOutput.label.slice(0, 20)}」`
          : tomorrow || pending
            ? `明天先动「${(tomorrow || pending)!.slice(0, 24)}」`
            : "明天上午留 45 分钟只做一件可交付的小事";
        const warn =
          focusMin > outputMin && focusMin >= 60 && topFocus
            ? `「${topFocus.label.slice(0, 20)}」类对焦偏多，`
            : "";
        msgs.push({
          id,
          label,
          text: `${warn}${ratio}。${defend}，别再把整块时间耗在纯对焦上。`,
        });
      } else {
        const anchor =
          metrics.timeEntries[0]?.label ||
          parsed.projects[0]?.name?.slice(0, 24) ||
          "今日主线";
        const next =
          tomorrow || pending
            ? `明天先动「${(tomorrow || pending)!.slice(0, 28)}」`
            : "每项事记下开始与结束时间，睡前看一眼对焦/产出比例";
        msgs.push({
          id,
          label,
          text: `「${anchor}」里分清对焦与产出；${next}。`,
        });
      }
    } else if (id === "recovery") {
      if (metrics.sleep.bedtime || metrics.sleep.durationHours != null) {
        const bed = metrics.sleep.bedtime?.replace(/^约/, "") ?? "";
        const fact = [
          bed && `昨晚约 ${bed} 入睡`,
          metrics.sleep.durationHours != null &&
            `时长约 ${metrics.sleep.durationHours} 小时`,
        ]
          .filter(Boolean)
          .join("，");
        msgs.push({
          id,
          label,
          text: `${fact}。明晚试着提前 30 分钟收屏；若连续缺觉，先把午睡或早睡一天当任务，不算偷懒。`,
        });
      } else if (/凌晨|熬夜|失眠|三点|两点|一点半/.test(materialText)) {
        msgs.push({
          id,
          label,
          text: "恢复力也是生产力。今晚比昨天早 30 分钟收屏；明早补记入床/起床时间，复盘才能帮你对睡眠窗。",
        });
      } else {
        msgs.push({
          id,
          label,
          text: "你重视睡眠——今晚记一句「几点躺下、几点起」，明天复原顾问才能对准你的睡眠窗，而不是空泛劝早睡。",
        });
      }
    } else if (id === "parenting") {
      msgs.push({
        id,
        label,
        text:
          "带娃后的无力感值得被看见：今晚不必再苛责自己。明天若再遇情绪高峰，提前 10 分钟降低刺激（少一项屏幕、多一口水），就够。",
      });
    }
  }
  return msgs;
}

/** 合并当日全部记录文本，供触发与回退使用 */
export function joinRecordMaterial(
  recordBlocks: string[],
  extra?: string,
): string {
  return [...recordBlocks, extra ?? ""].filter(Boolean).join("\n");
}
