import json
import re
from collections import Counter
from datetime import date

from services.llm_client import BailianClient


class RecordAnalyzer:
    def __init__(self) -> None:
        self.llm = BailianClient()

    def _extract_tags(self, text: str) -> list[str]:
        keywords = {
            "客户沟通": ["客户", "沟通", "电话", "会议", "跟进"],
            "合同法务": ["合同", "法务", "条款", "签约"],
            "商务推进": ["报价", "商务", "方案", "对接"],
            "内容输出": ["文案", "发布", "内容", "宣传"],
            "数据分析": ["分析", "数据", "报表", "复盘"],
            "项目管理": ["项目", "排期", "里程碑", "任务"],
        }
        tags: list[str] = []
        for tag, words in keywords.items():
            if any(w in text for w in words):
                tags.append(tag)
        return tags or ["日常执行"]

    def analyze_daily(self, record_date: date, raw_text: str, chat_text: str, screenshot_notes: str) -> tuple[str, list[str]]:
        merged = "\n".join([raw_text.strip(), chat_text.strip(), screenshot_notes.strip()]).strip()
        tags = self._extract_tags(merged)

        prompt = (
            f"请分析经纪人工作记录，输出一句中文总结。日期: {record_date}\n"
            f"记录内容:\n{merged}\n"
            "要求: 聚焦结果、风险与下一步。"
        )
        llm_summary = self.llm.summarize(prompt)
        if llm_summary:
            return llm_summary.strip(), tags

        # 本地回退分析
        text_len = len(merged)
        focus = "、".join(tags[:3])
        summary = f"{record_date} 主要围绕 {focus} 开展工作，已沉淀 {text_len} 字记录。建议明日优先处理高优先级客户跟进与关键事项闭环。"
        return summary, tags

    def estimate_activity_score(self, raw_text: str, chat_text: str, screenshot_notes: str, tags: list[str]) -> float:
        merged = "\n".join([raw_text.strip(), chat_text.strip(), screenshot_notes.strip()]).strip()
        text_score = min(len(merged) / 600, 1.0) * 60
        tag_score = min(len(tags), 4) / 4 * 25
        next_step_bonus = 15 if re.search(r"(明日|下一步|待办|todo|跟进)", merged, re.IGNORECASE) else 0
        return round(min(100.0, text_score + tag_score + next_step_bonus), 2)

    def extract_action_items(self, text: str) -> list[str]:
        lines = [x.strip() for x in text.splitlines() if x.strip()]
        items: list[str] = []
        for line in lines:
            if re.search(r"^(todo|待办|下一步|明日计划|follow[- ]?up)[:：]?", line, re.IGNORECASE):
                item = re.sub(r"^(todo|待办|下一步|明日计划|follow[- ]?up)[:：]?\s*", "", line, flags=re.IGNORECASE)
                if item:
                    items.append(item)
            elif re.search(r"(需要|尽快|本周|截止|推进|跟进)", line):
                items.append(line)
        # 去重保序
        dedup: list[str] = []
        for x in items:
            if x not in dedup:
                dedup.append(x)
        return dedup[:20]

    def summarize_period(self, summaries: list[str], tags_list: list[list[str]], period_label: str) -> tuple[str, list[str], list[str], list[str]]:
        if not summaries:
            return (
                f"{period_label}暂无有效记录。",
                ["尽快补充每日工作记录"],
                ["数据缺失导致判断偏差"],
                ["建立固定时间的日终填报习惯"],
            )

        all_tags = [tag for tags in tags_list for tag in tags]
        top_tags = [t for t, _ in Counter(all_tags).most_common(3)]
        highlights = [f"核心工作重心：{'、'.join(top_tags)}", f"累计记录天数：{len(summaries)} 天"]
        risks = ["部分工作产出缺少量化结果", "截图与对话可能存在信息碎片化"]
        suggestions = ["每条记录补充结果指标（金额、进度、状态）", "按周复盘未完成事项并设置截止时间"]

        combined = " ".join(summaries[:10])
        summary = f"{period_label}整体执行方向集中在{'、'.join(top_tags)}。{combined[:160]}..."
        llm_summary = self.llm.summarize_period(period_label, summaries, top_tags)
        if llm_summary:
            summary = llm_summary.strip()
        return summary, highlights, risks, suggestions


def decode_json_list(raw: str) -> list[str]:
    try:
        value = json.loads(raw)
        return value if isinstance(value, list) else []
    except json.JSONDecodeError:
        return []
