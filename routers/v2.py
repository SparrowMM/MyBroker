import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from models.record import DailyRecord
from models.llm_call_log import LLMCallLog
from schemas.record import ProjectDecisionRequest
from services.analyzer import RecordAnalyzer, decode_json_list
from services.llm_client import BailianClient
from services.project_decision import ProjectDecisionEngine
from services.supabase_client import get_supabase_client


router = APIRouter(prefix="/v2", tags=["v2"])
analyzer = RecordAnalyzer()
decision_engine = ProjectDecisionEngine()
llm = BailianClient()
settings = get_settings()


@router.get("/system/health")
def v2_system_health(db: Session = Depends(get_db)):
    db_ok = True
    db_error = ""
    try:
        db.query(DailyRecord.id).limit(1).all()
    except Exception as e:
        db_ok = False
        db_error = str(e)

    supabase_ok = False
    supabase_error = ""
    try:
        client = get_supabase_client(use_service_role=True)
        supabase_ok = client is not None
        if client is None:
            supabase_error = "缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY"
    except Exception as e:
        supabase_error = str(e)

    bailian_ok = bool(settings.bailian_api_key)
    bailian_error = "" if bailian_ok else "缺少 BAILIAN_API_KEY"
    text_ok, text_error = llm.probe_text_model()
    vision_ok, vision_error = llm.probe_vision_model()
    return {
        "db": {"ok": db_ok, "error": db_error},
        "supabase": {"ok": supabase_ok, "error": supabase_error},
        "bailian": {"ok": bailian_ok, "error": bailian_error},
        "llm_text": {"ok": text_ok, "model": settings.bailian_model, "error": text_error},
        "llm_vision": {"ok": vision_ok, "model": settings.bailian_vision_model, "error": vision_error},
    }


@router.get("/llm/logs")
def v2_llm_logs(limit: int = Query(default=30, ge=1, le=200), db: Session = Depends(get_db)):
    rows = (
        db.query(LLMCallLog)
        .order_by(LLMCallLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "scenario": r.scenario,
            "model": r.model,
            "prompt_digest": r.prompt_digest,
            "latency_ms": r.latency_ms,
            "status": r.status,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/records")
def v2_create_record(payload: dict, db: Session = Depends(get_db)):
    record_date = payload.get("record_date")
    if not record_date:
        return {"ok": False, "message": "record_date 必填"}
    try:
        parsed_date = datetime.strptime(str(record_date), "%Y-%m-%d").date()
    except ValueError:
        return {"ok": False, "message": "record_date 格式需为 YYYY-MM-DD"}

    raw_text = str(payload.get("raw_text", ""))
    chat_text = str(payload.get("chat_text", ""))
    screenshot_notes = str(payload.get("screenshot_notes", ""))
    screenshot_paths = payload.get("screenshot_paths", [])
    if not isinstance(screenshot_paths, list):
        screenshot_paths = []
    screenshot_paths = [str(x) for x in screenshot_paths]

    summary, tags = analyzer.analyze_daily(parsed_date, raw_text, chat_text, screenshot_notes)
    record = DailyRecord(
        record_date=parsed_date,
        raw_text=raw_text,
        chat_text=chat_text,
        screenshot_paths_json=json.dumps(screenshot_paths, ensure_ascii=False),
        screenshot_notes=screenshot_notes,
        analysis_summary=summary,
        tags_json=json.dumps(tags, ensure_ascii=False),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "ok": True,
        "record": {
            "id": record.id,
            "record_date": str(record.record_date),
            "analysis_summary": record.analysis_summary,
            "tags": decode_json_list(record.tags_json),
            "screenshot_paths": decode_json_list(record.screenshot_paths_json),
        },
    }


@router.post("/records/markdown-from-image")
async def v2_markdown_from_image(record_date: str, file: UploadFile = File(...)):
    if not settings.bailian_api_key:
        raise HTTPException(status_code=400, detail="缺少 BAILIAN_API_KEY，无法解析本地图片")
    if not settings.bailian_vision_model:
        raise HTTPException(status_code=400, detail="缺少 BAILIAN_VISION_MODEL，无法解析本地图片")
    if not record_date:
        raise HTTPException(status_code=400, detail="record_date 必填")
    try:
        datetime.strptime(str(record_date), "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="record_date 格式需为 YYYY-MM-DD") from exc

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="图片内容为空")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片文件")

    markdown = llm.image_to_markdown(content, file.content_type or "image/png", record_date)
    if not markdown:
        raise HTTPException(
            status_code=500,
            detail=f"AI 图片解析失败，请检查视觉模型可用性（当前: {settings.bailian_vision_model}）与 API Key 权限",
        )
    return {"ok": True, "record_date": record_date, "markdown": markdown}


@router.get("/dashboard")
def v2_dashboard(
    days: int = Query(default=14, ge=1, le=90),
    db: Session = Depends(get_db),
):
    end = date.today()
    records = (
        db.query(DailyRecord)
        .filter(DailyRecord.record_date <= end)
        .order_by(DailyRecord.record_date.desc())
        .limit(days)
        .all()
    )
    return {
        "days": days,
        "total_records": len(records),
        "latest_records": [
            {
                "id": r.id,
                "date": str(r.record_date),
                "summary": r.analysis_summary,
                "tags": decode_json_list(r.tags_json),
            }
            for r in records
        ],
    }


@router.get("/timeline")
def v2_timeline(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
):
    records = (
        db.query(DailyRecord)
        .filter(DailyRecord.record_date >= start_date, DailyRecord.record_date <= end_date)
        .order_by(DailyRecord.record_date.asc())
        .all()
    )
    return [
        {
            "date": str(r.record_date),
            "summary": r.analysis_summary,
            "tags": decode_json_list(r.tags_json),
        }
        for r in records
    ]


@router.get("/reports/weekly")
def v2_weekly_report(
    year: int = Query(...),
    week: int = Query(..., ge=1, le=53),
    db: Session = Depends(get_db),
):
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
    summary, highlights, risks, suggestions = analyzer.summarize_period(
        summaries, tags_list, f"{year}年第{week}周"
    )
    return {
        "period": "weekly",
        "start_date": str(start),
        "end_date": str(end),
        "total_records": len(records),
        "summary": summary,
        "highlights": highlights,
        "risks": risks,
        "suggestions": suggestions,
    }


@router.get("/reports/monthly")
def v2_monthly_report(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
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
    summary, highlights, risks, suggestions = analyzer.summarize_period(
        summaries, tags_list, f"{year}年{month}月"
    )
    return {
        "period": "monthly",
        "start_date": str(start),
        "end_date": str(end),
        "total_records": len(records),
        "summary": summary,
        "highlights": highlights,
        "risks": risks,
        "suggestions": suggestions,
    }


@router.post("/projects/decision")
def v2_project_decision(payload: ProjectDecisionRequest):
    should_create, confidence, suggested_name, reason = decision_engine.evaluate(
        payload.task_description, payload.existing_projects
    )
    return {
        "should_create_project": should_create,
        "confidence": round(confidence, 2),
        "suggested_project_name": suggested_name,
        "reason": reason,
    }
