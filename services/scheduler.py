from apscheduler.schedulers.background import BackgroundScheduler
from datetime import date

from app.config import get_settings
from app.database import SessionLocal
from services.notification_service import (
    maybe_send_channel_health_alert,
    log_notification,
    maybe_send_failure_alert,
    maybe_send_health_alert,
    probe_paused_channels,
    send_daily_with_retry,
)


settings = get_settings()
scheduler: BackgroundScheduler | None = None


def _auto_push_daily_job():
    if settings.auto_push_weekdays_only and date.today().weekday() >= 5:
        return
    db = SessionLocal()
    try:
        success, message, attempts, title, content, used_channel = send_daily_with_retry(
            db, settings.auto_push_daily_channel
        )
        log_notification(
            db=db,
            channel=used_channel,
            title=title if title else "auto push",
            content=content if content else "",
            success=success,
            response_message=message,
            attempts=attempts if attempts > 0 else 1,
        )
        maybe_send_failure_alert(db=db, source_channel=used_channel)
        maybe_send_health_alert(db=db)
        maybe_send_channel_health_alert(db=db)
    finally:
        db.close()


def run_auto_push_daily_once() -> tuple[bool, str]:
    _auto_push_daily_job()
    return True, "auto daily push job executed"


def _self_heal_probe_job():
    db = SessionLocal()
    try:
        result = probe_paused_channels()
        for channel in result["recovered"]:
            log_notification(
                db=db,
                channel=f"self_heal_recovered:{channel}",
                title="MyBroker 渠道自动恢复",
                content=f"渠道 {channel} 探测成功并恢复发送。",
                success=True,
                response_message="probe recovered",
                attempts=1,
            )
    finally:
        db.close()


def run_self_heal_probe_once() -> tuple[bool, str]:
    _self_heal_probe_job()
    return True, "self-heal probe job executed"


def run_health_alert_check_once() -> tuple[bool, str]:
    db = SessionLocal()
    try:
        maybe_send_health_alert(db=db)
        maybe_send_channel_health_alert(db=db)
    finally:
        db.close()
    return True, "health alert check executed"


def start_scheduler():
    global scheduler
    if scheduler is not None:
        return
    if not settings.auto_push_daily_enabled or not settings.reminder_push_enabled:
        return

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _auto_push_daily_job,
        trigger="cron",
        hour=settings.auto_push_daily_hour,
        minute=settings.auto_push_daily_minute,
        id="auto_push_daily",
        replace_existing=True,
    )
    if settings.notify_self_heal_enabled and settings.notify_self_heal_probe_enabled:
        scheduler.add_job(
            _self_heal_probe_job,
            trigger="interval",
            minutes=max(1, settings.notify_self_heal_probe_interval_minutes),
            id="self_heal_probe",
            replace_existing=True,
        )
    scheduler.start()


def stop_scheduler():
    global scheduler
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        scheduler = None
