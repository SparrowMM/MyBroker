import { describe, expect, it } from "vitest";
import {
  dedupeDailyReportText,
  flattenIndentedLines,
  formatParsedRecordForBroker,
  leafPathsOnly,
  parseDailyRecordMarkdown,
} from "./daily-record-structure";

const SAMPLE = `# 2026-05-21 日报

## 今日进展
- ✅ AE农场  
  - 把不清晰的内容对清晰  
  - 前端技术方案评审  
- ✅ 中午：享受一个人吃饭  
- ✅ 下午：社媒项目  
  - 对焦数据采集和归因  
  - 周会  
## 风险与阻塞
- 待补充

## 明日计划
- 待补充

## 待确认事项
- □ 趋势洞察模版  
  - □ 帮我校验下这个趋势洞察的数据结果
`;

const SAMPLE_WITH_PRIORITIES = `# 2026-05-23 工作日报

## 工作优先级
- 社媒项目 [重要紧急] P1
- AE 农场项目 [重点事情]
- 其他都不重要

## 今日进展
- AE 农场 30min
  - 松鼠换肤
    - 确认卡点逻辑@史振彪
- AE 社媒矩阵
  - 账号策略子agent 10min
`;

describe("parseDailyRecordMarkdown", () => {
  it("解析章节、项目分组与待确认", () => {
    const parsed = parseDailyRecordMarkdown(SAMPLE);
    expect(parsed.sections.progress.length).toBeGreaterThan(3);
    expect(parsed.projects.some((p) => /AE农场/.test(p.name))).toBe(true);
    const social = parsed.projects.find((p) => /社媒/.test(p.name));
    expect(social).toBeTruthy();
    expect(social!.items.some((x) => /周会/.test(x))).toBe(true);
    expect(parsed.sections.pending.some((x) => /趋势洞察/.test(x))).toBe(true);
    expect(parsed.lifeLines.some((x) => /吃饭/.test(x))).toBe(true);
    expect(parsed.sections.risks).toEqual([]);
    expect(parsed.sections.tomorrow).toEqual([]);
  });

  it("解析工作优先级且不含空章节占位", () => {
    const parsed = parseDailyRecordMarkdown(SAMPLE_WITH_PRIORITIES);
    expect(parsed.sections.priorities.some((x) => /社媒项目/.test(x) && /P1/.test(x))).toBe(true);
    expect(parsed.sections.priorities.some((x) => /重点事情|AE 农场项目/.test(x))).toBe(true);
    expect(parsed.sections.risks).toEqual([]);
    expect(parsed.sections.tomorrow).toEqual([]);
    expect(parsed.projects.some((p) => /AE 农场/.test(p.name))).toBe(true);
  });

  it("饮食与生活内容不进工作项目分组", () => {
    const parsed = parseDailyRecordMarkdown(`# 日报
## 今日进展
- ✅ 吃水煮牛肉
  - 约会见面
- ✅ AE 农场 30min
  - 松鼠换肤
- 孩子哭闹 2小时
`);
    expect(parsed.projects.some((p) => /水煮牛肉/.test(p.name))).toBe(false);
    expect(parsed.projects.some((p) => /农场/.test(p.name))).toBe(true);
    expect(parsed.lifeLines.some((x) => /水煮牛肉|哭闹/.test(x))).toBe(true);
  });

  it("formatParsedRecordForBroker 输出优先级且不填充待补充", () => {
    const parsed = parseDailyRecordMarkdown(SAMPLE_WITH_PRIORITIES);
    const block = formatParsedRecordForBroker(parsed, []);
    expect(block).toContain("工作优先级:");
    expect(block).toContain("社媒项目");
    expect(block).not.toContain("待补充");
    expect(block).not.toContain("记录中未写");
  });
});

describe("dedupeDailyReportText", () => {
  it("去掉重复粘贴的第二份日报", () => {
    const dup = SAMPLE + "\n" + SAMPLE;
    expect(dedupeDailyReportText(dup).match(/## 今日进展/g)?.length).toBe(1);
  });
});

describe("leafPathsOnly", () => {
  it("只保留最深层待确认", () => {
    const paths = ["A", "A → B", "A → B → C"];
    expect(leafPathsOnly(paths)).toEqual(["A → B → C"]);
  });
});

describe("flattenIndentedLines", () => {
  it("嵌套列表合并为路径", () => {
    const lines = ["- □ A", "  - □ B"];
    expect(flattenIndentedLines(lines).at(-1)).toBe("A → B");
  });
});
