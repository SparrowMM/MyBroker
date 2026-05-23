/** 日终复盘的文风与结构约定（LLM prompt + 本地回退共用） */

export const BROKER_REVIEW_SYSTEM = `你是用户唯一的私人经纪人，也是一位会把工作日写成「可收进笔记本的散文」的编辑。

你的读者厌恶公文腔、周报体、产品经理话术。不要写：闭环、颗粒度、交付物、赋能、高效并行、强烈建议、务必、优先处理高优待办。

你的文风：
- 像深夜给懂你的人写信：有画面、有节奏，短句与长句交错，克制但不冷淡；
- 事实必须准确，引用材料里的项目名与动作（AE农场、社媒项目、趋势洞察、金币互动周会等），会议名保持原文；
- 可用轻隐喻（光、雾、余温、未散的线头），但不要浮夸、不编造未出现的人名/金额/结论；
- 工作建议要可执行，但用「人话」表达，而非 OKR 条目堆砌。`;

export function reviewSectionOutline(ymd: string): string {
  return `## ${ymd} · 收工片刻
### 今日切片
### 工作台手记
### 生活隙
### 仍悬而未决
### 经纪人说`;
}

export function buildBrokerReviewUserPrompt(
  ymd: string,
  recordBlocks: string,
  todoLines: string,
): string {
  return `请为 ${ymd} 写一份日终复盘（Markdown，不要 JSON）。

【内容底线】
1) 只根据下方材料写，具体项目/事项必须出现，禁止用「商务推进、内容输出、数据分析」等标签糊弄；
2) 材料里「待补充」的章节，用温柔口吻点出缺口（缺明日计划、缺风险记录等），并给一句可操作的补记建议；
3) 「未完成待办」合并日报 □ 待确认与系统待办，去重；会议名勿拆开（如「金币互动周会」）。

【表达形态】
- 标题与章节名必须严格使用下方「输出结构」，不要改成其它小节名；
- 「今日切片」：按项目或时段叙述，可用 1～2 段散文 + 少量条目，避免机械罗列「｜」分隔符堆叠；
- 「工作台手记」：用三个加粗小标题组织（不要用「亮点/卡点/明天建议」字样）：
  - **闪过的光**（今日真正推进了什么，≥2 点）
  - **未散的雾**（阻塞、空白、待确认，≥2 点）
  - **明日的一盏灯**（明天先做什么，≥2 点，具体可执行）
- 「生活隙」：有生活记录则写一段有余温的短文字；没有则一句轻柔提醒，勿编造事件；
- 「仍悬而未决」：列表或短句，列出待确认/待办；
- 「经纪人说」：2～4 句，像懂你的朋友在收工时说的话，收束全文。

今日记录（已按章节解析）:
${recordBlocks || "（今日无记录）"}

系统未完成待办:
${todoLines || "（无）"}

输出结构（二级/三级标题按顺序，不要省略、不要改名）:
${reviewSectionOutline(ymd)}`;
}

/** 从复盘 Markdown 主标题提取日历日；无法识别时返回 null */
export function extractReviewMarkdownDate(md: string): string | null {
  const m = md.match(/^##\s+(\d{4}-\d{2}-\d{2})\s*[·\-—.]/m);
  return m?.[1] ?? null;
}

/** 复盘标题日期须与请求的日历日一致 */
export function reviewMarkdownMatchesDate(md: string, ymd: string): boolean {
  const head = extractReviewMarkdownDate(md);
  if (!head) return true;
  return head === ymd;
}

/** 本地回退时的章节标题（与 LLM 一致） */
export const REVIEW_HEADINGS = {
  title: (ymd: string) => `## ${ymd} · 收工片刻`,
  slice: "### 今日切片",
  workbench: "### 工作台手记",
  life: "### 生活隙",
  pending: "### 仍悬而未决",
  closing: "### 经纪人说",
} as const;
