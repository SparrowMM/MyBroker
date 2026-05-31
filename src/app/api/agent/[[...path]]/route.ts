import { NextRequest, NextResponse } from "next/server";
import { getAgentBackendUrl, getAgentProxySecret } from "@/lib/env";

/** 与 query 名一致，转发上游前会剥离，避免把鉴权参数泄露给 Agent。 */
const AGENT_PROXY_KEY_QUERY = "proxy_key";

const PROXY_HEADER = "x-mybroker-proxy-key";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function buildTargetUrl(req: NextRequest, pathSegments: string[]): string {
  const base = getAgentBackendUrl();
  const sub = pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "";
  const u = new URL(req.url);
  u.searchParams.delete(AGENT_PROXY_KEY_QUERY);
  return `${base}${sub}${u.search}`;
}

function forwardRequestHeaders(req: NextRequest): Headers {
  const out = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === PROXY_HEADER || HOP_BY_HOP.has(lower)) return;
    out.set(key, value);
  });
  return out;
}

function verifyAgentProxy(req: NextRequest): NextResponse | null {
  const need = getAgentProxySecret();
  if (!need) return null;
  const header = req.headers.get(PROXY_HEADER)?.trim() ?? "";
  const q = req.nextUrl.searchParams.get(AGENT_PROXY_KEY_QUERY)?.trim() ?? "";
  if (header === need || q === need) return null;
  return NextResponse.json(
    {
      ok: false,
      message: `未授权：设置 AGENT_PROXY_SECRET 时需携带 Header ${PROXY_HEADER} 或 ?${AGENT_PROXY_KEY_QUERY}=`,
    },
    { status: 401 }
  );
}

function forwardResponseHeaders(res: Response): Headers {
  const out = new Headers();
  res.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    out.set(key, value);
  });
  return out;
}

async function proxy(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  if (!getAgentBackendUrl()) {
    return NextResponse.json(
      { ok: false, message: "AGENT_BACKEND_URL 未配置，已关闭桥接" },
      { status: 503 }
    );
  }

  const denied = verifyAgentProxy(req);
  if (denied) return denied;

  const target = buildTargetUrl(req, pathSegments);
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers: forwardRequestHeaders(req),
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message: `上游 Agent 不可达: ${detail}` }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: forwardResponseHeaders(upstream),
  });
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function HEAD(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}
