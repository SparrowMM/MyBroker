from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, Text

from app.database import Base


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    channel = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    content = Column(Text, nullable=False, default="")
    success = Column(Integer, nullable=False, default=0)
    response_message = Column(Text, nullable=False, default="")
    attempts = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
