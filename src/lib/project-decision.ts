import { decideProjectJson } from "@/lib/bailian-client";

export function evaluateHeuristic(
  taskDescription: string,
  existingProjects: string[],
): { shouldCreate: boolean; score: number; suggestedName: string; reason: string } {
  const text = taskDescription.trim();
  const normalizedProjects = existingProjects.map((p) => p.toLowerCase());

  const hasGoal = /(目标|上线|交付|里程碑|版本|MVP|增长|营收)/i.test(text);
  const hasTimeline = /(本周|本月|季度|deadline|截止|排期|里程碑)/i.test(text);
  const hasMultiStep = /(拆解|阶段|流程|模块|多步|迭代)/i.test(text);

  const overlap = normalizedProjects.some((p) => p && text.toLowerCase().includes(p));

  let score = 0;
  if (hasGoal) score += 0.35;
  if (hasTimeline) score += 0.3;
  if (hasMultiStep) score += 0.25;
  if (overlap) score -= 0.4;
  score = Math.max(0, Math.min(1, score));

  const shouldCreate = score >= 0.55;
  const suggestedName = suggestName(taskDescription);
  const reason = shouldCreate
    ? "该事项具备独立目标与推进周期，建议以项目化管理提升执行与复盘效率。"
    : "该事项与现有项目重叠或复杂度不足，建议并入已有项目管理。";

  return { shouldCreate, score, suggestedName, reason };
}

function suggestName(taskDescription: string): string {
  const cleaned = taskDescription.replace(/\s+/g, " ").trim();
  if (!cleaned) return "新项目";
  const short = cleaned.slice(0, 14);
  return `${short}项目`;
}

export async function evaluateProjectDecision(
  taskDescription: string,
  existingProjects: string[],
): Promise<{
  should_create_project: boolean;
  confidence: number;
  suggested_project_name: string;
  reason: string;
}> {
  const h = evaluateHeuristic(taskDescription, existingProjects);
  const llmResult = await decideProjectJson(taskDescription, existingProjects);
  if (llmResult) {
    try {
      const llmShould = Boolean(llmResult.should_create_project ?? h.shouldCreate);
      const llmConfidence = Number(llmResult.confidence ?? h.score);
      const llmName = String(llmResult.suggested_project_name || h.suggestedName).trim() || h.suggestedName;
      const llmReason = String(llmResult.reason || h.reason).trim() || h.reason;
      return {
        should_create_project: llmShould,
        confidence: Math.round(Math.max(0, Math.min(1, llmConfidence)) * 100) / 100,
        suggested_project_name: llmName,
        reason: llmReason,
      };
    } catch {
      // fall through
    }
  }
  return {
    should_create_project: h.shouldCreate,
    confidence: Math.round(h.score * 100) / 100,
    suggested_project_name: h.suggestedName,
    reason: h.reason,
  };
}
