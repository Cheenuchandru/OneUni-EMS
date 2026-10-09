from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Set
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import Role, User, RolePermission
from core.permissions import PERMISSIONS_REGISTRY
from core.rbac import requires_permission, invalidate_role_permission_cache
from middleware.audit import log_audit_event

router = APIRouter(prefix="/roles", tags=["Role Management"])

class PermissionItem(BaseModel):
    key: str

class RoleResponse(BaseModel):
    id: str
    name: str
    is_system: bool
    permissions: List[str]

class CreateRoleRequest(BaseModel):
    name: str
    permissions: List[str]

class UpdatePermissionsRequest(BaseModel):
    permissions: List[str]

class AssignRoleRequest(BaseModel):
    user_id: str
    role_id: str

@router.get("/permissions", response_model=List[str])
def list_available_permissions(current_user: User = Depends(requires_permission("roles.manage"))):
    """List canonical registry of all permission keys available in EMS."""
    return PERMISSIONS_REGISTRY

@router.get("", response_model=List[RoleResponse])
def list_roles(
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    """List all system and custom roles along with assigned permission keys."""
    roles = db.query(Role).all()
    result = []
    for r in roles:
        perms = [p.permission_key for p in r.permissions]
        result.append(RoleResponse(id=r.id, name=r.name, is_system=r.is_system, permissions=perms))
    return result

@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_custom_role(
    payload: CreateRoleRequest,
    current_user: User = Depends(requires_permission("roles.manage")),
    db: Session = Depends(get_db)
):
    role_name = payload.name.lower().strip()
    existing = db.query(Role).filter(Role.name == role_name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role '{role_name}' already exists")

    # Validate permission keys
    invalid_keys = [k for k in payload.permissions if k != "*" and k not in PERMISSIONS_REGISTRY]
    if invalid_keys:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permission keys: {invalid_keys}"
        )

    new_role = Role(name=role_name, is_system=False)
    db.add(new_role)
    db.flush()

    for perm_key in payload.permissions:
        db.add(RolePermission(role_id=new_role.id, permission_key=perm_key))

    db.commit()
    db.refresh(new_role)

    # Invalidate permission cache
    invalidate_role_permission_cache(new_role.id)

    # Log Audit Event
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "admin",
        action="role.create",
        entity="Role",
        entity_id=new_role.id,
        after_state={"name": new_role.name, "permissions": payload.permissions}
    )

    perms = [p.permission_key for p in new_role.permissions]
    return RoleResponse(id=new_role.id, name=new_role.name, is_system=new_role.is_system, permissions=perms)

@router.post("/{role_id}/clone", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def clone_role(
    role_id: str,
    new_name: str,
    current_user: User = Depends(requires_permission("roles.manage")),
    db: Session = Depends(get_db)
):
    source_role = db.query(Role).filter(Role.id == role_id).first()
    if not source_role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source role not found")

    target_name = new_name.lower().strip()
    if db.query(Role).filter(Role.name == target_name).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role '{target_name}' already exists")

    cloned_role = Role(name=target_name, is_system=False)
    db.add(cloned_role)
    db.flush()

    source_perms = [p.permission_key for p in source_role.permissions]
    for perm_key in source_perms:
        db.add(RolePermission(role_id=cloned_role.id, permission_key=perm_key))

    db.commit()
    db.refresh(cloned_role)

    # Audit log
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "admin",
        action="role.clone",
        entity="Role",
        entity_id=cloned_role.id,
        after_state={"name": cloned_role.name, "source_role": source_role.name, "permissions": source_perms}
    )

    return RoleResponse(id=cloned_role.id, name=cloned_role.name, is_system=cloned_role.is_system, permissions=source_perms)

@router.put("/{role_id}/permissions", response_model=RoleResponse)
def update_role_permissions(
    role_id: str,
    payload: UpdatePermissionsRequest,
    current_user: User = Depends(requires_permission("roles.manage")),
    db: Session = Depends(get_db)
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    if role.is_system and role.name == "admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System Admin role permissions cannot be edited")

    invalid_keys = [k for k in payload.permissions if k != "*" and k not in PERMISSIONS_REGISTRY]
    if invalid_keys:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid permission keys: {invalid_keys}")

    before_perms = [p.permission_key for p in role.permissions]

    # Delete old permissions and add new
    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
    for perm_key in payload.permissions:
        db.add(RolePermission(role_id=role_id, permission_key=perm_key))

    db.commit()
    db.refresh(role)

    # Invalidate permission cache
    invalidate_role_permission_cache(role_id)

    # Audit log
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "admin",
        action="role.update_permissions",
        entity="Role",
        entity_id=role.id,
        before_state={"permissions": before_perms},
        after_state={"permissions": payload.permissions}
    )

    new_perms = [p.permission_key for p in role.permissions]
    return RoleResponse(id=role.id, name=role.name, is_system=role.is_system, permissions=new_perms)

@router.post("/assign", status_code=status.HTTP_200_OK)
def assign_user_role(
    payload: AssignRoleRequest,
    current_user: User = Depends(requires_permission("roles.manage")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    old_role_id = user.role_id
    user.role_id = role.id
    db.commit()

    # Invalidate cache for user's old & new roles
    invalidate_role_permission_cache(old_role_id)
    invalidate_role_permission_cache(role.id)

    # Audit log
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "admin",
        action="user.assign_role",
        entity="User",
        entity_id=user.id,
        before_state={"role_id": old_role_id},
        after_state={"role_id": role.id, "role_name": role.name}
    )

    return {"message": f"Assigned user {user.email} to role {role.name}"}
