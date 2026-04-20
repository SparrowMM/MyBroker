from datetime import date, datetime
from typing import List

from pydantic import BaseModel, Field


class DailyRecordCreate(BaseModel):
    record_date: date
    raw_text: str = Field(default="")
    chat_text: str = Field(default="")
    screenshot_paths: List[str] = Field(default_factory=list)
    screenshot_notes: str = Field(default="")


class DailyRecordUpdate(BaseModel):
    raw_text: str | None = None
    chat_text: str | None = None
    screenshot_paths: List[str] | None = None
    screenshot_notes: str | None = None


class DailyRecordOut(BaseModel):
    id: int
    record_date: date
    raw_text: str
    chat_text: str
    screenshot_paths: List[str]
    screenshot_notes: str
    analysis_summary: str
    tags: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReportOut(BaseModel):
    period: str
    start_date: date
    end_date: date
    total_records: int
    summary: str
    highlights: List[str]
    risks: List[str]
    suggestions: List[str]


class TrendPoint(BaseModel):
    bucket: str
    records: int
    avg_activity_score: float
    top_tags: List[str]


class DashboardOut(BaseModel):
    start_date: date
    end_date: date
    total_records: int
    active_days: int
    avg_activity_score: float
    top_tags: List[str]
    recent_highlights: List[str]


class ActionItem(BaseModel):
    source_record_id: int
    source_date: date
    content: str
    priority: str


class ActionItemOut(BaseModel):
    id: int
    source_record_id: int
    source_date: date
    content: str
    priority: str
    status: str
    due_date: date | None = None
    notes: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActionItemUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    due_date: date | None = None
    notes: str | None = None


class ActionSyncResult(BaseModel):
    created: int
    skipped: int
    total: int


class ActionStatsOut(BaseModel):
    total: int
    todo: int
    in_progress: int
    done: int
    overdue: int
    done_rate: float


class ReminderItem(BaseModel):
    id: int
    content: str
    priority: str
    status: str
    due_date: date | None = None
    source_date: date


class DailyReminderOut(BaseModel):
    date: date
    summary: str
    urgent_items: List[ReminderItem]
    due_soon_items: List[ReminderItem]
    suggested_actions: List[str]


class NotificationPreviewOut(BaseModel):
    title: str
    content: str
    channel: str


class NotificationSendResponse(BaseModel):
    success: bool
    channel: str
    message: str


class ProjectDecisionRequest(BaseModel):
    task_description: str
    existing_projects: List[str] = Field(default_factory=list)


class ProjectDecisionResponse(BaseModel):
    should_create_project: bool
    confidence: float
    suggested_project_name: str
    reason: str
