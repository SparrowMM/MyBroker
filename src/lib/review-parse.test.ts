import { describe, expect, it } from "vitest";
import { parseReviewDocument } from "./review-parse";

const SAMPLE = `## 2026-05-21 · 收工片刻

### 今日切片
上午在 AE农场。

### 工作台手记
**闪过的光**
- 评审完成
**未散的雾**
- 计划空白
**明日的一盏灯**
- 写排期

### 生活隙
中午一个人吃饭。

### 仍悬而未决
- □ 趋势洞察

### 团留言
- **职业教练**：明天先画流程图。
- **复原顾问**：今晚早半小时收屏。

### 经纪人说
早点休息。
`;

describe("parseReviewDocument", () => {
  it("解析章节与工作台三列", () => {
    const doc = parseReviewDocument(SAMPLE);
    expect(doc.docTitle).toContain("收工片刻");
    expect(doc.sections.find((s) => s.kind === "workbench")?.workbench?.light).toEqual([
      "评审完成",
    ]);
    expect(doc.sections.find((s) => s.kind === "pending")?.bullets[0]).toContain("趋势洞察");
    const team = doc.sections.find((s) => s.kind === "team");
    expect(team?.teamMessages).toHaveLength(2);
    expect(team?.teamMessages?.[0].role).toBe("职业教练");
  });

  it("兼容旧版标题", () => {
    const old = `## 2026-05-21 日终复盘
### 今天做了什么
- a
### 工作
**亮点**
- b
### 生活
- c
### 未完成待办
- d
### 经纪人寄语
e`;
    const doc = parseReviewDocument(old);
    expect(doc.sections.some((s) => s.kind === "slice")).toBe(true);
    expect(doc.sections.some((s) => s.kind === "closing")).toBe(true);
  });
});
