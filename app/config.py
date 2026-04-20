from functools import lru_cache
from pydantic import BaseModel
import os
from dotenv import load_dotenv


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))


class Settings(BaseModel):
    app_name: str = "MyBroker"
    # 云数据库优先（PostgreSQL/Supabase/RDS）；本地开发可自行改为本地 Postgres。
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/mybroker",
    )
    bailian_api_key: str = os.getenv("BAILIAN_API_KEY", os.getenv("DASHSCOPE_API_KEY", ""))
    bailian_base_url: str = os.getenv(
        "BAILIAN_BASE_URL",
        os.getenv("DASHSCOPE_BASE_URL", "https://coding.dashscope.aliyuncs.com/v1"),
    )
    bailian_vision_base_url: str = os.getenv(
        "BAILIAN_VISION_BASE_URL",
        os.getenv("DASHSCOPE_VISION_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
    )
    bailian_vision_api_key: str = os.getenv(
        "BAILIAN_VISION_API_KEY",
        os.getenv("DASHSCOPE_VISION_API_KEY", os.getenv("BAILIAN_API_KEY", os.getenv("DASHSCOPE_API_KEY", ""))),
    )
    bailian_model: str = os.getenv("BAILIAN_MODEL", os.getenv("DASHSCOPE_MODEL", "qwen-plus"))
    bailian_vision_model: str = os.getenv(
        "BAILIAN_VISION_MODEL",
        os.getenv("DASHSCOPE_VISION_MODEL", "qwen-vl-max-latest"),
    )
    agent_backend_url: str = os.getenv("AGENT_BACKEND_URL", "")
    supabase_url: str = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""))
    supabase_publishable_key: str = os.getenv(
        "SUPABASE_PUBLISHABLE_KEY",
        os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""),
    )
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_storage_bucket: str = os.getenv("SUPABASE_STORAGE_BUCKET", "mybroker-screenshots")
    reminder_push_enabled: bool = os.getenv("REMINDER_PUSH_ENABLED", "false").lower() == "true"
    webhook_wecom_url: str = os.getenv("WEBHOOK_WECOM_URL", "")
    webhook_feishu_url: str = os.getenv("WEBHOOK_FEISHU_URL", "")
    webhook_dingtalk_url: str = os.getenv("WEBHOOK_DINGTALK_URL", "")
    auto_push_daily_enabled: bool = os.getenv("AUTO_PUSH_DAILY_ENABLED", "false").lower() == "true"
    auto_push_daily_channel: str = os.getenv("AUTO_PUSH_DAILY_CHANNEL", "wecom")
    auto_push_daily_hour: int = int(os.getenv("AUTO_PUSH_DAILY_HOUR", "9"))
    auto_push_daily_minute: int = int(os.getenv("AUTO_PUSH_DAILY_MINUTE", "0"))
    notify_retry_times: int = int(os.getenv("NOTIFY_RETRY_TIMES", "2"))
    auto_push_weekdays_only: bool = os.getenv("AUTO_PUSH_WEEKDAYS_ONLY", "true").lower() == "true"
    notify_template_header: str = os.getenv("NOTIFY_TEMPLATE_HEADER", "")
    notify_template_footer: str = os.getenv("NOTIFY_TEMPLATE_FOOTER", "")
    notify_weekend_template_header: str = os.getenv("NOTIFY_WEEKEND_TEMPLATE_HEADER", "")
    notify_weekend_template_footer: str = os.getenv("NOTIFY_WEEKEND_TEMPLATE_FOOTER", "")
    notify_failure_template: str = os.getenv(
        "NOTIFY_FAILURE_TEMPLATE",
        "主渠道发送失败，已尝试降级渠道。请检查 webhook 配置与网络连通性。",
    )
    notify_fallback_channels: str = os.getenv("NOTIFY_FALLBACK_CHANNELS", "feishu,dingtalk")
    notify_alert_enabled: bool = os.getenv("NOTIFY_ALERT_ENABLED", "false").lower() == "true"
    notify_alert_threshold: int = int(os.getenv("NOTIFY_ALERT_THRESHOLD", "3"))
    notify_alert_critical_threshold: int = int(os.getenv("NOTIFY_ALERT_CRITICAL_THRESHOLD", "6"))
    notify_alert_channel: str = os.getenv("NOTIFY_ALERT_CHANNEL", "wecom")
    notify_alert_cooldown_minutes: int = int(os.getenv("NOTIFY_ALERT_COOLDOWN_MINUTES", "60"))
    notify_self_heal_enabled: bool = os.getenv("NOTIFY_SELF_HEAL_ENABLED", "true").lower() == "true"
    notify_self_heal_pause_minutes: int = int(os.getenv("NOTIFY_SELF_HEAL_PAUSE_MINUTES", "30"))
    notify_self_heal_probe_enabled: bool = os.getenv("NOTIFY_SELF_HEAL_PROBE_ENABLED", "true").lower() == "true"
    notify_self_heal_probe_interval_minutes: int = int(os.getenv("NOTIFY_SELF_HEAL_PROBE_INTERVAL_MINUTES", "5"))
    notify_health_alert_enabled: bool = os.getenv("NOTIFY_HEALTH_ALERT_ENABLED", "false").lower() == "true"
    notify_channel_health_alert_enabled: bool = (
        os.getenv("NOTIFY_CHANNEL_HEALTH_ALERT_ENABLED", "false").lower() == "true"
    )
    notify_health_warning_score: float = float(os.getenv("NOTIFY_HEALTH_WARNING_SCORE", "80"))
    notify_health_critical_score: float = float(os.getenv("NOTIFY_HEALTH_CRITICAL_SCORE", "60"))
    notify_health_critical_days: int = int(os.getenv("NOTIFY_HEALTH_CRITICAL_DAYS", "3"))
    notify_alert_suppressed_channels: str = os.getenv("NOTIFY_ALERT_SUPPRESSED_CHANNELS", "")
    auto_create_tables: bool = os.getenv("AUTO_CREATE_TABLES", "false").lower() == "true"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
