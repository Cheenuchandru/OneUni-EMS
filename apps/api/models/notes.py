from sqlalchemy import Column, String, Text, DateTime, func
from core.database import Base
from core.uuid7 import generate_uuid7

class LifetimeNote(Base):
    __tablename__ = "lifetime_notes"

    id = Column(String, primary_key=True, default=generate_uuid7)
    user_id = Column(String, nullable=False, index=True)
    author_name = Column(String, nullable=False)
    scope = Column(String, nullable=False, default="individual", index=True) # "individual" | "common"
    title = Column(String, nullable=False)
    category = Column(String, nullable=False, default="bug_fix", index=True) # "bug_fix", "tech_stack", "feature_note", "architecture", "guide"
    bug_description = Column(Text, nullable=True)
    resolution_method = Column(Text, nullable=True)
    tech_stack = Column(String, nullable=True)
    tags = Column(String, nullable=True) # Comma-separated tags
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
