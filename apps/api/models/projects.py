from sqlalchemy import Column, String, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from core.database import Base
from core.uuid7 import generate_uuid7

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid7)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False, index=True)
    description = Column(String, nullable=True)
    status = Column(String, default="active", nullable=False)  # planned | active | on_hold | done
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    creator = relationship("User")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=generate_uuid7)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    assignee_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String, default="todo", nullable=False)  # todo | in_progress | review | done
    priority = Column(String, default="med", nullable=False)  # low | med | high
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User")


class ProjectStatusUpdate(Base):
    __tablename__ = "project_status_updates"

    id = Column(String, primary_key=True, default=generate_uuid7)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    note = Column(String, nullable=True)
    old_status = Column(String, nullable=True)
    new_status = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
