import { describe, expect, it } from "vitest";
import {
  analyzeDayMetrics,
  buildFallbackTeamMessages,
  formatTeamTriggerHints,
  hasParentingSignals,
  parseSleepFromText,
  parseTimeUsageFromText,
  selectRestDayTeamMembers,
  selectTeamMembers,
  workTimeEntries,
} from "./broker-team";
import { parseDailyRecordMarkdown } from "./daily-record-structure";

describe("broker-team", () => {
  it("解析日报中的 min/h 用时", () => {
    const text = `
- AE 农场 30min
- 账号策略子agent 10min
- 下午：社媒项目 对焦 1小时
`;
    const entries = parseTimeUsageFromText(text);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries.some((e) => e.minutes === 30)).toBe(true);
    expect(analyzeDayMetrics(text).totalWorkMinutes).toBeGreaterThanOrEqual(40);
  });

  it("解析睡眠字段", () => {
    const sleep = parseSleepFromText("入睡 23:40\n起床 7:10\n睡了 6.5 小时");
    expect(sleep.bedtime).toBeTruthy();
    expect(sleep.wake).toBeTruthy();
    expect(sleep.durationHours).toBe(6.5);
  });

  it("有用时与睡眠时倾向同时选中职业教练与复原顾问", () => {
    const text = `
AE 农场 45min
入睡 1:30
熬夜
`;
    const ids = selectTeamMembers(text, 2);
    expect(ids).toContain("career");
    expect(ids).toContain("recovery");
  });

  it("触发提示含用时与睡眠摘录", () => {
    const hints = formatTeamTriggerHints("社媒 30min\n入睡 23:00");
    expect(hints).toContain("用时摘录");
    expect(hints).toContain("睡眠摘录");
    expect(hints).toContain("时间效率");
  });

  it("育儿与复原信号互斥时不同存", () => {
    const text = "孩子哭闹两小时，凌晨三点才睡，疲惫";
    const ids = selectTeamMembers(text, 2);
    expect(ids.includes("recovery") && ids.includes("parenting")).toBe(false);
  });

  it("育儿用时不会计入工作对焦", () => {
    const text = "孩子哭闹，教育孩子花了2小时，很无助\nAE农场 对焦 30min";
    const work = workTimeEntries(parseTimeUsageFromText(text));
    expect(work.every((e) => !/孩子|哭闹/.test(e.label))).toBe(true);
    expect(work.some((e) => /农场|对焦/.test(e.label))).toBe(true);
  });

  it("本地回退引用用时结构", () => {
    const parsed = parseDailyRecordMarkdown(`# 日报
## 今日进展
- 社媒对焦 60min
- 方案写完 30min
`);
    const msgs = buildFallbackTeamMessages("社媒对焦 60min\n方案写完 30min", parsed);
    const career = msgs.find((m) => m.id === "career");
    expect(career?.text).toMatch(/对焦|产出|分钟|小时/);
  });

  it("休息日选出生活/健身/休息教练", () => {
    const text = `陪家人 3 小时\n打扫卫生\n背部训练 + 跑步\n晚上游戏放松`;
    const ids = selectTeamMembers(text, 3, { restDay: true });
    expect(ids).toContain("life");
    expect(ids).toContain("fitness");
    expect(ids).toContain("rest");
    expect(ids).not.toContain("career");
  });

  it("休息日触发提示含三位教练摘录", () => {
    const hints = formatTeamTriggerHints("陪家人\n跑步 40min\n晚上游戏", { restDay: true });
    expect(hints).toContain("生活教练");
    expect(hints).toContain("健身教练");
    expect(hints).toContain("休息教练");
    expect(hints).toContain("生活摘录");
    expect(hints).not.toMatch(/职业教练：建议出镜/);
  });

  it("休息日有育儿记录时保留育儿同伴专席", () => {
    const text = "陪家人 3 小时\n孩子闹脾气 1 小时\n背部训练 + 跑步\n晚上游戏";
    const ids = selectTeamMembers(text, 4, { restDay: true });
    expect(ids).toContain("parenting");
    expect(ids).toContain("life");
    expect(ids).toContain("fitness");
    expect(ids).toContain("rest");
    expect(ids.length).toBe(4);
  });

  it("陪孩子等表述可触发育儿同伴", () => {
    expect(hasParentingSignals("下午陪孩子搭积木")).toBe(true);
    const ids = selectRestDayTeamMembers("下午陪孩子搭积木\n跑步");
    expect(ids).toContain("parenting");
  });

  it("休息日触发提示含育儿摘录时标记必须出镜", () => {
    const hints = formatTeamTriggerHints("陪孩子 2 小时\n跑步 40min\n晚上游戏", { restDay: true });
    expect(hints).toContain("育儿同伴：必须出镜");
    expect(hints).toContain("育儿摘录");
  });

  it("休息日本地回退含育儿同伴", () => {
    const parsed = parseDailyRecordMarkdown(`# 生活记录
## 今日进展
- 陪孩子 2 小时
- 跑步 30min
- 晚上游戏`);
    const msgs = buildFallbackTeamMessages("陪孩子 2 小时\n跑步 30min\n晚上游戏", parsed, {
      restDay: true,
    });
    expect(msgs.some((m) => m.label === "育儿同伴")).toBe(true);
  });
});
