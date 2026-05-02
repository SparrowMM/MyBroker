import { describe, expect, it } from "vitest";
import { markdownToPlain } from "./markdown-plain";

describe("markdownToPlain", () => {
  it("去掉标题井号", () => {
    expect(markdownToPlain("## 标题\n正文")).toBe("标题\n正文");
  });

  it("去掉粗体标记", () => {
    expect(markdownToPlain("这是**重点**内容")).toBe("这是重点内容");
  });

  it("无序列表转为 · 前缀", () => {
    expect(markdownToPlain("- 第一项\n* 第二")).toBe("· 第一项\n· 第二");
  });

  it("合并多余空白（标题替换后保留换行）", () => {
    expect(markdownToPlain("# A\n\nB")).toBe("A\n\nB");
  });
});
