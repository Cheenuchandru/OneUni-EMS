from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from core.database import Base
from core.uuid7 import generate_uuid7

class Role(Base):
    __tablename__ = "roles"
    __table_args__ = {"schema": "auth"} if False else {} # Simplified schema binding for multi-dialect compatibility

    id = Column(String, primary_key=True, default=generate_uuid7)
    name = Column(String, unique=True, nullable=False, index=True) # admin, md, employee
    is_system = Column(Boolean, default=True, nullable=False)

    users = relationship("User", back_populates="role")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid7)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role_id = Column(String, ForeignKey("roles.id"), nullable=False)
    department = Column(String, nullable=True, default="Engineering")
    designation = Column(String, nullable=True, default="Team Member")
    bio = Column(String, nullable=True, default="Agri Platform Innovator & EMS Team Contributor.")
    theme = Column(String, nullable=True, default="emerald")
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    must_change_password = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    role = relationship("Role", back_populates="users")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(String, primary_key=True, default=generate_uuid7)
    role_id = Column(String, ForeignKey("roles.id"), nullable=False)
    permission_key = Column(String, nullable=False, index=True)

    role = relationship("Role", back_populates="permissions")
