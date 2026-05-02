import { prisma } from "@/lib/prisma";
import {
  getBailianApiKey,
  getBailianBaseUrl,
  getBailianModel,
  getBailianVisionApiKey,
  getBailianVisionBaseUrl,
  getBailianVisionModel,
  normalizeOpenAiCompatibleBaseUrl,
} from "@/lib/env";

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage =
  | { role: string; content: string }
  | { role: string; content: ChatContentPart[] };

/** 用于日志与观测的提示摘要（纯函数，可单测） */
export function digestPrompt(messages: ChatMessage[]): string {
  const chunks: string[] = [];
  for (const x of messages) {
    const content = x.content;
    if (typeof content === "string") {
      chunks.push(content);
      continue;
    }
    for (const item of content) {
      if (item.type === "text" && item.text) {
        chunks.push(item.text);
      }
    }
  }
  const merged = chunks.join(" ").replace(/\s+/g, " ").trim();
  return merged.slice(0, 220);
}

async function logCall(params: {
  scenario: string;
  promptDigest: string;
  latencyMs: number;
  status: string;
  model: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await prisma.llmCallLog.create({
      data: {
        scenario: params.scenario,
        model: params.model,
        promptDigest: params.promptDigest,
        latencyMs: params.latencyMs,
        status: params.status,
        errorMessage: (params.errorMessage ?? "").slice(0, 500),
        createdAt: new Date(),
      },
    });
  } catch {
    // 日志失败不影响主流程
  }
}

function convertMessagesForDashscopeMm(rawMessages: ChatMessage[]) {
  const converted: { role: string; content: Array<{ text?: string; image?: string }> }[] = [];
  for (const msg of rawMessages) {
    const role = String(msg.role || "user");
    const content = msg.content;
    if (typeof content === "string") {
      converted.push({ role, content: [{ text: content }] });
      continue;
    }
    const parts: Array<{ text?: string; image?: string }> = [];
    for (const item of content) {
      if (item.type === "text" && item.text) {
        parts.push({ text: item.text });
      } else if (item.type === "image_url" && item.image_url?.url) {
        parts.push({ image: item.image_url.url });
      }
    }
    if (parts.length) {
      converted.push({ role, content: parts });
    }
  }
  return converted;
}

export async function chatWithStatus(
  messages: ChatMessage[],
  options: {
    temperature?: number;
    scenario?: string;
    model?: string;
    baseUrlOverride?: string;
    apiKeyOverride?: string;
    timeoutSec?: number;
    maxTokens?: number | null;
  } = {},
): Promise<{ content: string; error: string }> {
  const temperature = options.temperature ?? 0.3;
  const scenario = options.scenario ?? "summary";
  const modelName = options.model ?? getBailianModel();
  const apiKey = options.apiKeyOverride ?? getBailianApiKey();
  const digest = digestPrompt(messages);
  const started = Date.now();

  if (!apiKey) {
    await logCall({
      scenario,
      promptDigest: digest,
      latencyMs: Date.now() - started,
      status: "skipped_no_key",
      model: modelName,
    });
    return { content: "", error: "missing_api_key" };
  }

  let baseUrl = normalizeOpenAiCompatibleBaseUrl(options.baseUrlOverride ?? getBailianBaseUrl());
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const payload: Record<string, unknown> = {
    model: modelName,
    messages,
    temperature,
  };
  if (options.maxTokens != null) {
    payload.max_tokens = options.maxTokens;
  }

  async function post(targetUrl: string): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), (options.timeoutSec ?? 20) * 1000);
    try {
      return await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  }

  try {
    let resp: Response;

    if (baseUrl.startsWith("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation")) {
      const mmPayload: Record<string, unknown> = {
        model: modelName,
        input: { messages: convertMessagesForDashscopeMm(messages) },
        parameters: { temperature },
      };
      if (options.maxTokens != null) {
        (mmPayload.parameters as Record<string, unknown>).max_tokens = options.maxTokens;
      }
      const mmUrl = baseUrl.endsWith("/generation") ? baseUrl : `${baseUrl}/generation`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), (options.timeoutSec ?? 20) * 1000);
      try {
        resp = await fetch(mmUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(mmPayload),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(t);
      }
    } else {
      resp = await post(url);
    }

    if (
      resp.status === 401 ||
      resp.status === 403
    ) {
      const originalUrl = normalizeOpenAiCompatibleBaseUrl(options.baseUrlOverride ?? getBailianBaseUrl());
      if (originalUrl.includes("dashscope.aliyuncs.com/compatible-mode")) {
        resp = await post("https://coding.dashscope.aliyuncs.com/v1/chat/completions");
        baseUrl = "https://coding.dashscope.aliyuncs.com/v1";
      }
    }

    const latencyMs = Date.now() - started;

    if (!resp.ok) {
      const errText = (await resp.text()).slice(0, 300);
      await logCall({
        scenario,
        promptDigest: digest,
        latencyMs,
        status: "error",
        model: modelName,
        errorMessage: errText,
      });
      return { content: "", error: errText };
    }

    const data = (await resp.json()) as Record<string, unknown>;
    let content = "";

    if (baseUrl.startsWith("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation")) {
      const choices = (data.output as Record<string, unknown> | undefined)?.choices as
        | Array<{ message?: { content?: unknown } }>
        | undefined;
      const mmContent = choices?.[0]?.message?.content;
      if (Array.isArray(mmContent)) {
        content = mmContent
          .map((x) => (typeof x === "object" && x && "text" in x ? String((x as { text?: string }).text ?? "") : ""))
          .join("\n")
          .trim();
      }
    } else {
      const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
      content = (choices?.[0]?.message?.content ?? "").trim();
    }

    await logCall({
      scenario,
      promptDigest: digest,
      latencyMs,
      status: content ? "ok" : "empty_content",
      model: modelName,
    });
    return { content, error: "" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCall({
      scenario,
      promptDigest: digest,
      latencyMs: Date.now() - started,
      status: "error",
      model: modelName,
      errorMessage: msg,
    });
    return { content: "", error: msg };
  }
}

export async function chat(
  messages: ChatMessage[],
  options: Parameters<typeof chatWithStatus>[1] = {},
): Promise<string> {
  const { content } = await chatWithStatus(messages, options);
  return content;
}

export async function summarizeText(prompt: string): Promise<string> {
  return chat(
    [
      { role: "system", content: "你是专业经纪人助理，输出简洁、可执行中文结论。" },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3, scenario: "daily_summary" },
  );
}

export async function summarizePeriod(periodLabel: string, summaries: string[], topTags: string[]): Promise<string> {
  const prompt = `请为${periodLabel}写一段中文复盘总结，包含进展、风险、下一步。\n重点标签: ${
    topTags.length ? topTags.join("、") : "暂无"
  }\n记录摘要: ${summaries.slice(0, 10).join(" ")}`;
  return chat(
    [
      { role: "system", content: "你是专业经纪人助理，输出简洁、可执行中文结论。" },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3, scenario: "period_summary" },
  );
}

export async function decideProjectJson(
  taskDescription: string,
  existingProjects: string[],
): Promise<Record<string, unknown> | null> {
  const prompt = `请判断该任务是否应该新建项目，并仅返回 JSON。\n字段: should_create_project(bool), confidence(0-1), suggested_project_name(str), reason(str)\n任务描述: ${taskDescription}\n已有项目: ${
    existingProjects.length ? existingProjects.join(", ") : "无"
  }`;
  const raw = await chat(
    [
      { role: "system", content: "你是严谨的项目管理助手，只返回 JSON。" },
      { role: "user", content: prompt },
    ],
    { temperature: 0.1, scenario: "project_decision" },
  );
  if (!raw) return null;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function imageToMarkdown(imageBytes: Buffer, mimeType: string, recordDate: string): Promise<string> {
  const prompt = `请根据这张日报截图提取关键信息并输出 Markdown 文档（日期：${recordDate}）。\n要求：\n1) 仅输出 Markdown，不要输出额外解释；\n2) 结构包含：# 标题、## 今日进展、## 风险与阻塞、## 明日计划、## 待确认事项；\n3) 每个小节使用项目符号，信息缺失时写“待补充”；\n4) 内容务必忠于截图，不要编造金额/客户名等细节。`;
  const base64Image = imageBytes.toString("base64");
  const messages: ChatMessage[] = [
    { role: "system", content: "你是专业经纪人助理，擅长从业务截图提炼结构化纪要。" },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
      ],
    },
  ];
  return chat(messages, {
    temperature: 0.1,
    scenario: "image_to_markdown",
    model: getBailianVisionModel(),
    baseUrlOverride: getBailianVisionBaseUrl(),
    apiKeyOverride: getBailianVisionApiKey(),
  });
}

const missingKeyHint = "缺少 BAILIAN_API_KEY（旧别名 DASHSCOPE_API_KEY 亦可）";

export async function probeTextModel(): Promise<{ ok: boolean; error: string }> {
  if (!getBailianApiKey()) {
    return { ok: false, error: missingKeyHint };
  }
  const { content, error } = await chatWithStatus(
    [
      { role: "system", content: "你是健康检查助手。" },
      { role: "user", content: "请只回复 OK" },
    ],
    {
      temperature: 0,
      scenario: "health_probe_text",
      model: getBailianModel(),
      timeoutSec: 8,
      maxTokens: 8,
    },
  );
  if (error === "missing_api_key") {
    return { ok: false, error: missingKeyHint };
  }
  if (error) {
    return { ok: false, error };
  }
  return { ok: Boolean(content), error: content ? "" : "模型返回空内容" };
}

export async function probeVisionModel(): Promise<{ ok: boolean; error: string }> {
  if (!getBailianApiKey()) {
    return { ok: false, error: missingKeyHint };
  }
  if (!getBailianVisionModel()) {
    return { ok: false, error: "缺少 BAILIAN_VISION_MODEL（旧别名 DASHSCOPE_VISION_MODEL 亦可）" };
  }
  const sampleImageUrl =
    "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241022/emyrja/dog_and_girl.jpeg";
  const { content, error } = await chatWithStatus(
    [
      { role: "system", content: "你是健康检查助手。" },
      {
        role: "user",
        content: [
          { type: "text", text: "请识别图片，并仅回复 OK。" },
          { type: "image_url", image_url: { url: sampleImageUrl } },
        ],
      },
    ],
    {
      temperature: 0,
      scenario: "health_probe_vision",
      model: getBailianVisionModel(),
      baseUrlOverride: getBailianVisionBaseUrl(),
      apiKeyOverride: getBailianVisionApiKey(),
      timeoutSec: 10,
      maxTokens: 8,
    },
  );
  if (error === "missing_api_key") {
    return { ok: false, error: missingKeyHint };
  }
  if (error) {
    return { ok: false, error };
  }
  return { ok: Boolean(content), error: content ? "" : "模型返回空内容" };
}
