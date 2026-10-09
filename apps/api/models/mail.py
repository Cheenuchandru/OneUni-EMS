from sqlalchemy import Column, String, Boolean, Integer, DateTime, JSON, func
from core.database import Base
from core.uuid7 import generate_uuid7

class MailRoutingRule(Base):
    __tablename__ = "mail_routing_rules"

    id = Column(String, primary_key=True, default=generate_uuid7)
    event_type = Column(String, nullable=False, index=True)  # punch.in | punch.out | leave.requested | leave.decided | eod.missing
    recipient_type = Column(String, nullable=False)  # role | user | email
    recipient_value = Column(String, nullable=False)  # e.g. "md", "user_id_123", "boss@company.com"
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MailOutbox(Base):
    __tablename__ = "mail_outbox"

    id = Column(String, primary_key=True, default=generate_uuid7)
    event_type = Column(String, nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    to_emails = Column(JSON, nullable=False, default=[])
    status = Column(String, default="pending", nullable=False, index=True)  # pending | sent | failed
    attempts = Column(Integer, default=0, nullable=False)
    last_error = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
