from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, Integer, Text

from app.database import Base


class DailyRecord(Base):
    __tablename__ = "daily_records"

    id = Column(Integer, primary_key=True, index=True)
    record_date = Column(Date, nullable=False, index=True)
    raw_text = Column(Text, nullable=False, default="")
    chat_text = Column(Text, nullable=False, default="")
    screenshot_paths_json = Column(Text, nullable=False, default="[]")
    screenshot_notes = Column(Text, nullable=False, default="")
    analysis_summary = Column(Text, nullable=False, default="")
    tags_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
