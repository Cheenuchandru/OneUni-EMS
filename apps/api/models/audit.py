from sqlalchemy import Column, String, DateTime, JSON, func
from core.database import Base
from core.uuid7 import generate_uuid7

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(String, primary_key=True, default=generate_uuid7)
    actor_id = Column(String, nullable=False, index=True)
    actor_role = Column(String, nullable=False)
    action = Column(String, nullable=False, index=True) # e.g. role.create, user.create, punch.edit
    entity = Column(String, nullable=False, index=True) # e.g. User, Role, Punch
    entity_id = Column(String, nullable=True)
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
