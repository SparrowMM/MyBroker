import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    llmCallLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { chatWithStatus } from "./bailian-client";

function installFetchMock(
  impl: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(impl);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("chatWithStatus", () => {
  const prismaCreate = vi.mocked(prisma.llmCallLog.create);

  beforeEach(() => {
    prismaCreate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("无 API Key 时返回 missing_api_key 并记录 skipped_no_key", async () => {
    const r = await chatWithStatus([{ role: "user", content: "hi" }], {
      apiKeyOverride: "",
      scenario: "unit_no_key",
    });
    expect(r).toEqual({ content: "", error: "missing_api_key" });
    expect(prismaCreate).toHaveBeenCalledTimes(1);
    expect(prismaCreate.mock.calls[0]?.[0]?.data?.status).toBe("skipped_no_key");
  });

  it("兼容模式接口返回 401/403 时回退到 coding 域名并成功解析正文", async () => {
    let firstCompatible = true;
    installFetchMock(async (url) => {
      const u = String(url);
      if (u.includes("compatible-mode") && firstCompatible) {
        firstCompatible = false;
        return new Response("unauthorized", { status: 401 });
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "回退后正文" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const r = await chatWithStatus([{ role: "user", content: "问" }], {
      apiKeyOverride: "test-key",
      baseUrlOverride: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-plus",
      scenario: "unit_fallback",
      timeoutSec: 5,
    });

    expect(r.error).toBe("");
    expect(r.content).toBe("回退后正文");
    expect(prismaCreate).toHaveBeenCalled();
    const statuses = prismaCreate.mock.calls.map((c) => c[0]?.data?.status);
    expect(statuses).toContain("ok");
  });

  it("HTTP 非成功时返回错误片段并记录 error", async () => {
    installFetchMock(async () => new Response("upstream failed", { status: 502 }));

    const r = await chatWithStatus([{ role: "user", content: "x" }], {
      apiKeyOverride: "k",
      baseUrlOverride: "https://coding.dashscope.aliyuncs.com/v1",
      scenario: "unit_http_err",
      timeoutSec: 5,
    });

    expect(r.content).toBe("");
    expect(r.error).toContain("upstream");
    expect(prismaCreate.mock.calls.some((c) => c[0]?.data?.status === "error")).toBe(true);
  });

  it("多模态 generation 路径解析 output.choices 中的分段文本", async () => {
    const base =
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/x";
    installFetchMock(async (url) => {
      expect(String(url)).toContain("/generation");
      return new Response(
        JSON.stringify({
          output: {
            choices: [
              {
                message: {
                  content: [{ text: "第一行" }, { text: "第二行" }],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const r = await chatWithStatus([{ role: "user", content: "看图" }], {
      apiKeyOverride: "k",
      baseUrlOverride: base,
      scenario: "unit_mm",
      timeoutSec: 5,
    });

    expect(r.error).toBe("");
    expect(r.content).toBe("第一行\n第二行");
  });
});
