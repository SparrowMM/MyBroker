import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utcTodayMidnight } from "@/lib/parse-ymd";

/** GET — 完成率、按状态/优先级计数、逾期（待办且 due_date < 今日） */
export async function GET() {
  const items = await prisma.actionItem.findMany();
  const startToday = utcTodayMidnight();

  const byStatus = new Map<string, number>();
  const byPriority = new Map<string, number>();
  for (const i of items) {
    byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1);
    byPriority.set(i.priority, (byPriority.get(i.priority) ?? 0) + 1);
  }

  const todo = items.filter((i) => i.status === "todo");
  const doneLike = items.filter((i) => i.status === "done" || i.status === "completed");
  const completionRate =
    todo.length + doneLike.length === 0 ? 0 : doneLike.length / (todo.length + doneLike.length);

  const overdue = todo.filter((i) => i.dueDate && i.dueDate < startToday).length;

  return NextResponse.json({
    total: items.length,
    by_status: Object.fromEntries(byStatus),
    by_priority: Object.fromEntries(byPriority),
    todo_open: todo.length,
    done_or_completed: doneLike.length,
    completion_rate: Math.round(completionRate * 1000) / 1000,
    overdue_todo_count: overdue,
  });
}
