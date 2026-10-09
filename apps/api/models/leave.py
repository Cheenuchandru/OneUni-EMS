from sqlalchemy import Column, String, Date, Boolean, Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from core.database import Base
from core.uuid7 import generate_uuid7

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(String, primary_key=True, default=generate_uuid7)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    half_day = Column(Boolean, default=False, nullable=False)
    leave_type = Column(String, default="casual", nullable=False)  # casual | sick | earned | wfh
    reason = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending | approved | rejected | cancelled
    
    decided_by = Column(String, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decision_note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    decider = relationship("User", foreign_keys=[decided_by])


class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    __table_args__ = (
        UniqueConstraint("user_id", "year", name="uq_user_year_leavebalance"),
    )

    id = Column(String, primary_key=True, default=generate_uuid7)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    allotted = Column(Integer, default=18, nullable=False)
    used = Column(Integer, default=0, nullable=False)

    user = relationship("User")
