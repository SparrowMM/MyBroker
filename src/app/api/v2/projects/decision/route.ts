import { NextResponse } from "next/server";
import { evaluateProjectDecision } from "@/lib/project-decision";

export async function POST(req: Request) {
  let body: { task_description?: string; existing_projects?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "JSON 解析失败" }, { status: 400 });
  }

  const taskDescription = String(body.task_description ?? "");
  const existingProjects = Array.isArray(body.existing_projects)
    ? body.existing_projects.map(String)
    : [];

  if (!taskDescription.trim()) {
    return NextResponse.json({ message: "task_description 必填" }, { status: 400 });
  }

  const result = await evaluateProjectDecision(taskDescription, existingProjects);
  return NextResponse.json(result);
}
