from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, Text

from app.database import Base


class LLMCallLog(Base):
    __tablename__ = "llm_call_logs"

    id = Column(Integer, primary_key=True, index=True)
    scenario = Column(Text, nullable=False, default="summary")
    model = Column(Text, nullable=False, default="")
    prompt_digest = Column(Text, nullable=False, default="")
    latency_ms = Column(Integer, nullable=False, default=0)
    status = Column(Text, nullable=False, default="unknown")
    error_message = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
