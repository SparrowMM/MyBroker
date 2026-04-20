from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.config import get_settings
from app.database import get_db
from models.notification_log import NotificationLog
from schemas.record import NotificationPreviewOut, NotificationSendResponse
from services.notification_service import (
    build_daily_message,
    classify_failure_reason,
    get_alert_suppressed_channels,
    get_alert_suppression_map,
    get_paused_channels,
    log_notification,
    maybe_send_channel_health_alert,
    maybe_send_failure_alert,
    maybe_send_health_alert,
    resolve_webhook,
    send_daily_with_retry,
)
from services.scheduler import run_auto_push_daily_once, run_health_alert_check_once, run_self_heal_probe_once


router = APIRouter(prefix="/notifications", tags=["notifications"])
settings = get_settings()


@router.get("/preview/daily", response_model=NotificationPreviewOut)
def preview_daily_notification(
    channel: str = Query(default="wecom"),
    db: Session = Depends(get_db),
):
    title, content = build_daily_message(db)
    return NotificationPreviewOut(title=title, content=content, channel=channel)


@router.post("/send/daily", response_model=NotificationSendResponse)
def send_daily_notification(
    channel: str = Query(default="wecom"),
    db: Session = Depends(get_db),
):
    if not settings.reminder_push_enabled:
        raise HTTPException(status_code=400, detail="REMINDER_PUSH_ENABLED 未开启")

    webhook_url = resolve_webhook(channel)
    if not webhook_url:
        raise HTTPException(status_code=400, detail=f"{channel} webhook 未配置")

    success, message, attempts, title, content, used_channel = send_daily_with_retry(db, channel)
    log_notification(
        db=db,
        channel=used_channel,
        title=title,
        content=content,
        success=success,
        response_message=message,
        attempts=attempts,
    )
    maybe_send_failure_alert(db=db, source_channel=used_channel)
    maybe_send_health_alert(db=db)
    maybe_send_channel_health_alert(db=db)
    return NotificationSendResponse(success=success, channel=used_channel, message=message)


@router.get("/logs")
def list_notification_logs(limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db)):
    logs = db.query(NotificationLog).order_by(NotificationLog.id.desc()).limit(limit).all()
    return [
        {
            "id": x.id,
            "channel": x.channel,
            "title": x.title,
            "success": bool(x.success),
            "attempts": x.attempts,
            "response_message": x.response_message,
            "created_at": x.created_at,
        }
        for x in logs
    ]


@router.get("/settings")
def notification_settings():
    return {
        "reminder_push_enabled": settings.reminder_push_enabled,
        "auto_push_daily_enabled": settings.auto_push_daily_enabled,
        "auto_push_daily_channel": settings.auto_push_daily_channel,
        "auto_push_daily_time": f"{settings.auto_push_daily_hour:02d}:{settings.auto_push_daily_minute:02d}",
        "auto_push_weekdays_only": settings.auto_push_weekdays_only,
        "notify_retry_times": settings.notify_retry_times,
        "notify_fallback_channels": [x.strip() for x in settings.notify_fallback_channels.split(",") if x.strip()],
        "notify_alert_enabled": settings.notify_alert_enabled,
        "notify_alert_threshold": settings.notify_alert_threshold,
        "notify_alert_critical_threshold": settings.notify_alert_critical_threshold,
        "notify_alert_channel": settings.notify_alert_channel,
        "notify_alert_cooldown_minutes": settings.notify_alert_cooldown_minutes,
        "notify_self_heal_enabled": settings.notify_self_heal_enabled,
        "notify_self_heal_pause_minutes": settings.notify_self_heal_pause_minutes,
        "notify_self_heal_probe_enabled": settings.notify_self_heal_probe_enabled,
        "notify_self_heal_probe_interval_minutes": settings.notify_self_heal_probe_interval_minutes,
        "notify_health_alert_enabled": settings.notify_health_alert_enabled,
        "notify_channel_health_alert_enabled": settings.notify_channel_health_alert_enabled,
        "notify_health_warning_score": settings.notify_health_warning_score,
        "notify_health_critical_score": settings.notify_health_critical_score,
        "notify_health_critical_days": settings.notify_health_critical_days,
        "notify_alert_suppressed_channels": get_alert_suppressed_channels(),
        "notify_alert_suppressed_channels_with_expiry": get_alert_suppression_map(),
        "paused_channels": get_paused_channels(),
        "has_wecom_webhook": bool(settings.webhook_wecom_url),
        "has_feishu_webhook": bool(settings.webhook_feishu_url),
        "has_dingtalk_webhook": bool(settings.webhook_dingtalk_url),
        "has_weekend_template": bool(
            settings.notify_weekend_template_header or settings.notify_weekend_template_footer
        ),
    }


@router.post("/run/auto-daily")
def run_auto_daily_job_now():
    success, message = run_auto_push_daily_once()
    return {"success": success, "message": message}


@router.get("/failure-stats")
def failure_stats(hours: int = Query(default=24, ge=1, le=720), db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(hours=hours)
    logs = (
        db.query(NotificationLog)
        .filter(NotificationLog.success == 0, NotificationLog.created_at >= since)
        .order_by(NotificationLog.id.desc())
        .all()
    )
    by_reason = {
        "config_error": 0,
        "network_error": 0,
        "http_error": 0,
        "other": 0,
    }
    by_channel: dict[str, int] = {}
    for row in logs:
        reason = classify_failure_reason(row.response_message)
        by_reason[reason] = by_reason.get(reason, 0) + 1
        by_channel[row.channel] = by_channel.get(row.channel, 0) + 1
    return {
        "hours": hours,
        "total_failures": len(logs),
        "by_reason": by_reason,
        "by_channel": by_channel,
        "sample_latest_errors": [x.response_message for x in logs[:5]],
    }


@router.get("/self-heal/state")
def self_heal_state():
    return {
        "notify_self_heal_enabled": settings.notify_self_heal_enabled,
        "notify_self_heal_pause_minutes": settings.notify_self_heal_pause_minutes,
        "paused_channels": get_paused_channels(),
    }


@router.post("/self-heal/probe")
def run_self_heal_probe_now():
    success, message = run_self_heal_probe_once()
    return {"success": success, "message": message, "paused_channels": get_paused_channels()}


@router.post("/health-alert/check")
def run_health_alert_check_now():
    success, message = run_health_alert_check_once()
    return {"success": success, "message": message}


@router.get("/alerts/suppressed-channels")
def suppressed_channels():
    return {
        "suppressed_channels": get_alert_suppressed_channels(),
        "suppressed_channels_with_expiry": get_alert_suppression_map(),
    }


def _is_delivery_channel(channel: str) -> bool:
    return not (
        channel.startswith("alert:")
        or channel.startswith("self_heal_recovered:")
    )


def _calc_health_score(success_rate: float, avg_attempts: float, failed: int) -> float:
    return round(max(0.0, min(100.0, success_rate - (avg_attempts - 1) * 8 - failed * 0.8)), 2)


@router.get("/health-score")
def notification_health_score(hours: int = Query(default=168, ge=1, le=2160), db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(hours=hours)
    logs = (
        db.query(NotificationLog)
        .filter(NotificationLog.created_at >= since)
        .order_by(NotificationLog.id.desc())
        .all()
    )

    per_channel: dict[str, dict] = {}
    recovered_count = 0
    for row in logs:
        if row.channel.startswith("self_heal_recovered:"):
            recovered_count += 1
            continue
        if not _is_delivery_channel(row.channel):
            continue
        bucket = per_channel.setdefault(
            row.channel,
            {
                "channel": row.channel,
                "total": 0,
                "success": 0,
                "failed": 0,
                "attempts_sum": 0,
            },
        )
        bucket["total"] += 1
        bucket["success"] += 1 if row.success == 1 else 0
        bucket["failed"] += 0 if row.success == 1 else 1
        bucket["attempts_sum"] += max(1, row.attempts)

    channel_cards = []
    total_msgs = 0
    total_success = 0
    total_attempts = 0
    for _, data in per_channel.items():
        total = data["total"]
        success = data["success"]
        failed = data["failed"]
        avg_attempts = round(data["attempts_sum"] / total, 2) if total else 0.0
        success_rate = round((success / total) * 100, 2) if total else 0.0
        channel_cards.append(
            {
                "channel": data["channel"],
                "health_score": _calc_health_score(success_rate, avg_attempts, failed),
                "success_rate": success_rate,
                "avg_attempts": avg_attempts,
                "total_messages": total,
                "failed_messages": failed,
            }
        )
        total_msgs += total
        total_success += success
        total_attempts += data["attempts_sum"]

    overall_success_rate = round((total_success / total_msgs) * 100, 2) if total_msgs else 0.0
    overall_avg_attempts = round(total_attempts / total_msgs, 2) if total_msgs else 0.0
    overall_health_score = _calc_health_score(overall_success_rate, overall_avg_attempts, total_msgs - total_success)

    channel_cards.sort(key=lambda x: x["health_score"], reverse=True)
    return {
        "hours": hours,
        "overall_health_score": overall_health_score,
        "overall_success_rate": overall_success_rate,
        "overall_avg_attempts": overall_avg_attempts,
        "self_heal_recovered_count": recovered_count,
        "channels": channel_cards,
    }


@router.get("/health-score/trends")
def notification_health_score_trends(days: int = Query(default=30, ge=7, le=180), db: Session = Depends(get_db)):
    end = datetime.utcnow().date()
    start = end - timedelta(days=days - 1)
    logs = (
        db.query(NotificationLog)
        .filter(NotificationLog.created_at >= datetime.combine(start, datetime.min.time()))
        .order_by(NotificationLog.created_at.asc())
        .all()
    )

    buckets: dict[str, dict] = {}
    recovered_daily: dict[str, int] = {}
    for row in logs:
        day = row.created_at.date().isoformat()
        if row.channel.startswith("self_heal_recovered:"):
            recovered_daily[day] = recovered_daily.get(day, 0) + 1
            continue
        if not _is_delivery_channel(row.channel):
            continue
        bucket = buckets.setdefault(day, {"total": 0, "success": 0, "attempts_sum": 0})
        bucket["total"] += 1
        bucket["success"] += 1 if row.success == 1 else 0
        bucket["attempts_sum"] += max(1, row.attempts)

    series = []
    for i in range(days):
        day = (start + timedelta(days=i)).isoformat()
        total = buckets.get(day, {}).get("total", 0)
        success = buckets.get(day, {}).get("success", 0)
        attempts_sum = buckets.get(day, {}).get("attempts_sum", 0)
        failed = max(0, total - success)
        success_rate = round((success / total) * 100, 2) if total else 0.0
        avg_attempts = round((attempts_sum / total), 2) if total else 0.0
        health_score = _calc_health_score(success_rate, avg_attempts, failed) if total else 0.0
        series.append(
            {
                "date": day,
                "health_score": health_score,
                "success_rate": success_rate,
                "avg_attempts": avg_attempts,
                "total_messages": total,
                "failed_messages": failed,
                "self_heal_recovered_count": recovered_daily.get(day, 0),
            }
        )

    return {"days": days, "start_date": start.isoformat(), "end_date": end.isoformat(), "series": series}
