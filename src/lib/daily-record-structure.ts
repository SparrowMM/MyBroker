/** 从日报 Markdown 中解析章节与列表项，供复盘与本地回退使用 */

export type DailyRecordSections = {
  priorities: string[];
  progress: string[];
  risks: string[];
  tomorrow: string[];
  pending: string[];
};

export type DailyRecordProject = {
  name: string;
  items: string[];
};

export type ParsedDailyRecord = {
  sections: DailyRecordSections;
  projects: DailyRecordProject[];
  lifeLines: string[];
};

const SECTION_KEYS: { key: keyof DailyRecordSections; patterns: RegExp[] }[] = [
  {
    key: "priorities",
    patterns: [/工作优先级/, /当前工作打标/, /工作打标/],
  },
  { key: "progress", patterns: [/今日进展/, /今天进展/, /今日完成/, /每日输出/] },
  { key: "risks", patterns: [/风险/, /阻塞/, /卡点/] },
  { key: "tomorrow", patterns: [/明日计划/, /明天计划/, /下一步计划/] },
  { key: "pending", patterns: [/待确认/, /待办/, /待处理/] },
];

const LIFE_HINT = /吃饭|用餐|休息|运动|健身|睡眠|家庭|散步|独处|生活|放松/;
const TIME_SLOT_RE = /^(上午|中午|下午|晚上)[：:]/;

/** 去掉粘贴重复导致的第二份同款日报 */
export function dedupeDailyReportText(text: string): string {
  const trimmed = text.trim();
  const headerMatch = trimmed.match(/^(#\s*.+日报\s*\n)/m);
  if (!headerMatch) return trimmed;
  const header = headerMatch[1];
  const secondIdx = trimmed.indexOf(header, header.length);
  if (secondIdx > 0) return trimmed.slice(0, secondIdx).trim();
  return trimmed;
}

function isLifeProgressLine(text: string): boolean {
  const clean = stripDecorators(text);
  return LIFE_HINT.test(clean) || TIME_SLOT_RE.test(clean) && LIFE_HINT.test(clean);
}

function isProjectHeader(indent: number, content: string): boolean {
  if (indent > 2) return false;
  const clean = stripDecorators(content);
  if (TIME_SLOT_RE.test(clean) && LIFE_HINT.test(clean)) return false;
  if (TIME_SLOT_RE.test(clean) && /项目|农场|互动|周会/.test(clean)) return true;
  if (/农场|项目|互动/.test(clean)) return true;
  if (/✅/.test(clean) && indent <= 2) return true;
  if (/周会$/.test(clean) && clean.length <= 10 && indent === 0) return true;
  return false;
}

/** 待确认列表只保留最深层路径，避免父节点重复 */
export function leafPathsOnly(paths: string[]): string[] {
  const sorted = [...paths].sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (const p of sorted) {
    if (kept.some((k) => k.startsWith(`${p} → `))) continue;
    kept.push(p);
  }
  return kept.sort();
}

const BULLET_RE =
  /^\s*(?:[-*•]|\d+[.)])\s*(?:\[[\sxX✅□☐]?\]\s*)?(?:□\s*)?(?:✅\s*)?(.+?)\s*$/;
const CHECKBOX_ONLY_RE = /^\s*□\s*(.+?)\s*$/;

function normalizeHeader(line: string): string {
  return line.replace(/^#+\s*/, "").replace(/\s+/g, "").trim();
}

function matchSectionKey(header: string): keyof DailyRecordSections | null {
  const h = normalizeHeader(header);
  for (const { key, patterns } of SECTION_KEYS) {
    if (patterns.some((p) => p.test(h))) return key;
  }
  return null;
}

function stripDecorators(text: string): string {
  return text
    .replace(/^#+\s*/, "")
    .replace(/^\s*[-*•]\s*/, "")
    .replace(/^\s*□\s*/, "")
    .replace(/^\s*✅\s*/, "")
    .trim();
}

function parseIndent(line: string): { indent: number; content: string } | null {
  const bullet = line.match(BULLET_RE);
  if (bullet) {
    const leading = line.match(/^(\s*)/)?.[1] ?? "";
    return { indent: leading.replace(/\t/g, "  ").length, content: bullet[1].trim() };
  }
  const box = line.match(CHECKBOX_ONLY_RE);
  if (box) {
    const leading = line.match(/^(\s*)/)?.[1] ?? "";
    return { indent: leading.replace(/\t/g, "  ").length, content: box[1].trim() };
  }
  return null;
}

/** 将带缩进的列表行收成「父 / 子」路径或顶层条目 */
export function flattenIndentedLines(lines: string[]): string[] {
  const stack: { indent: number; text: string }[] = [];
  const out: string[] = [];

  for (const raw of lines) {
    const parsed = parseIndent(raw);
    if (!parsed || !parsed.content) continue;
    const { indent, content } = parsed;
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const path = [...stack.map((s) => s.text), content].filter(Boolean);
    out.push(path.join(" → "));
    stack.push({ indent, text: content });
  }
  return out;
}

function splitBySections(text: string): Partial<Record<keyof DailyRecordSections, string[]>> {
  const lines = text.split(/\n/);
  const buckets: Partial<Record<keyof DailyRecordSections, string[]>> = {};
  let current: keyof DailyRecordSections | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (headerMatch) {
      const key = matchSectionKey(headerMatch[1]);
      current = key;
      if (key && !buckets[key]) buckets[key] = [];
      continue;
    }
    if (!current) continue;
    if (!buckets[current]) buckets[current] = [];
    buckets[current]!.push(line);
  }

  return buckets;
}

function groupProgressProjects(progressLines: string[]): DailyRecordProject[] {
  const projects: DailyRecordProject[] = [];
  let current: DailyRecordProject | null = null;

  for (const raw of progressLines) {
    const parsed = parseIndent(raw);
    if (!parsed?.content) continue;
    const { indent, content } = parsed;
    const clean = stripDecorators(content);

    if (isLifeProgressLine(clean)) continue;

    if (isProjectHeader(indent, content)) {
      let name = clean.replace(/^✅\s*/, "").trim();
      const slot = name.match(TIME_SLOT_RE);
      if (slot?.[1]) {
        const period = slot[1];
        const core = name.replace(TIME_SLOT_RE, "").trim();
        name = core ? `${core}（${period}）` : period;
      }
      current = { name, items: [] };
      projects.push(current);
      continue;
    }

    if (current) {
      current.items.push(clean);
    } else {
      current = { name: clean, items: [] };
      projects.push(current);
    }
  }

  return projects.filter((p) => p.name || p.items.length);
}

export function parseDailyRecordMarkdown(text: string): ParsedDailyRecord {
  const buckets = splitBySections(dedupeDailyReportText(text));
  const progressRaw = buckets.progress ?? [];
  const sections: DailyRecordSections = {
    priorities: flattenIndentedLines(buckets.priorities ?? []).filter((x) => !/^待补充$/i.test(x)),
    progress: flattenIndentedLines(progressRaw),
    risks: flattenIndentedLines(buckets.risks ?? []).filter((x) => !/^待补充$/i.test(x)),
    tomorrow: flattenIndentedLines(buckets.tomorrow ?? []).filter((x) => !/^待补充$/i.test(x)),
    pending: leafPathsOnly(flattenIndentedLines(buckets.pending ?? [])),
  };

  const projects = groupProgressProjects(progressRaw);
  const lifeLines = sections.progress.filter((line) => LIFE_HINT.test(line));

  return { sections, projects, lifeLines };
}

/** 格式化为经纪人 prompt / 回退文案用的上下文块 */
export function formatParsedRecordForBroker(parsed: ParsedDailyRecord, tags: string[]): string {
  const lines: string[] = [];
  if (tags.length) lines.push(`标签: ${tags.join("、")}`);

  if (parsed.sections.priorities.length) {
    lines.push("工作优先级:");
    for (const x of parsed.sections.priorities.slice(0, 16)) {
      lines.push(`- ${x}`);
    }
  }

  if (parsed.projects.length) {
    lines.push("按项目:");
    for (const p of parsed.projects) {
      lines.push(`- ${p.name}`);
      for (const item of p.items.slice(0, 12)) {
        lines.push(`  · ${item}`);
      }
    }
  } else if (parsed.sections.progress.length) {
    lines.push("今日进展:");
    for (const x of parsed.sections.progress.slice(0, 20)) {
      lines.push(`- ${x}`);
    }
  }

  if (parsed.sections.risks.length) {
    lines.push("风险与阻塞:");
    for (const x of parsed.sections.risks) lines.push(`- ${x}`);
  }

  if (parsed.sections.tomorrow.length) {
    lines.push("明日计划:");
    for (const x of parsed.sections.tomorrow) lines.push(`- ${x}`);
  }

  if (parsed.sections.pending.length) {
    lines.push("待确认/待办:");
    for (const x of parsed.sections.pending) lines.push(`- ${x}`);
  }

  if (parsed.lifeLines.length) {
    lines.push("生活相关:");
    for (const x of parsed.lifeLines) lines.push(`- ${x}`);
  }

  return lines.join("\n");
}
