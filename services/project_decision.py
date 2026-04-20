import re
from services.llm_client import BailianClient


class ProjectDecisionEngine:
    def __init__(self) -> None:
        self.llm = BailianClient()

    def evaluate(self, task_description: str, existing_projects: list[str]) -> tuple[bool, float, str, str]:
        text = task_description.strip()
        normalized_projects = [p.lower() for p in existing_projects]

        # 强特征：如果任务包含独立目标、周期、交付，优先建议新建项目
        has_goal = bool(re.search(r"(目标|上线|交付|里程碑|版本|MVP|增长|营收)", text, re.IGNORECASE))
        has_timeline = bool(re.search(r"(本周|本月|季度|deadline|截止|排期|里程碑)", text, re.IGNORECASE))
        has_multi_step = bool(re.search(r"(拆解|阶段|流程|模块|多步|迭代)", text, re.IGNORECASE))

        # 与已有项目高相似时，不建议新建
        overlap = any(p in text.lower() for p in normalized_projects if p)

        score = 0.0
        score += 0.35 if has_goal else 0.0
        score += 0.3 if has_timeline else 0.0
        score += 0.25 if has_multi_step else 0.0
        score -= 0.4 if overlap else 0.0
        score = max(0.0, min(1.0, score))

        should_create = score >= 0.55
        suggested_name = self._suggest_name(task_description)
        if should_create:
            reason = "该事项具备独立目标与推进周期，建议以项目化管理提升执行与复盘效率。"
        else:
            reason = "该事项与现有项目重叠或复杂度不足，建议并入已有项目管理。"

        llm_result = self.llm.decide_project(task_description, existing_projects)
        if llm_result:
            try:
                llm_should = bool(llm_result.get("should_create_project", should_create))
                llm_confidence = float(llm_result.get("confidence", score))
                llm_name = str(llm_result.get("suggested_project_name", suggested_name)).strip() or suggested_name
                llm_reason = str(llm_result.get("reason", reason)).strip() or reason
                return llm_should, max(0.0, min(1.0, llm_confidence)), llm_name, llm_reason
            except Exception:
                pass
        return should_create, score, suggested_name, reason

    def _suggest_name(self, task_description: str) -> str:
        cleaned = re.sub(r"\s+", " ", task_description).strip()
        short = cleaned[:14] if cleaned else "新项目"
        return f"{short}项目"
