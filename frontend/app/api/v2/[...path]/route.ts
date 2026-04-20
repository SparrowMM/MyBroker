import { NextRequest, NextResponse } from "next/server";

const WORKER_BASE = process.env.FASTAPI_WORKER_BASE_URL || "http://127.0.0.1:8000";

function buildTargetUrl(req: NextRequest, pathSegments: string[]) {
  const url = new URL(req.url);
  const query = url.search || "";
  return `${WORKER_BASE}/v2/${pathSegments.join("/")}${query}`;
}

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const targetUrl = buildTargetUrl(req, pathSegments);
  const method = req.method;
  const headers: HeadersInit = {};
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers["content-type"] = contentType;
  }

  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    const body = await req.arrayBuffer();
    init.body = Buffer.from(body);
  }

  const resp = await fetch(targetUrl, init);
  const text = await resp.text();
  return new NextResponse(text, {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") || "application/json; charset=utf-8",
    },
  });
}

export async function GET(req: NextRequest, context: { params: { path: string[] } }) {
  return proxyRequest(req, context.params.path);
}

export async function POST(req: NextRequest, context: { params: { path: string[] } }) {
  return proxyRequest(req, context.params.path);
}

export async function PATCH(req: NextRequest, context: { params: { path: string[] } }) {
  return proxyRequest(req, context.params.path);
}
