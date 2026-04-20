from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.config import get_settings
from models.action_item import ActionItem
from models.notification_log import NotificationLog
from models.record import DailyRecord
from services.analyzer import decode_json_list
from services.notifier import WebhookNotifier


settings = get_settings()
notifier = WebhookNotifier()
_CHANNEL_PAUSE_UNTIL: dict[str, datetime] = {}


def _is_weekend_day(today: date) -> bool:
    return today.weekday() >= 5


def _resolve_template_header_footer(today: date) -> tuple[str, str]:
    if _is_weekend_day(today):
        header = settings.notify_weekend_template_header or settings.notify_template_header
        footer = settings.notify_weekend_template_footer or settings.notify_template_footer
        return header, footer
    return settings.notify_template_header, settings.notify_template_footer


def _fallback_channels(primary: str) -> list[str]:
    configured = [x.strip() for x in settings.notify_fallback_channels.split(",") if x.strip()]
    unique: list[str] = []
    for x in configured:
        if x != primary and x not in unique:
            unique.append(x)
    return unique


def get_alert_suppressed_channels() -> list[str]:
    return list(get_alert_suppression_map().keys())


def get_alert_suppression_map() -> dict[str, str | None]:
    """
    解析抑制配置：
    - wecom
    - feishu@2026-05-01T12:00:00
    """
    now = datetime.utcnow()
    result: dict[str, str | None] = {}
    raw_items = [x.strip() for x in settings.notify_alert_suppressed_channels.split(",") if x.strip()]
    for raw in raw_items:
        if "@" not in raw:
            result[raw] = None
            continue
        channel, until_raw = raw.split("@", 1)
        channel = channel.strip()
        until_raw = until_raw.strip()
        if not channel:
            continue
        try:
            until = datetime.fromisoformat(until_raw)
            if until > now:
                result[channel] = until.isoformat()
        except ValueError:
            # 非法时间格式按永久抑制处理，避免配置错误导致告警风暴
            result[channel] = None
    return result


def _is_alert_suppressed(channel: str) -> bool:
    return channel in get_alert_suppression_map()


def classify_failure_reason(message: str) -> str:
    lowered = (message or "").lower()
    if "webhook 未配置" in message:
        return "config_error"
    if "urlerror" in lowered:
        return "network_error"
    if "httperror" in lowered or "http " in lowered:
        return "http_error"
    return "other"


def get_paused_channels() -> dict[str, str]:
    now = datetime.utcnow()
    active = {k: v for k, v in _CHANNEL_PAUSE_UNTIL.items() if v > now}
    _CHANNEL_PAUSE_UNTIL.clear()
    _CHANNEL_PAUSE_UNTIL.update(active)
    return {k: v.isoformat() for k, v in _CHANNEL_PAUSE_UNTIL.items()}


def _is_channel_paused(channel: str) -> bool:
    until = _CHANNEL_PAUSE_UNTIL.get(channel)
    if not until:
        return False
    if until <= datetime.utcnow():
        _CHANNEL_PAUSE_UNTIL.pop(channel, None)
        return False
    return True


def _pause_channel(channel: str):
    pause_minutes = max(1, settings.notify_self_heal_pause_minutes)
    _CHANNEL_PAUSE_UNTIL[channel] = datetime.utcnow() + timedelta(minutes=pause_minutes)


def _resume_channel(channel: str):
    _CHANNEL_PAUSE_UNTIL.pop(channel, None)


def resolve_webhook(channel: str) -> str:
    mapping = {
        "wecom": settings.webhook_wecom_url,
        "feishu": settings.webhook_feishu_url,
        "dingtalk": settings.webhook_dingtalk_url,
    }
    return mapping.get(channel, "")


def probe_paused_channels() -> dict[str, list[str]]:
    now = datetime.utcnow()
    paused = [k for k, until in _CHANNEL_PAUSE_UNTIL.items() if until > now]
    recovered: list[str] = []
    still_paused: list[str] = []
    for channel in paused:
        webhook_url = resolve_webhook(channel)
        if not webhook_url:
            still_paused.append(channel)
            continue
        success, _, _ = notifier.post_markdown(
            webhook_url=webhook_url,
            title="MyBroker 渠道恢复探测",
            content="渠道恢复探测成功，已自动恢复正常发送。",
        )
        if success:
            _resume_channel(channel)
            recovered.append(channel)
        else:
            still_paused.append(channel)
    return {"recovered": recovered, "still_paused": still_paused}


def build_daily_message(db: Session) -> tuple[str, str]:
    today = date.today()
    yesterday = today - timedelta(days=1)
    week_start = today - timedelta(days=today.weekday())

    y_records = db.query(DailyRecord).filter(DailyRecord.record_date == yesterday).all()
    weekly_records = (
        db.query(DailyRecord)
        .filter(DailyRecord.record_date >= week_start, DailyRecord.record_date <= today)
        .all()
    )
    open_items = db.query(ActionItem).filter(ActionItem.status != "done").all()
    urgent = [x for x in open_items if x.priority == "high" or (x.due_date is not None and x.due_date <= today)]

    tags: list[str] = []
    for r in weekly_records:
        tags.extend(decode_json_list(r.tags_json))
    top_tags: list[str] = []
    for t in tags:
        if t not in top_tags:
            top_tags.append(t)

    yesterday_summary = [x.analysis_summary for x in y_records][:2]
    urgent_lines = [f"- [#{x.id}] {x.content}" for x in urgent[:5]]

    title = f"MyBroker 每日经营提醒 {today}"
    body = "\n".join(
        [
            f"**昨日总结**：{'；'.join(yesterday_summary) if yesterday_summary else '昨日暂无记录'}",
            f"**本周重心**：{'、'.join(top_tags[:3]) if top_tags else '待形成'}",
            f"**未完成事项**：{len(open_items)} 条（紧急 {len(urgent)} 条）",
            "**紧急待办 TOP5**：",
            "\n".join(urgent_lines) if urgent_lines else "- 暂无",
            "",
            "建议：先处理高优先级与已到期事项，再推进本周重心工作。",
        ]
    )
    header, footer = _resolve_template_header_footer(today)
    sections = []
    if header:
        sections.append(header)
    sections.append(body)
    if footer:
        sections.append(footer)
    content = "\n\n".join(sections)
    return title, content


def _send_to_channel_with_retry(channel: str, title: str, content: str) -> tuple[bool, str, int]:
    if _is_channel_paused(channel):
        return False, "channel_paused_by_self_heal", 0
    webhook_url = resolve_webhook(channel)
    if not webhook_url:
        return False, "webhook 未配置", 0
    attempts = 0
    success = False
    message = "unknown"
    max_attempts = max(1, settings.notify_retry_times + 1)
    for _ in range(max_attempts):
        attempts += 1
        success, message = notifier.post_markdown(webhook_url=webhook_url, title=title, content=content)
        if success:
            break
    return success, message, attempts


def send_daily_with_retry(db: Session, channel: str) -> tuple[bool, str, int, str, str, str]:
    title, content = build_daily_message(db)

    total_attempts = 0
    success, message, attempts = _send_to_channel_with_retry(channel=channel, title=title, content=content)
    total_attempts += attempts
    used_channel = channel
    if success:
        return True, message, total_attempts, title, content, used_channel

    if settings.notify_self_heal_enabled and classify_failure_reason(message) == "config_error":
        _pause_channel(channel)
        message = f"{message} | self_heal_pause={channel}"

    for fallback in _fallback_channels(channel):
        fb_success, fb_message, fb_attempts = _send_to_channel_with_retry(
            channel=fallback,
            title=title,
            content=content,
        )
        total_attempts += fb_attempts
        if fb_success:
            used_channel = fallback
            return True, f"{message} | fallback({fallback})={fb_message}", total_attempts, title, content, used_channel
        message = f"{message} | fallback({fallback})={fb_message}"

    failure_hint = settings.notify_failure_template
    return False, f"{message} | {failure_hint}", total_attempts, title, content, used_channel


def log_notification(
    db: Session,
    channel: str,
    title: str,
    content: str,
    success: bool,
    response_message: str,
    attempts: int,
):
    db.add(
        NotificationLog(
            channel=channel,
            title=title,
            content=content[:4000],
            success=1 if success else 0,
            response_message=response_message[:500],
            attempts=attempts,
        )
    )
    db.commit()


def maybe_send_failure_alert(db: Session, source_channel: str):
    if not settings.notify_alert_enabled:
        return

    threshold = max(1, settings.notify_alert_threshold)
    critical_threshold = max(threshold, settings.notify_alert_critical_threshold)
    recent = (
        db.query(NotificationLog)
        .filter(NotificationLog.channel == source_channel)
        .order_by(NotificationLog.id.desc())
        .limit(max(critical_threshold, 20))
        .all()
    )

    consecutive_failures = 0
    latest_error = "unknown"
    for row in recent:
        if row.success == 1:
            break
        consecutive_failures += 1
        if latest_error == "unknown" and row.response_message:
            latest_error = row.response_message[:200]

    if consecutive_failures < threshold:
        return

    alert_level = "critical" if consecutive_failures >= critical_threshold else "warning"
    alert_channel = settings.notify_alert_channel
    alert_log_channel = f"alert:{alert_channel}:{alert_level}"
    latest_alert = (
        db.query(NotificationLog)
        .filter(NotificationLog.channel == alert_log_channel, NotificationLog.success == 1)
        .order_by(NotificationLog.id.desc())
        .first()
    )
    if latest_alert:
        cooldown = timedelta(minutes=max(1, settings.notify_alert_cooldown_minutes))
        if datetime.utcnow() - latest_alert.created_at < cooldown:
            return

    title = f"MyBroker 推送故障{alert_level.upper()}告警 {date.today()}"
    content = (
        f"检测到渠道 `{source_channel}` 连续失败 {consecutive_failures} 次（级别: {alert_level}）。\n\n"
        f"最近错误：{latest_error}\n\n"
        "请检查 webhook 配置、权限与网络可达性。"
    )
    success, message, attempts = _send_to_channel_with_retry(alert_channel, title, content)
    log_notification(
        db=db,
        channel=alert_log_channel,
        title=title,
        content=content,
        success=success,
        response_message=message,
        attempts=attempts if attempts > 0 else 1,
    )


def _is_delivery_channel(channel: str) -> bool:
    return not (channel.startswith("alert:") or channel.startswith("self_heal_recovered:"))


def _calc_health_score(success_rate: float, avg_attempts: float, failed: int) -> float:
    return round(max(0.0, min(100.0, success_rate - (avg_attempts - 1) * 8 - failed * 0.8)), 2)


def maybe_send_health_alert(db: Session):
    if not settings.notify_health_alert_enabled:
        return

    days = max(1, settings.notify_health_critical_days)
    start = datetime.utcnow().date() - timedelta(days=days - 1)
    logs = (
        db.query(NotificationLog)
        .filter(NotificationLog.created_at >= datetime.combine(start, datetime.min.time()))
        .order_by(NotificationLog.created_at.asc())
        .all()
    )

    daily: dict[str, dict[str, int]] = {}
    for row in logs:
        if not _is_delivery_channel(row.channel):
            continue
        day = row.created_at.date().isoformat()
        bucket = daily.setdefault(day, {"total": 0, "success": 0, "attempts_sum": 0})
        bucket["total"] += 1
        bucket["success"] += 1 if row.success == 1 else 0
        bucket["attempts_sum"] += max(1, row.attempts)

    # 最近一天分数用于 warning；最近连续 N 天用于 critical
    today_key = datetime.utcnow().date().isoformat()
    today_data = daily.get(today_key, {"total": 0, "success": 0, "attempts_sum": 0})
    today_total = today_data["total"]
    today_success = today_data["success"]
    today_failed = max(0, today_total - today_success)
    today_success_rate = round((today_success / today_total) * 100, 2) if today_total else 100.0
    today_avg_attempts = round((today_data["attempts_sum"] / today_total), 2) if today_total else 1.0
    today_score = _calc_health_score(today_success_rate, today_avg_attempts, today_failed)

    sorted_days = sorted(daily.keys())[-days:]
    low_days = 0
    for day in sorted_days:
        d = daily[day]
        total = d["total"]
        success = d["success"]
        failed = max(0, total - success)
        success_rate = round((success / total) * 100, 2) if total else 100.0
        avg_attempts = round((d["attempts_sum"] / total), 2) if total else 1.0
        score = _calc_health_score(success_rate, avg_attempts, failed)
        if score < settings.notify_health_critical_score:
            low_days += 1

    level = None
    if len(sorted_days) >= days and low_days >= days:
        level = "critical"
    elif today_score < settings.notify_health_warning_score:
        level = "warning"
    if not level:
        return

    alert_log_channel = f"alert:health:{level}"
    latest_alert = (
        db.query(NotificationLog)
        .filter(NotificationLog.channel == alert_log_channel, NotificationLog.success == 1)
        .order_by(NotificationLog.id.desc())
        .first()
    )
    if latest_alert:
        cooldown = timedelta(minutes=max(1, settings.notify_alert_cooldown_minutes))
        if datetime.utcnow() - latest_alert.created_at < cooldown:
            return

    title = f"MyBroker 健康分{level.upper()}告警 {date.today()}"
    content = (
        f"当前健康分：{today_score}\n"
        f"warning 阈值：{settings.notify_health_warning_score}\n"
        f"critical 阈值：{settings.notify_health_critical_score}\n"
        f"critical 连续天数要求：{days}\n"
        f"最近低于 critical 阈值天数：{low_days}"
    )
    success, message, attempts = _send_to_channel_with_retry(settings.notify_alert_channel, title, content)
    log_notification(
        db=db,
        channel=alert_log_channel,
        title=title,
        content=content,
        success=success,
        response_message=message,
        attempts=attempts if attempts > 0 else 1,
    )


def maybe_send_channel_health_alert(db: Session):
    if not settings.notify_channel_health_alert_enabled:
        return

    days = max(1, settings.notify_health_critical_days)
    start = datetime.utcnow().date() - timedelta(days=days - 1)
    logs = (
        db.query(NotificationLog)
        .filter(NotificationLog.created_at >= datetime.combine(start, datetime.min.time()))
        .order_by(NotificationLog.created_at.asc())
        .all()
    )

    channel_daily: dict[str, dict[str, dict[str, int]]] = {}
    for row in logs:
        if not _is_delivery_channel(row.channel):
            continue
        day = row.created_at.date().isoformat()
        bucket = channel_daily.setdefault(row.channel, {}).setdefault(day, {"total": 0, "success": 0, "attempts_sum": 0})
        bucket["total"] += 1
        bucket["success"] += 1 if row.success == 1 else 0
        bucket["attempts_sum"] += max(1, row.attempts)

    today_key = datetime.utcnow().date().isoformat()
    for channel, daily in channel_daily.items():
        if _is_alert_suppressed(channel):
            continue
        today_data = daily.get(today_key, {"total": 0, "success": 0, "attempts_sum": 0})
        t_total = today_data["total"]
        t_success = today_data["success"]
        t_failed = max(0, t_total - t_success)
        t_success_rate = round((t_success / t_total) * 100, 2) if t_total else 100.0
        t_avg_attempts = round((today_data["attempts_sum"] / t_total), 2) if t_total else 1.0
        today_score = _calc_health_score(t_success_rate, t_avg_attempts, t_failed)

        sorted_days = sorted(daily.keys())[-days:]
        low_days = 0
        for day in sorted_days:
            d = daily[day]
            total = d["total"]
            success = d["success"]
            failed = max(0, total - success)
            success_rate = round((success / total) * 100, 2) if total else 100.0
            avg_attempts = round((d["attempts_sum"] / total), 2) if total else 1.0
            score = _calc_health_score(success_rate, avg_attempts, failed)
            if score < settings.notify_health_critical_score:
                low_days += 1

        level = None
        if len(sorted_days) >= days and low_days >= days:
            level = "critical"
        elif today_score < settings.notify_health_warning_score:
            level = "warning"
        if not level:
            continue

        alert_log_channel = f"alert:channel_health:{channel}:{level}"
        latest_alert = (
            db.query(NotificationLog)
            .filter(NotificationLog.channel == alert_log_channel, NotificationLog.success == 1)
            .order_by(NotificationLog.id.desc())
            .first()
        )
        if latest_alert:
            cooldown = timedelta(minutes=max(1, settings.notify_alert_cooldown_minutes))
            if datetime.utcnow() - latest_alert.created_at < cooldown:
                continue

        title = f"MyBroker 渠道健康分{level.upper()}告警 {date.today()}"
        content = (
            f"渠道：{channel}\n"
            f"当前健康分：{today_score}\n"
            f"warning 阈值：{settings.notify_health_warning_score}\n"
            f"critical 阈值：{settings.notify_health_critical_score}\n"
            f"critical 连续天数要求：{days}\n"
            f"最近低于 critical 阈值天数：{low_days}"
        )
        success, message, attempts = _send_to_channel_with_retry(settings.notify_alert_channel, title, content)
        log_notification(
            db=db,
            channel=alert_log_channel,
            title=title,
            content=content,
            success=success,
            response_message=message,
            attempts=attempts if attempts > 0 else 1,
        )
