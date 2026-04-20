import json
from collections import Counter
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from models.record import DailyRecord
from schemas.record import (
    ActionItem,
    DailyRecordCreate,
    DailyRecordOut,
    DailyRecordUpdate,
    DashboardOut,
    ReportOut,
    TrendPoint,
)
from services.analyzer import RecordAnalyzer, decode_json_list
from services.agent_bridge import AgentBridge


router = APIRouter(prefix="/records", tags=["records"])
analyzer = RecordAnalyzer()
bridge = AgentBridge()


def _to_schema(record: DailyRecord) -> DailyRecordOut:
    return DailyRecordOut(
        id=record.id,
        record_date=record.record_date,
        raw_text=record.raw_text,
        chat_text=record.chat_text,
        screenshot_paths=decode_json_list(record.screenshot_paths_json),
        screenshot_notes=record.screenshot_notes,
        analysis_summary=record.analysis_summary,
        tags=decode_json_list(record.tags_json),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.post("", response_model=DailyRecordOut)
def create_record(payload: DailyRecordCreate, db: Session = Depends(get_db)):
    summary, tags = analyzer.analyze_daily(
        payload.record_date, payload.raw_text, payload.chat_text, payload.screenshot_notes
    )
    record = DailyRecord(
        record_date=payload.record_date,
        raw_text=payload.raw_text,
        chat_text=payload.chat_text,
        screenshot_paths_json=json.dumps(payload.screenshot_paths, ensure_ascii=False),
        screenshot_notes=payload.screenshot_notes,
        analysis_summary=summary,
        tags_json=json.dumps(tags, ensure_ascii=False),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    bridge.sync_record({"record_id": record.id, "date": str(record.record_date), "summary": summary})
    return _to_schema(record)


@router.get("", response_model=list[DailyRecordOut])
def list_records(
    record_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(DailyRecord).order_by(DailyRecord.record_date.desc())
    if record_date:
        query = query.filter(DailyRecord.record_date == record_date)
    return [_to_schema(x) for x in query.all()]


@router.patch("/{record_id}", response_model=DailyRecordOut)
def update_record(record_id: int, payload: DailyRecordUpdate, db: Session = Depends(get_db)):
    record = db.query(DailyRecord).filter(DailyRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if payload.raw_text is not None:
        record.raw_text = payload.raw_text
    if payload.chat_text is not None:
        record.chat_text = payload.chat_text
    if payload.screenshot_notes is not None:
        record.screenshot_notes = payload.screenshot_notes
    if payload.screenshot_paths is not None:
        record.screenshot_paths_json = json.dumps(payload.screenshot_paths, ensure_ascii=False)

    summary, tags = analyzer.analyze_daily(
        record.record_date, record.raw_text, record.chat_text, record.screenshot_notes
    )
    record.analysis_summary = summary
    record.tags_json = json.dumps(tags, ensure_ascii=False)
    db.commit()
    db.refresh(record)
    return _to_schema(record)


@router.post("/{record_id}/reanalyze", response_model=DailyRecordOut)
def reanalyze_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DailyRecord).filter(DailyRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    summary, tags = analyzer.analyze_daily(
        record.record_date, record.raw_text, record.chat_text, record.screenshot_notes
    )
    record.analysis_summary = summary
    record.tags_json = json.dumps(tags, ensure_ascii=False)
    db.commit()
    db.refresh(record)
    return _to_schema(record)


@router.get("/reports/daily", response_model=ReportOut)
def daily_report(report_date: date = Query(...), db: Session = Depends(get_db)):
    records = db.query(DailyRecord).filter(DailyRecord.record_date == report_date).all()
    summaries = [r.analysis_summary for r in records]
    tags_list = [decode_json_list(r.tags_json) for r in records]
    summary, highlights, risks, suggestions = analyzer.summarize_period(summaries, tags_list, f"{report_date}日")
    return ReportOut(
        period="daily",
        start_date=report_date,
        end_date=report_date,
        total_records=len(records),
        summary=summary,
        highlights=highlights,
        risks=risks,
        suggestions=suggestions,
    )


@router.get("/reports/weekly", response_model=ReportOut)
def weekly_report(year: int = Query(...), week: int = Query(..., ge=1, le=53), db: Session = Depends(get_db)):
    start = date.fromisocalendar(year, week, 1)
    end = start + timedelta(days=6)
    records = (
        db.query(DailyRecord)
        .filter(DailyRecord.record_date >= start, DailyRecord.record_date <= end)
        .order_by(DailyRecord.record_date.asc())
        .all()
    )
    summaries = [r.analysis_summary for r in records]
    tags_list = [decode_json_list(r.tags_json) for r in records]
    summary, highlights, risks, suggestions = analyzer.summarize_period(summaries, tags_list, f"{year}年第{week}周")
    return ReportOut(
        period="weekly",
        start_date=start,
        end_date=end,
        total_records=len(records),
        summary=summary,
        highlights=highlights,
        risks=risks,
        suggestions=suggestions,
    )


@router.get("/reports/monthly", response_model=ReportOut)
def monthly_report(year: int = Query(...), month: int = Query(..., ge=1, le=12), db: Session = Depends(get_db)):
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    records = (
        db.query(DailyRecord)
        .filter(DailyRecord.record_date >= start, DailyRecord.record_date <= end)
        .order_by(DailyRecord.record_date.asc())
        .all()
    )
    summaries = [r.analysis_summary for r in records]
    tags_list = [decode_json_list(r.tags_json) for r in records]
    summary, highlights, risks, suggestions = analyzer.summarize_period(summaries, tags_list, f"{year}年{month}月")
    return ReportOut(
        period="monthly",
        start_date=start,
        end_date=end,
        total_records=len(records),
        summary=summary,
        highlights=highlights,
        risks=risks,
        suggestions=suggestions,
    )


@router.get("/dashboard/overview", response_model=DashboardOut)
def dashboard_overview(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if end_date is None:
        end_date = date.today()
    if start_date is None:
        start_date = end_date - timedelta(days=29)

    records = (
        db.query(DailyRecord)
        .filter(DailyRecord.record_date >= start_date, DailyRecord.record_date <= end_date)
        .order_by(DailyRecord.record_date.asc())
        .all()
    )
    all_tags: list[str] = []
    scores: list[float] = []
    active_days = set()
    for r in records:
        tags = decode_json_list(r.tags_json)
        all_tags.extend(tags)
        active_days.add(r.record_date)
        scores.append(analyzer.estimate_activity_score(r.raw_text, r.chat_text, r.screenshot_notes, tags))

    top_tags = [t for t, _ in Counter(all_tags).most_common(5)]
    recent_highlights = [r.analysis_summary for r in records[-5:]]
    avg_activity = round(sum(scores) / len(scores), 2) if scores else 0.0

    return DashboardOut(
        start_date=start_date,
        end_date=end_date,
        total_records=len(records),
        active_days=len(active_days),
        avg_activity_score=avg_activity,
        top_tags=top_tags,
        recent_highlights=recent_highlights,
    )


@router.get("/dashboard/trends", response_model=list[TrendPoint])
def dashboard_trends(
    days: int = Query(default=30, ge=7, le=180),
    db: Session = Depends(get_db),
):
    end = date.today()
    start = end - timedelta(days=days - 1)
    records = (
        db.query(DailyRecord)
        .filter(DailyRecord.record_date >= start, DailyRecord.record_date <= end)
        .order_by(DailyRecord.record_date.asc())
        .all()
    )

    bucket_map: dict[str, list[DailyRecord]] = {}
    for r in records:
        iso_year, iso_week, _ = r.record_date.isocalendar()
        key = f"{iso_year}-W{iso_week:02d}"
        bucket_map.setdefault(key, []).append(r)

    points: list[TrendPoint] = []
    for bucket, bucket_records in bucket_map.items():
        bucket_tags: list[str] = []
        scores: list[float] = []
        for r in bucket_records:
            tags = decode_json_list(r.tags_json)
            bucket_tags.extend(tags)
            scores.append(analyzer.estimate_activity_score(r.raw_text, r.chat_text, r.screenshot_notes, tags))
        points.append(
            TrendPoint(
                bucket=bucket,
                records=len(bucket_records),
                avg_activity_score=round(sum(scores) / len(scores), 2) if scores else 0.0,
                top_tags=[t for t, _ in Counter(bucket_tags).most_common(3)],
            )
        )
    return points


@router.get("/action-items", response_model=list[ActionItem])
def extract_action_items(
    days: int = Query(default=14, ge=1, le=90),
    db: Session = Depends(get_db),
):
    end = date.today()
    start = end - timedelta(days=days - 1)
    records = (
        db.query(DailyRecord)
        .filter(DailyRecord.record_date >= start, DailyRecord.record_date <= end)
        .order_by(DailyRecord.record_date.desc())
        .all()
    )

    action_items: list[ActionItem] = []
    for r in records:
        merged = "\n".join([r.raw_text, r.chat_text, r.screenshot_notes]).strip()
        for item in analyzer.extract_action_items(merged):
            priority = "high" if any(x in item for x in ["截止", "尽快", "今天", "本周"]) else "medium"
            action_items.append(
                ActionItem(
                    source_record_id=r.id,
                    source_date=r.record_date,
                    content=item,
                    priority=priority,
                )
            )
    return action_items[:50]
