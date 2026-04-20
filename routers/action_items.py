from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database import get_db
from models.action_item import ActionItem
from models.record import DailyRecord
from schemas.record import (
    ActionItemOut,
    ActionItemUpdate,
    ActionStatsOut,
    ActionSyncResult,
    DailyReminderOut,
    ReminderItem,
)
from services.analyzer import RecordAnalyzer


router = APIRouter(prefix="/action-items", tags=["action-items"])
analyzer = RecordAnalyzer()


@router.post("/sync", response_model=ActionSyncResult)
def sync_action_items(days: int = Query(default=14, ge=1, le=90), db: Session = Depends(get_db)):
    end = date.today()
    start = end - timedelta(days=days - 1)
    records = (
        db.query(DailyRecord)
        .filter(DailyRecord.record_date >= start, DailyRecord.record_date <= end)
        .order_by(DailyRecord.record_date.desc())
        .all()
    )

    created = 0
    skipped = 0
    for r in records:
        merged = "\n".join([r.raw_text, r.chat_text, r.screenshot_notes]).strip()
        extracted = analyzer.extract_action_items(merged)
        for item in extracted:
            exists = (
                db.query(ActionItem)
                .filter(and_(ActionItem.source_record_id == r.id, ActionItem.content == item))
                .first()
            )
            if exists:
                skipped += 1
                continue
            priority = "high" if any(x in item for x in ["截止", "尽快", "今天", "本周"]) else "medium"
            db.add(
                ActionItem(
                    source_record_id=r.id,
                    source_date=r.record_date,
                    content=item,
                    priority=priority,
                    status="todo",
                )
            )
            created += 1

    db.commit()
    return ActionSyncResult(created=created, skipped=skipped, total=created + skipped)


@router.get("", response_model=list[ActionItemOut])
def list_action_items(
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(ActionItem).order_by(ActionItem.created_at.desc())
    if status:
        query = query.filter(ActionItem.status == status)
    if priority:
        query = query.filter(ActionItem.priority == priority)
    return query.all()


@router.patch("/{item_id}", response_model=ActionItemOut)
def update_action_item(item_id: int, payload: ActionItemUpdate, db: Session = Depends(get_db)):
    item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")

    if payload.status is not None:
        item.status = payload.status
    if payload.priority is not None:
        item.priority = payload.priority
    if payload.due_date is not None:
        item.due_date = payload.due_date
    if payload.notes is not None:
        item.notes = payload.notes
    db.commit()
    db.refresh(item)
    return item


@router.get("/stats", response_model=ActionStatsOut)
def action_stats(db: Session = Depends(get_db)):
    items = db.query(ActionItem).all()
    total = len(items)
    todo = len([x for x in items if x.status == "todo"])
    in_progress = len([x for x in items if x.status == "in_progress"])
    done = len([x for x in items if x.status == "done"])
    today = date.today()
    overdue = len([x for x in items if x.due_date is not None and x.due_date < today and x.status != "done"])
    done_rate = round((done / total) * 100, 2) if total else 0.0
    return ActionStatsOut(
        total=total,
        todo=todo,
        in_progress=in_progress,
        done=done,
        overdue=overdue,
        done_rate=done_rate,
    )


@router.get("/reminders/daily", response_model=DailyReminderOut)
def daily_reminder(db: Session = Depends(get_db)):
    today = date.today()
    soon = today + timedelta(days=2)
    open_items = db.query(ActionItem).filter(ActionItem.status != "done").order_by(ActionItem.priority.asc()).all()

    urgent = [
        x
        for x in open_items
        if x.priority == "high" or (x.due_date is not None and x.due_date <= today)
    ]
    due_soon = [x for x in open_items if x.due_date is not None and today < x.due_date <= soon]

    urgent_out = [
        ReminderItem(
            id=x.id,
            content=x.content,
            priority=x.priority,
            status=x.status,
            due_date=x.due_date,
            source_date=x.source_date,
        )
        for x in urgent[:10]
    ]
    due_soon_out = [
        ReminderItem(
            id=x.id,
            content=x.content,
            priority=x.priority,
            status=x.status,
            due_date=x.due_date,
            source_date=x.source_date,
        )
        for x in due_soon[:10]
    ]

    suggested_actions: list[str] = []
    if urgent_out:
        suggested_actions.append("先处理高优先级与已到期事项，建议上午完成前3项。")
    if due_soon_out:
        suggested_actions.append("对未来48小时到期事项做时间分配，避免集中堆积。")
    if not suggested_actions:
        suggested_actions.append("当前待办节奏健康，可优先推进长期价值事项。")

    summary = f"今日未完成事项 {len(open_items)} 条，其中紧急 {len(urgent_out)} 条，48小时内到期 {len(due_soon_out)} 条。"
    return DailyReminderOut(
        date=today,
        summary=summary,
        urgent_items=urgent_out,
        due_soon_items=due_soon_out,
        suggested_actions=suggested_actions,
    )
