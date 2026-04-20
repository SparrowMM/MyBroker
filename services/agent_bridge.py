from app.config import get_settings


class AgentBridge:
    """
    连接你现有的 Agent 底层（/Users/.../ai-makaiqian）。
    当前提供协议接口，便于后续按你的底层项目实际 API 改造。
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    def sync_record(self, payload: dict) -> dict:
        if not self.settings.agent_backend_url:
            return {"synced": False, "reason": "AGENT_BACKEND_URL 未配置"}
        # TODO: 在这里请求你的 Agent 底层服务
        return {"synced": False, "reason": "待接入外部 Agent 服务"}
