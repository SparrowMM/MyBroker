import { describe, expect, it } from "vitest";
import { classifyDayMode, isWeekendYmd } from "./day-mode";
import { parseDailyRecordMarkdown } from "./daily-record-structure";

describe("isWeekendYmd", () => {
  it("识别周六周日", () => {
    expect(isWeekendYmd("2026-05-30")).toBe(true);
    expect(isWeekendYmd("2026-05-31")).toBe(true);
    expect(isWeekendYmd("2026-06-01")).toBe(false);
  });
});

describe("classifyDayMode", () => {
  it("仅有生活记录的工作日判为休息日", () => {
    const text = `# 2026-06-01 生活记录
## 今日进展
- 6:30 起床
- 陪家人 3 小时
- 打扫卫生
- 背部训练 + 跑步
- 晚上游戏放松`;
    const parsed = parseDailyRecordMarkdown(text);
    expect(classifyDayMode("2026-06-01", [parsed], text)).toBe("rest");
  });

  it("显式休息日标记优先", () => {
    const text = `# 2026-06-02 休息日
## 今日进展
- AE 农场 30min`;
    const parsed = parseDailyRecordMarkdown(text);
    expect(classifyDayMode("2026-06-02", [parsed], text)).toBe("rest");
  });

  it("有工作项目时判为工作日", () => {
    const text = `# 2026-05-23 工作日报
## 今日进展
- AE 农场 30min
  - 松鼠换肤`;
    const parsed = parseDailyRecordMarkdown(text);
    expect(classifyDayMode("2026-05-23", [parsed], text)).toBe("work");
  });

  it("周末无工作信号为休息日", () => {
    expect(classifyDayMode("2026-05-30", [], "")).toBe("rest");
  });

  it("周末有工作记录仍为工作日", () => {
    const text = `# 2026-05-30 加班
## 今日进展
- 社媒项目评审 2h`;
    const parsed = parseDailyRecordMarkdown(text);
    expect(classifyDayMode("2026-05-30", [parsed], text)).toBe("work");
  });
});
