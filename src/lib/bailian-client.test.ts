import { describe, expect, it } from "vitest";
import { digestPrompt, type ChatMessage } from "./bailian-client";

describe("digestPrompt", () => {
  it("合并多轮字符串 content", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "系统提示" },
      { role: "user", content: "用户问题" },
    ];
    expect(digestPrompt(messages)).toBe("系统提示 用户问题");
  });

  it("从多段 content 抽取 text 片段", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "看图" },
          { type: "image_url", image_url: { url: "https://x/img.png" } },
          { type: "text", text: "说明文字" },
        ],
      },
    ];
    expect(digestPrompt(messages)).toBe("看图 说明文字");
  });

  it("折叠空白并截断至 220 字符", () => {
    const long = "词".repeat(300);
    const messages: ChatMessage[] = [{ role: "user", content: long }];
    const d = digestPrompt(messages);
    expect(d.length).toBe(220);
    expect(d).toBe(long.slice(0, 220));
  });

  it("空文本片段不产生多余空格", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: "" }, { type: "text", text: "仅这句" }],
      },
    ];
    expect(digestPrompt(messages)).toBe("仅这句");
  });
});
