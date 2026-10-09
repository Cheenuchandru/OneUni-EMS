from sqlalchemy import Column, String, DateTime, Date, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from core.database import Base
from core.uuid7 import generate_uuid7

class Punch(Base):
    __tablename__ = "punches"
    __table_args__ = (
        UniqueConstraint("user_id", "day", "punch_type", name="uq_user_day_punchtype"),
    )

    id = Column(String, primary_key=True, default=generate_uuid7)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    punch_type = Column(String, nullable=False)  # in | out
    claimed_at = Column(DateTime(timezone=True), nullable=False)
    server_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Device capture fields
    ip = Column(String, nullable=False)
    user_agent = Column(String, nullable=False)
    device_type = Column(String, nullable=False)  # mobile | tablet | desktop
    os_name = Column(String, nullable=False)
    os_version = Column(String, nullable=False)
    browser = Column(String, nullable=False)
    
    # Attendance details
    work_mode = Column(String, nullable=False, default="office")  # office | wfh | half
    day = Column(Date, nullable=False, index=True)  # Calendar date derived from claimed_at

    user = relationship("User")


class AttendanceRegularization(Base):
    __tablename__ = "attendance_regularizations"

    id = Column(String, primary_key=True, default=generate_uuid7)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    day = Column(Date, nullable=False)
    punch_type = Column(String, nullable=False)  # in | out
    requested_time = Column(DateTime(timezone=True), nullable=False)
    work_mode = Column(String, default="office", nullable=False)
    reason = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending | approved | rejected

    decided_by = Column(String, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decision_note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    decider = relationship("User", foreign_keys=[decided_by])

