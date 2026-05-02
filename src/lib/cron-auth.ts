import type { NextRequest } from "next/server";

/**
 * 校验定时任务请求：Header `Authorization: Bearer <CRON_SECRET>` 或 query `?secret=`
 * 未配置 CRON_SECRET 时一律拒绝（避免裸奔端点）。
 */
export function verifyCronSecret(req: NextRequest): { ok: boolean; reason: string } {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) {
    return { ok: false, reason: "CRON_SECRET 未配置" };
  }

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const q = req.nextUrl.searchParams.get("secret")?.trim() ?? "";

  if (bearer === secret || q === secret) {
    return { ok: true, reason: "" };
  }

  return { ok: false, reason: "未授权" };
}
