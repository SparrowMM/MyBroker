import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actionItemToJson } from "@/lib/action-item-json";
import { utcTodayEnd, utcTodayMidnight } from "@/lib/parse-ymd";

/** GET — 紧急待办、今日到期、已逾期、简要建议文案 */
export async function GET() {
  const startToday = utcTodayMidnight();
  const endToday = utcTodayEnd();

  const todoWhere = { status: "todo" as const };

  const urgent = await prisma.actionItem.findMany({
    where: { ...todoWhere, priority: "high" },
    orderBy: { sourceDate: "asc" },
    take: 30,
  });

  const dueToday = await prisma.actionItem.findMany({
    where: {
      ...todoWhere,
      dueDate: { gte: startToday, lte: endToday },
    },
    orderBy: { id: "asc" },
    take: 30,
  });

  const overdue = await prisma.actionItem.findMany({
    where: {
      ...todoWhere,
      dueDate: { lt: startToday },
    },
    orderBy: { dueDate: "asc" },
    take: 30,
  });

  const suggestions: string[] = [];
  if (overdue.length) {
    suggestions.push(`有 ${overdue.length} 条待办已逾期，建议今日优先闭环或调整截止日期。`);
  }
  if (urgent.length) {
    suggestions.push(`当前 ${urgent.length} 条高优先级待办，适合排在上午处理。`);
  }
  if (!suggestions.length) {
    suggestions.push("暂无紧急提醒，可回顾周报并补充明日计划。");
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    urgent: urgent.map(actionItemToJson),
    due_today: dueToday.map(actionItemToJson),
    overdue: overdue.map(actionItemToJson),
    suggestions,
  });
}
