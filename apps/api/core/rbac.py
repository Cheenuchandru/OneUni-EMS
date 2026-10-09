import time
from typing import Dict, Set, Callable
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import User, Role, RolePermission
from core.security import decode_access_token

# In-memory permission cache (role_id -> (timestamp, Set[permission_keys]))
_permission_cache: Dict[str, tuple[float, Set[str]]] = {}
CACHE_TTL_SECONDS = 60.0

def invalidate_role_permission_cache(role_id: str = None):
    """Invalidate permission cache for a specific role or clear all."""
    if role_id:
        _permission_cache.pop(role_id, None)
    else:
        _permission_cache.clear()

def get_role_permissions(role_id: str, db: Session) -> Set[str]:
    """Retrieve role permissions with 60-second in-memory caching."""
    now = time.time()
    if role_id in _permission_cache:
        cached_at, permissions = _permission_cache[role_id]
        if now - cached_at < CACHE_TTL_SECONDS:
            return permissions

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        return set()

    # Query role_permissions table
    perms = db.query(RolePermission.permission_key).filter(RolePermission.role_id == role_id).all()
    perm_set = {p[0] for p in perms}

    # Cache result
    _permission_cache[role_id] = (now, perm_set)
    return perm_set

def get_current_active_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("ems_jwt")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required"
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token"
        )
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found"
        )
    return user

def requires_permission(permission_key: str):
    """
    FastAPI route dependency ensuring current user holds the required permission key.
    Admin role (with '*') automatically bypasses individual permission checks.
    """
    def permission_checker(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)) -> User:
        if not current_user.role_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role not assigned")
        
        role_permissions = get_role_permissions(current_user.role_id, db)

        # Admin wildcard '*' or explicit permission key check
        if "*" in role_permissions or permission_key in role_permissions:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied. Required permission: '{permission_key}'"
        )
    return permission_checker
