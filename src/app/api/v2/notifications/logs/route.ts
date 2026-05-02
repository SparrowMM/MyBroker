import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET ?limit=50&channel=wecom — 推送历史 */
export async function GET(req: NextRequest) {
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));
  const channel = req.nextUrl.searchParams.get("channel")?.trim();

  const rows = await prisma.notificationLog.findMany({
    where: channel ? { channel } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      channel: r.channel,
      title: r.title,
      content: r.content,
      success: r.success === 1,
      response_message: r.responseMessage,
      attempts: r.attempts,
      created_at: r.createdAt.toISOString(),
    })),
  );
}
