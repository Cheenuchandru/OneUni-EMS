from sqlalchemy import Column, String, Date, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from core.database import Base
from core.uuid7 import generate_uuid7

class CalendarDay(Base):
    __tablename__ = "calendar_days"

    date = Column(Date, primary_key=True)
    day_type = Column(String, nullable=False, default="working")  # working | weekend | holiday
    label = Column(String, nullable=True)  # e.g. "Republic Day"

class DayStatus(Base):
    __tablename__ = "calendar_day_status"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date_status"),
    )

    id = Column(String, primary_key=True, default=generate_uuid7)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(String, nullable=False)  # present | absent | leave | holiday | half | wfh
    source = Column(String, nullable=False, default="auto")  # auto | manual
    marked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
