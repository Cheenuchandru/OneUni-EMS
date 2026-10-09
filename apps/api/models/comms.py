from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import relationship
from core.database import Base
from core.uuid7 import generate_uuid7

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(String, primary_key=True, default=generate_uuid7)
    author_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    body_md = Column(String, nullable=False)
    pinned = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    author = relationship("User")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=generate_uuid7)
    entity_type = Column(String, nullable=False, index=True)  # project | task
    entity_id = Column(String, nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    body = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    author = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid7)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # announcement | task_assigned | leave_decided | comment
    payload = Column(JSON, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")

class Standup(Base):
    __tablename__ = "standups"

    id = Column(String, primary_key=True, default=generate_uuid7)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    yesterday_work = Column(String, nullable=False)
    today_plan = Column(String, nullable=False)
    blockers = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=generate_uuid7)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    channel = Column(String, default="general", nullable=False, index=True)
    recipient_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    message = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])

class ChatReadStatus(Base):
    __tablename__ = "chat_read_statuses"

    id = Column(String, primary_key=True, default=generate_uuid7)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    target = Column(String, nullable=False, index=True)  # channel:<name> or dm:<user_id>
    last_read_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")

class ChatChannel(Base):
    __tablename__ = "chat_channels"

    id = Column(String, primary_key=True, default=generate_uuid7)
    name = Column(String, nullable=False, unique=True, index=True)
    slug = Column(String, nullable=False, unique=True, index=True)
    description = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    member_ids = Column(JSON, nullable=True)  # List of user IDs granted access
    is_private = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    creator = relationship("User")
