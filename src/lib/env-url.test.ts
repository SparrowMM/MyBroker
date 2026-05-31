import { describe, expect, it } from "vitest";
import { normalizeOpenAiCompatibleBaseUrl } from "@/lib/env";

describe("normalizeOpenAiCompatibleBaseUrl", () => {
  it("去掉误填的 /chat/completions 后缀", () => {
    expect(normalizeOpenAiCompatibleBaseUrl("https://coding.dashscope.aliyuncs.com/v1/chat/completions")).toBe(
      "https://coding.dashscope.aliyuncs.com/v1",
    );
  });

  it("保留不含后缀的基址", () => {
    expect(normalizeOpenAiCompatibleBaseUrl("https://coding.dashscope.aliyuncs.com/v1")).toBe(
      "https://coding.dashscope.aliyuncs.com/v1",
    );
  });

  it("去掉尾随斜杠后再判断后缀", () => {
    expect(normalizeOpenAiCompatibleBaseUrl("https://coding.dashscope.aliyuncs.com/v1/chat/completions/")).toBe(
      "https://coding.dashscope.aliyuncs.com/v1",
    );
  });
});
