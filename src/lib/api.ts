export const API_BASE = "";

export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: unknown;
  constructor(message: string, status: number, code?: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
  toString(): string {
    return this.message;
  }
}

async function parseError(resp: Response): Promise<ApiError> {
  const text = await resp.text();
  let message = text;
  let code: string | undefined;
  let payload: unknown;
  try {
    const json = JSON.parse(text) as { message?: string; detail?: string; code?: string };
    payload = json;
    code = json.code;
    message = json.message ?? json.detail ?? text;
  } catch {
    // 非 JSON 响应：保留原文本
  }
  if (!message) {
    message = `请求失败（HTTP ${resp.status}）`;
  }
  return new ApiError(message, resp.status, code, payload);
}

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    throw await parseError(resp);
  }
  return resp.json() as Promise<T>;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<T>(resp);
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<T>(resp);
}

export async function getJson<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  return readJson<T>(resp);
}

export async function deleteJson<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  return readJson<T>(resp);
}

export async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
  });
  return readJson<T>(resp);
}

/** 把抛出的异常转为可读文案（优先用 ApiError.message） */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
