from sqlalchemy import Column, String, Date, Boolean, Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from core.database import Base
from core.uuid7 import generate_uuid7

class EODTemplate(Base):
    __tablename__ = "eod_templates"

    id = Column(String, primary_key=True, default=generate_uuid7)
    name = Column(String, nullable=False)
    body_md = Column(String, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class EODReport(Base):
    __tablename__ = "eod_reports"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date_eod"),
    )

    id = Column(String, primary_key=True, default=generate_uuid7)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    template_id = Column(String, ForeignKey("eod_templates.id"), nullable=True)
    body_md = Column(String, nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    locked = Column(Boolean, default=False, nullable=False)
    reviewed_by = Column(String, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(String, nullable=True)
    rating = Column(Integer, nullable=True)  # 1 to 5 star rating

    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    template = relationship("EODTemplate")

