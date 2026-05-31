import { describe, expect, it } from "vitest";
import {
  extractActionItemsFromText,
  inferPriority,
  mergeRecordText,
} from "./action-items-logic";

describe("inferPriority", () => {
  it("紧急用语为 high", () => {
    expect(inferPriority("紧急处理合同")).toBe("high");
  });

  it("长期/不急为 low", () => {
    expect(inferPriority("长期择机再看")).toBe("low");
  });

  it("默认 medium", () => {
    expect(inferPriority("普通跟进")).toBe("medium");
  });
});

describe("mergeRecordText", () => {
  it("拼接非空段", () => {
    expect(mergeRecordText("a", "b", "")).toBe("a\nb");
    expect(mergeRecordText("", "", "")).toBe("");
  });
});

describe("extractActionItemsFromText", () => {
  it("待办引导行与关键词行", () => {
    const t = "待办：写完 PRD\n需要法务看下条款\n无关闲聊";
    expect(extractActionItemsFromText(t)).toEqual(["写完 PRD", "需要法务看下条款"]);
  });

  it("去重并限制条数", () => {
    const lines = Array.from({ length: 25 }, (_, i) => `尽快推进事项${i}`);
    const out = extractActionItemsFromText(lines.join("\n"));
    expect(out.length).toBe(20);
  });
});
