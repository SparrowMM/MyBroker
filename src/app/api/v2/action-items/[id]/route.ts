import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actionItemToJson } from "@/lib/action-item-json";
import { parseYmd } from "@/lib/parse-ymd";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseOptionalDate(s: unknown): Date | null | undefined {
  if (s === undefined) return undefined;
  if (s === null) return null;
  const str = String(s);
  if (!str) return null;
  const d = parseYmd(str);
  return d ?? undefined;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await context.params;
  const id = parseId(idStr);
  if (id === null) {
    return NextResponse.json({ message: "无效的 id" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "JSON 解析失败" }, { status: 400 });
  }

  const existing = await prisma.actionItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "待办不存在" }, { status: 404 });
  }

  const dueParsed = parseOptionalDate(payload.due_date);
  if (dueParsed === undefined && payload.due_date !== undefined) {
    return NextResponse.json({ message: "due_date 须为 YYYY-MM-DD 或 null" }, { status: 400 });
  }

  const now = new Date();
  const updated = await prisma.actionItem.update({
    where: { id },
    data: {
      ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
      ...(payload.priority !== undefined ? { priority: String(payload.priority) } : {}),
      ...(payload.content !== undefined ? { content: String(payload.content) } : {}),
      ...(payload.notes !== undefined ? { notes: String(payload.notes) } : {}),
      ...(dueParsed !== undefined ? { dueDate: dueParsed } : {}),
      updatedAt: now,
    },
  });

  return NextResponse.json({ ok: true, item: actionItemToJson(updated) });
}
