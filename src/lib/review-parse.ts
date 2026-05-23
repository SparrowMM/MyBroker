/** 将复盘 Markdown 解析为结构化章节（兼容新旧标题） */

export type WorkbenchLanes = {
  light: string[];
  fog: string[];
  lamp: string[];
};

export type ParsedReviewSection = {
  key: string;
  title: string;
  kind: "slice" | "workbench" | "life" | "pending" | "closing" | "other";
  body: string;
  paragraphs: string[];
  bullets: string[];
  workbench?: WorkbenchLanes;
};

export type ParsedReview = {
  docTitle: string;
  quote?: string;
  sections: ParsedReviewSection[];
  raw: string;
};

const SECTION_KIND: { match: RegExp; kind: ParsedReviewSection["kind"]; title: string }[] = [
  { match: /今日切片|今天做了什么/, kind: "slice", title: "今日切片" },
  { match: /工作台手记|^工作$/, kind: "workbench", title: "工作台手记" },
  { match: /生活隙|^生活$/, kind: "life", title: "生活隙" },
  { match: /仍悬而未决|未完成待办/, kind: "pending", title: "仍悬而未决" },
  { match: /经纪人说|经纪人寄语/, kind: "closing", title: "经纪人说" },
];

const WORKBENCH_LABELS: { re: RegExp; lane: keyof WorkbenchLanes; label: string }[] = [
  { re: /闪过的光|亮点/, lane: "light", label: "闪过的光" },
  { re: /未散的雾|卡点/, lane: "fog", label: "未散的雾" },
  { re: /明日的一盏灯|明天建议/, lane: "lamp", label: "明日的一盏灯" },
];

function classifySection(heading: string): ParsedReviewSection["kind"] {
  for (const row of SECTION_KIND) {
    if (row.match.test(heading)) return row.kind;
  }
  return "other";
}

function displayTitle(heading: string, kind: ParsedReviewSection["kind"]): string {
  const row = SECTION_KIND.find((r) => r.kind === kind);
  return row?.title ?? heading;
}

function splitParagraphsAndBullets(body: string): { paragraphs: string[]; bullets: string[] } {
  const paragraphs: string[] = [];
  const bullets: string[] = [];
  let paraBuf: string[] = [];

  const flushPara = () => {
    const p = paraBuf.join("\n").trim();
    if (p) paragraphs.push(p);
    paraBuf = [];
  };

  for (const raw of body.split(/\n/)) {
    const t = raw.trim();
    if (!t) {
      flushPara();
      continue;
    }
    if (/^[-*•]\s+/.test(t) || /^□\s+/.test(t)) {
      flushPara();
      bullets.push(t.replace(/^[-*•]\s+/, "").replace(/^□\s+/, "□ ").trim());
      continue;
    }
    if (/^\*\*.+\*\*$/.test(t)) {
      flushPara();
      continue;
    }
    paraBuf.push(t);
  }
  flushPara();
  return { paragraphs, bullets };
}

function parseWorkbench(body: string): WorkbenchLanes {
  const lanes: WorkbenchLanes = { light: [], fog: [], lamp: [] };
  let current: keyof WorkbenchLanes | null = null;

  for (const raw of body.split(/\n/)) {
    const t = raw.trim();
    if (!t) continue;
    const labelHit = WORKBENCH_LABELS.find((x) => {
      const m = t.match(/^\*\*(.+?)\*\*/);
      return m && x.re.test(m[1]);
    });
    if (labelHit) {
      current = labelHit.lane;
      const rest = t.replace(/^\*\*.+?\*\*/, "").replace(/^[：:\s]+/, "").trim();
      if (rest) lanes[current].push(rest);
      continue;
    }
    if (/^[-*•]\s+/.test(t) && current) {
      lanes[current].push(t.replace(/^[-*•]\s+/, "").trim());
      continue;
    }
    if (!current) {
      lanes.light.push(t);
    }
  }
  return lanes;
}

export function parseReviewDocument(md: string): ParsedReview {
  const raw = md.trim();
  let docTitle = "日终复盘";
  let quote: string | undefined;
  const sectionBodies: { heading: string; lines: string[] }[] = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  const flushSection = () => {
    if (currentHeading) {
      sectionBodies.push({ heading: currentHeading, lines: [...currentLines] });
    }
    currentLines = [];
  };

  for (const line of raw.split(/\n/)) {
    const t = line.trim();
    if (t.startsWith("## ")) {
      flushSection();
      currentHeading = "";
      docTitle = t.slice(3).trim();
      continue;
    }
    if (t.startsWith("### ")) {
      flushSection();
      currentHeading = t.slice(4).trim();
      continue;
    }
    if (t.startsWith("> ")) {
      quote = t.slice(2).trim();
      continue;
    }
    if (currentHeading) {
      currentLines.push(line);
    }
  }
  flushSection();

  const sections: ParsedReviewSection[] = sectionBodies.map(({ heading, lines }) => {
    const body = lines.join("\n").trim();
    const kind = classifySection(heading);
    const { paragraphs, bullets } = splitParagraphsAndBullets(body);
    const sec: ParsedReviewSection = {
      key: heading,
      title: displayTitle(heading, kind),
      kind,
      body,
      paragraphs,
      bullets,
    };
    if (kind === "workbench") {
      sec.workbench = parseWorkbench(body);
    }
    return sec;
  });

  return { docTitle, quote, sections, raw };
}
