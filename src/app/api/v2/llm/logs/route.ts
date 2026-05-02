import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 30));
  const rows = await prisma.llmCallLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      scenario: r.scenario,
      model: r.model,
      prompt_digest: r.promptDigest,
      latency_ms: r.latencyMs,
      status: r.status,
      error_message: r.errorMessage,
      created_at: r.createdAt.toISOString(),
    })),
  );
}
