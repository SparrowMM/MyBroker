from app.config import get_settings
import httpx
import json
import time
import base64
from typing import Any
from app.database import SessionLocal
from models.llm_call_log import LLMCallLog


class BailianClient:
    """
    预留百炼能力接入点。
    当前默认使用本地规则生成，避免因为未配置密钥导致服务不可用。
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    def _digest_prompt(self, messages: list[dict[str, Any]]) -> str:
        chunks: list[str] = []
        for x in messages:
            if not isinstance(x, dict):
                continue
            content = x.get("content", "")
            if isinstance(content, str):
                chunks.append(content)
                continue
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and isinstance(item.get("text"), str):
                        chunks.append(item["text"])
        merged = " ".join(chunks)
        merged = " ".join(merged.split())
        return merged[:220]

    def _log_call(
        self,
        *,
        scenario: str,
        prompt_digest: str,
        latency_ms: int,
        status: str,
        model: str | None = None,
        error_message: str = "",
    ) -> None:
        try:
            db = SessionLocal()
            db.add(
                LLMCallLog(
                    scenario=scenario,
                    model=model or self.settings.bailian_model,
                    prompt_digest=prompt_digest,
                    latency_ms=latency_ms,
                    status=status,
                    error_message=error_message[:500],
                )
            )
            db.commit()
            db.close()
        except Exception:
            return

    def _chat_with_status(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.3,
        scenario: str = "summary",
        model: str | None = None,
        base_url_override: str | None = None,
        api_key_override: str | None = None,
        timeout_sec: float = 20.0,
        max_tokens: int | None = None,
    ) -> tuple[str, str]:
        digest = self._digest_prompt(messages)
        started = time.time()
        model_name = model or self.settings.bailian_model
        api_key = api_key_override or self.settings.bailian_api_key
        if not api_key:
            self._log_call(
                scenario=scenario,
                prompt_digest=digest,
                latency_ms=int((time.time() - started) * 1000),
                status="skipped_no_key",
                model=model_name,
            )
            return "", "missing_api_key"
        base_url = (base_url_override or self.settings.bailian_base_url).rstrip("/")
        url = f"{base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        def _post(target_url: str) -> httpx.Response:
            with httpx.Client(timeout=timeout_sec) as client:
                return client.post(target_url, headers=headers, json=payload)

        def _convert_messages_for_dashscope_mm(raw_messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
            converted: list[dict[str, Any]] = []
            for msg in raw_messages:
                role = str(msg.get("role", "user"))
                content = msg.get("content", "")
                if isinstance(content, str):
                    converted.append({"role": role, "content": [{"text": content}]})
                    continue
                if isinstance(content, list):
                    parts: list[dict[str, Any]] = []
                    for item in content:
                        if not isinstance(item, dict):
                            continue
                        item_type = item.get("type")
                        if item_type == "text" and isinstance(item.get("text"), str):
                            parts.append({"text": item["text"]})
                        elif item_type == "image_url":
                            image_url = item.get("image_url", {})
                            if isinstance(image_url, dict) and isinstance(image_url.get("url"), str):
                                parts.append({"image": image_url["url"]})
                    if parts:
                        converted.append({"role": role, "content": parts})
            return converted

        try:
            # 百炼多模态原生端点（完整 URL，不走 OpenAI 兼容格式）
            if base_url.startswith("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation"):
                mm_payload: dict[str, Any] = {
                    "model": model_name,
                    "input": {"messages": _convert_messages_for_dashscope_mm(messages)},
                    "parameters": {"temperature": temperature},
                }
                if max_tokens is not None:
                    mm_payload["parameters"]["max_tokens"] = max_tokens
                mm_url = (
                    f"{base_url}/generation"
                    if not base_url.endswith("/generation")
                    else base_url
                )
                with httpx.Client(timeout=timeout_sec) as client:
                    resp = client.post(mm_url, headers=headers, json=mm_payload)
            else:
                resp = _post(url)
            # 对 coding plan 账号做自动兼容：
            # 如果兼容模式端点返回 401/403，自动回退到 coding 端点重试一次。
            if (
                resp.status_code in (401, 403)
                and "dashscope.aliyuncs.com/compatible-mode" in base_url
            ):
                resp = _post("https://coding.dashscope.aliyuncs.com/v1/chat/completions")
            if resp.status_code >= 400:
                err_text = resp.text[:300]
                self._log_call(
                    scenario=scenario,
                    prompt_digest=digest,
                    latency_ms=int((time.time() - started) * 1000),
                    status="error",
                    model=model_name,
                    error_message=err_text,
                )
                return "", err_text
            data = resp.json()
            content = ""
            if base_url.startswith("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation"):
                mm_content = (
                    data.get("output", {})
                    .get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", [])
                )
                if isinstance(mm_content, list):
                    content = "\n".join(
                        [str(x.get("text", "")).strip() for x in mm_content if isinstance(x, dict)]
                    ).strip()
            else:
                content = (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                    .strip()
                )
            self._log_call(
                scenario=scenario,
                prompt_digest=digest,
                latency_ms=int((time.time() - started) * 1000),
                status="ok" if content else "empty_content",
                model=model_name,
            )
            return content, ""
        except Exception as e:
            self._log_call(
                scenario=scenario,
                prompt_digest=digest,
                latency_ms=int((time.time() - started) * 1000),
                status="error",
                model=model_name,
                error_message=str(e),
            )
            return "", str(e)

    def _chat(
        self,
        messages: list[dict[str, Any]],
        temperature: float = 0.3,
        scenario: str = "summary",
        model: str | None = None,
        base_url_override: str | None = None,
        api_key_override: str | None = None,
    ) -> str:
        content, _ = self._chat_with_status(
            messages,
            temperature=temperature,
            scenario=scenario,
            model=model,
            base_url_override=base_url_override,
            api_key_override=api_key_override,
        )
        return content

    def summarize(self, prompt: str) -> str:
        return self._chat(
            [
                {"role": "system", "content": "你是专业经纪人助理，输出简洁、可执行中文结论。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            scenario="daily_summary",
        )

    def summarize_period(self, period_label: str, summaries: list[str], top_tags: list[str]) -> str:
        prompt = (
            f"请为{period_label}写一段中文复盘总结，包含进展、风险、下一步。\n"
            f"重点标签: {'、'.join(top_tags) if top_tags else '暂无'}\n"
            f"记录摘要: {' '.join(summaries[:10])}"
        )
        return self._chat(
            [
                {"role": "system", "content": "你是专业经纪人助理，输出简洁、可执行中文结论。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            scenario="period_summary",
        )

    def decide_project(self, task_description: str, existing_projects: list[str]) -> dict[str, Any] | None:
        prompt = (
            "请判断该任务是否应该新建项目，并仅返回 JSON。\n"
            '字段: should_create_project(bool), confidence(0-1), suggested_project_name(str), reason(str)\n'
            f"任务描述: {task_description}\n"
            f"已有项目: {', '.join(existing_projects) if existing_projects else '无'}"
        )
        raw = self._chat(
            [
                {"role": "system", "content": "你是严谨的项目管理助手，只返回 JSON。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            scenario="project_decision",
        )
        if not raw:
            return None
        try:
            start = raw.find("{")
            end = raw.rfind("}")
            if start == -1 or end == -1:
                return None
            parsed = json.loads(raw[start : end + 1])
            if not isinstance(parsed, dict):
                return None
            return parsed
        except Exception:
            return None

    def image_to_markdown(self, image_bytes: bytes, mime_type: str, record_date: str) -> str:
        if not image_bytes:
            return ""
        prompt = (
            f"请根据这张日报截图提取关键信息并输出 Markdown 文档（日期：{record_date}）。\n"
            "要求：\n"
            "1) 仅输出 Markdown，不要输出额外解释；\n"
            "2) 结构包含：# 标题、## 今日进展、## 风险与阻塞、## 明日计划、## 待确认事项；\n"
            "3) 每个小节使用项目符号，信息缺失时写“待补充”；\n"
            "4) 内容务必忠于截图，不要编造金额/客户名等细节。"
        )
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": "你是专业经纪人助理，擅长从业务截图提炼结构化纪要。"},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{base64_image}"
                        },
                    },
                ],
            },
        ]
        return self._chat(
            messages,
            temperature=0.1,
            scenario="image_to_markdown",
            model=self.settings.bailian_vision_model,
            base_url_override=self.settings.bailian_vision_base_url,
            api_key_override=self.settings.bailian_vision_api_key,
        )

    def probe_text_model(self) -> tuple[bool, str]:
        if not self.settings.bailian_api_key:
            return False, "缺少 BAILIAN_API_KEY"
        content, err = self._chat_with_status(
            [
                {"role": "system", "content": "你是健康检查助手。"},
                {"role": "user", "content": "请只回复 OK"},
            ],
            temperature=0.0,
            scenario="health_probe_text",
            model=self.settings.bailian_model,
            timeout_sec=8.0,
            max_tokens=8,
        )
        if err:
            return False, err
        return bool(content), "" if content else "模型返回空内容"

    def probe_vision_model(self) -> tuple[bool, str]:
        if not self.settings.bailian_api_key:
            return False, "缺少 BAILIAN_API_KEY"
        if not self.settings.bailian_vision_model:
            return False, "缺少 BAILIAN_VISION_MODEL"
        if not self.settings.bailian_vision_api_key:
            return False, "缺少 BAILIAN_VISION_API_KEY"
        prompt = "请识别图片，并仅回复 OK。"
        sample_image_url = (
            "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241022/emyrja/dog_and_girl.jpeg"
        )
        content, err = self._chat_with_status(
            [
                {"role": "system", "content": "你是健康检查助手。"},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": sample_image_url},
                        },
                    ],
                },
            ],
            temperature=0.0,
            scenario="health_probe_vision",
            model=self.settings.bailian_vision_model,
            base_url_override=self.settings.bailian_vision_base_url,
            api_key_override=self.settings.bailian_vision_api_key,
            timeout_sec=10.0,
            max_tokens=8,
        )
        if err:
            return False, err
        return bool(content), "" if content else "模型返回空内容"
