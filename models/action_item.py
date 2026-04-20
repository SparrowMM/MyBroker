from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, Integer, Text

from app.database import Base


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    source_record_id = Column(Integer, nullable=False, index=True)
    source_date = Column(Date, nullable=False, index=True)
    content = Column(Text, nullable=False)
    priority = Column(Text, nullable=False, default="medium")
    status = Column(Text, nullable=False, default="todo")
    due_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
