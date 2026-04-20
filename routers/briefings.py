from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from models.action_item import ActionItem
from models.record import DailyRecord
from services.analyzer import decode_json_list


router = APIRouter(prefix="/briefings", tags=["briefings"])


@router.get("/morning")
def morning_briefing(db: Session = Depends(get_db)):
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
    high_open = [x for x in open_items if x.priority == "high"][:5]

    tags: list[str] = []
    for r in weekly_records:
        tags.extend(decode_json_list(r.tags_json))
    top_tags = []
    for t in tags:
        if t not in top_tags:
            top_tags.append(t)
    top_tags = top_tags[:3]

    return {
        "date": str(today),
        "yesterday_summary": [x.analysis_summary for x in y_records][:3],
        "this_week_focus_tags": top_tags,
        "open_items_count": len(open_items),
        "top_high_priority_items": [
            {"id": x.id, "content": x.content, "due_date": str(x.due_date) if x.due_date else None}
            for x in high_open
        ],
        "manager_suggestion": "今天先清理高优先级待办，再推进本周核心标签相关事项，晚间补充结果型日志。",
    }
