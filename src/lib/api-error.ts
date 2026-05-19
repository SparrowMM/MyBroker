import { NextResponse } from "next/server";
import {
  DATABASE_NOT_CONFIGURED_MESSAGE,
  isPlaceholderDatabaseUrl,
} from "@/lib/database-connection-url";

type PrismaLikeError = {
  name?: string;
  code?: string;
  message?: string;
};

/**
 * 把后端各类异常（尤其是 Prisma 连接异常）翻译为带 `message` 的 JSON 响应，
 * 避免直接抛 500 让前端只能看到 Next.js 内部栈。
 */
export function jsonErrorResponse(err: unknown, fallback = "服务异常，请稍后重试"): NextResponse {
  if (isPlaceholderDatabaseUrl(process.env.DATABASE_URL)) {
    return NextResponse.json(
      { ok: false, message: DATABASE_NOT_CONFIGURED_MESSAGE, code: "DATABASE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const e = (err ?? {}) as PrismaLikeError;
  const raw = String(e.message ?? err ?? "");

  if (/Tenant or user not found/i.test(raw)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "数据库连接失败：Supabase 返回 Tenant or user not found，通常是 DATABASE_URL 中的项目 Reference ID 或密码不正确。",
        code: "DATABASE_AUTH_FAILED",
      },
      { status: 503 },
    );
  }

  if (
    /provided database string is invalid|error parsing connection string|invalid port number/i.test(
      raw,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "DATABASE_URL 格式无效，无法解析（例如端口异常）。若数据库密码含 @ : / # % [ ] 等字符，需在连接串中对密码做 URL 编码；或从 Supabase 项目设置里完整复制「Connection string」粘贴到 .env.local，保存后重启 dev server。",
        code: "DATABASE_URL_INVALID",
      },
      { status: 503 },
    );
  }

  if (
    e.name === "PrismaClientInitializationError" ||
    /can't reach database server|connection refused|ENOTFOUND|ETIMEDOUT/i.test(raw)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "无法连接数据库，请检查 DATABASE_URL 与网络。",
        code: "DATABASE_UNREACHABLE",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { ok: false, message: raw || fallback },
    { status: 500 },
  );
}
