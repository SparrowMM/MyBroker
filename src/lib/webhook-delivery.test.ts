import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotifyChannel } from "./notify-channel";
import {
  deliverDailyNotification,
  deliverWithRetries,
  sendDingtalkMarkdown,
  sendFeishuText,
  sendWecomMarkdown,
} from "./webhook-delivery";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function installFetchMock(
  impl: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(impl);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function bodyJson(fetchMock: ReturnType<typeof vi.fn>, callIndex: number): unknown {
  const tuple = fetchMock.mock.calls[callIndex] as [RequestInfo | URL, RequestInit?];
  const body = tuple[1]?.body;
  expect(body).toBeDefined();
  return JSON.parse(String(body));
}

describe("sendWecomMarkdown", () => {
  it("HTTP 200 且 errcode 0 视为成功", async () => {
    const fetchMock = installFetchMock(async () =>
      new Response(JSON.stringify({ errcode: 0 }), { status: 200 }),
    );

    const r = await sendWecomMarkdown("https://qy.example/hook", "# 标题");
    expect(r.ok).toBe(true);
    expect(r.status_code).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = bodyJson(fetchMock, 0) as {
      msgtype: string;
      markdown: { content: string };
    };
    expect(body.msgtype).toBe("markdown");
    expect(body.markdown.content).toBe("# 标题");
  });

  it("HTTP 200 但 errcode 非 0 视为失败", async () => {
    installFetchMock(async () => new Response(JSON.stringify({ errcode: 40058 }), { status: 200 }));

    const r = await sendWecomMarkdown("https://qy.example/hook", "x");
    expect(r.ok).toBe(false);
    expect(r.status_code).toBe(200);
  });

  it("超长 Markdown 会截断并带省略标记", async () => {
    const long = "x".repeat(4000);
    const fetchMock = installFetchMock(async () =>
      new Response(JSON.stringify({ errcode: 0 }), { status: 200 }),
    );

    await sendWecomMarkdown("https://qy.example/hook", long);
    const body = bodyJson(fetchMock, 0) as { markdown: { content: string } };
    expect(body.markdown.content.length).toBeLessThanOrEqual(3800);
    expect(body.markdown.content).toContain("…（已截断）");
  });
});

describe("sendFeishuText / sendDingtalkMarkdown", () => {
  it("飞书文本 POST 且 resp.ok 决定 ok", async () => {
    const fetchMock = installFetchMock(async () => new Response("{}", { status: 200 }));

    const r = await sendFeishuText("https://open.feishu/hook", "你好");
    expect(r.ok).toBe(true);
    const body = bodyJson(fetchMock, 0) as {
      msg_type: string;
      content: { text: string };
    };
    expect(body.msg_type).toBe("text");
    expect(body.content.text).toBe("你好");
  });

  it("钉钉 Markdown 包含 title 与 text", async () => {
    const fetchMock = installFetchMock(async () => new Response("ok", { status: 200 }));

    const r = await sendDingtalkMarkdown("https://oapi.dingtalk/hook", "日報", "## 进展");
    expect(r.ok).toBe(true);
    const body = bodyJson(fetchMock, 0) as {
      msgtype: string;
      markdown: { title: string; text: string };
    };
    expect(body.msgtype).toBe("markdown");
    expect(body.markdown.title).toBe("日報");
    expect(body.markdown.text).toBe("## 进展");
  });
});

describe("deliverDailyNotification", () => {
  it("按渠道路由到对应 sender", async () => {
    const calls: string[] = [];
    const fetchMock = installFetchMock(async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ errcode: 0 }), { status: 200 });
    });

    await deliverDailyNotification("wecom", "https://w", {
      title: "T",
      markdown: "# M",
      plain_text: "P",
    });
    await deliverDailyNotification("feishu", "https://f", {
      title: "T",
      markdown: "# M",
      plain_text: "P",
    });
    await deliverDailyNotification("dingtalk", "https://d", {
      title: "T",
      markdown: "# M",
      plain_text: "P",
    });

    expect(calls).toEqual(["https://w", "https://f", "https://d"]);
    const feishuBody = bodyJson(fetchMock, 1) as { content: { text: string } };
    expect(feishuBody.content.text).toContain("T");
    expect(feishuBody.content.text).toContain("P");
  });

  it("未知渠道返回失败且不请求网络", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const r = await deliverDailyNotification("slack" as unknown as NotifyChannel, "https://x", {
      title: "",
      markdown: "",
      plain_text: "",
    });
    expect(r.ok).toBe(false);
    expect(r.status_code).toBe(0);
    expect(r.message).toBe("unknown channel");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("deliverWithRetries", () => {
  it("maxRetries=0 仅尝试一次", async () => {
    let n = 0;
    installFetchMock(async () => {
      n += 1;
      return new Response("{}", { status: 500 });
    });

    const r = await deliverWithRetries(
      "feishu",
      "https://f",
      { title: "t", markdown: "m", plain_text: "p" },
      0,
    );
    expect(n).toBe(1);
    expect(r.attempts).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("成功后立即返回并记录尝试次数", async () => {
    let n = 0;
    installFetchMock(async () => {
      n += 1;
      return new Response("{}", { status: 200 });
    });

    const r = await deliverWithRetries(
      "feishu",
      "https://f",
      { title: "t", markdown: "m", plain_text: "p" },
      2,
    );
    expect(n).toBe(1);
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it("失败后按退避重试（假计时器）", async () => {
    vi.useFakeTimers();
    let n = 0;
    installFetchMock(async () => {
      n += 1;
      return new Response("{}", { status: 500 });
    });

    const p = deliverWithRetries(
      "feishu",
      "https://f",
      { title: "t", markdown: "m", plain_text: "p" },
      1,
    );
    await vi.advanceTimersByTimeAsync(400);
    const r = await p;
    expect(n).toBe(2);
    expect(r.attempts).toBe(2);
    expect(r.ok).toBe(false);
  });
});
