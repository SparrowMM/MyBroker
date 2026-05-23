import { describe, expect, it } from "vitest";
import {
  BROKER_REVIEW_SYSTEM,
  buildBrokerReviewUserPrompt,
  extractReviewMarkdownDate,
  reviewMarkdownMatchesDate,
  reviewSectionOutline,
} from "./broker-review-voice";

describe("broker-review-voice", () => {
  it("复盘大纲使用散文式章节名", () => {
    const outline = reviewSectionOutline("2026-05-21");
    expect(outline).toContain("收工片刻");
    expect(outline).toContain("今日切片");
    expect(outline).toContain("工作台手记");
    expect(outline).toContain("团留言");
    expect(outline).not.toMatch(/^### 工作$/m);
  });

  it("用户 prompt 禁止公文腔", () => {
    const p = buildBrokerReviewUserPrompt("2026-05-21", "记录", "待办");
    expect(p).toContain("散文");
    expect(p).toContain("闪过的光");
    expect(p).toContain("职业教练");
    expect(BROKER_REVIEW_SYSTEM).toContain("闭环");
  });

  it("从复盘标题提取并校验日期", () => {
    const md = "## 2026-05-21 · 收工片刻\n### 今日切片\n内容";
    expect(extractReviewMarkdownDate(md)).toBe("2026-05-21");
    expect(reviewMarkdownMatchesDate(md, "2026-05-21")).toBe(true);
    expect(reviewMarkdownMatchesDate(md, "2026-05-23")).toBe(false);
  });
});
