import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actionItemToJson } from "@/lib/action-item-json";

/** GET — status、priority、days（按 source_date 回溯）、limit */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(500, Math.max(1, Number(sp.get("limit")) || 200));
  const days = Math.min(365, Math.max(1, Number(sp.get("days")) || 90));
  const status = sp.get("status")?.trim() || undefined;
  const priority = sp.get("priority")?.trim() || undefined;

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  const where: Prisma.ActionItemWhereInput = {
    sourceDate: { gte: start, lte: end },
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  };

  const rows = await prisma.actionItem.findMany({
    where,
    orderBy: [{ sourceDate: "desc" }, { id: "desc" }],
    take: limit,
  });

  return NextResponse.json(rows.map(actionItemToJson));
}
