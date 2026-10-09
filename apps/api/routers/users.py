import os, uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import User, Role
from core.rbac import requires_permission, get_role_permissions, get_current_active_user
from core.security import hash_password
from seed import generate_secure_temp_password
from middleware.audit import log_audit_event

router = APIRouter(prefix="/users", tags=["Users Management"])

class CreateUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    role_name: Optional[str] = "employee"
    role_id: Optional[str] = None
    password: Optional[str] = None

class UserItemResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role_id: Optional[str] = None
    role_name: str
    is_active: bool
    is_archived: bool = False
    must_change_password: bool
    designation: Optional[str] = None
    avatar_url: Optional[str] = None

class CreateUserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    initial_password: str
    must_change_password: bool

@router.get("/team", response_model=List[UserItemResponse])
def list_team_members(
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    users = db.query(User).filter(
        User.is_active == True,
        (User.is_archived.is_(False) | User.is_archived.is_(None))
    ).order_by(User.full_name.asc()).all()

    return [
        UserItemResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role_id=u.role_id,
            role_name=u.role.name if u.role else "employee",
            is_active=u.is_active,
            is_archived=getattr(u, 'is_archived', False) or False,
            must_change_password=u.must_change_password,
            designation=getattr(u, 'designation', 'Team Member'),
            avatar_url=getattr(u, 'avatar_url', None)
        ) for u in users
    ]

@router.get("", response_model=List[UserItemResponse])
def list_users(
    include_archived: bool = True,
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if not include_archived:
        query = query.filter(User.is_archived.is_(False) | User.is_archived.is_(None))

    users = query.order_by(User.created_at.desc()).all()
    return [
        UserItemResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role_id=u.role_id,
            role_name=u.role.name if u.role else "employee",
            is_active=u.is_active,
            is_archived=getattr(u, 'is_archived', False) or False,
            must_change_password=u.must_change_password,
            designation=getattr(u, 'designation', 'Team Member'),
            avatar_url=getattr(u, 'avatar_url', None)
        ) for u in users
    ]

@router.post("", response_model=CreateUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserRequest,
    current_user: User = Depends(requires_permission("users.create_non_admin")),
    db: Session = Depends(get_db)
):
    # Determine target role
    role = None
    if payload.role_id:
        role = db.query(Role).filter(Role.id == payload.role_id).first()
    elif payload.role_name:
        role = db.query(Role).filter(Role.name == payload.role_name.lower().strip()).first()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified role not found"
        )

    # Allow Admin and MD roles full authority to create any system user role
    user_perms = get_role_permissions(current_user.role_id, db) if current_user.role_id else set()
    is_admin_or_md = "*" in user_perms or (current_user.role and current_user.role.name in ["admin", "md"])
    
    if role.name in ["admin", "md"] and not is_admin_or_md:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only Admin and MD roles can create executive user accounts"
        )

    email_clean = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{email_clean}' is already registered"
        )

    temp_password = payload.password if payload.password else generate_secure_temp_password()
    new_user = User(
        email=email_clean,
        full_name=payload.full_name,
        password_hash=hash_password(temp_password),
        role_id=role.id,
        is_active=True,
        must_change_password=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "md",
        action="user.create",
        entity="User",
        entity_id=new_user.id,
        after_state={"email": new_user.email, "role": role.name, "full_name": new_user.full_name}
    )

    return CreateUserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=role.name,
        initial_password=temp_password,
        must_change_password=True
    )


@router.get("/{user_id}/full-details")
def get_user_full_details(
    user_id: str,
    current_user: User = Depends(requires_permission("attendance.view_all")),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    from models.leave import LeaveBalance, LeaveRequest
    from models.attendance import Punch
    from models.eod import EODReport
    from models.projects import Task
    from datetime import datetime

    current_year = datetime.now().year

    # 1. Leave Balance & Requests
    balance = db.query(LeaveBalance).filter(LeaveBalance.user_id == user_id, LeaveBalance.year == current_year).first()
    leave_requests = db.query(LeaveRequest).filter(LeaveRequest.user_id == user_id).order_by(LeaveRequest.created_at.desc()).limit(20).all()

    # 2. Recent Punches
    punches = db.query(Punch).filter(Punch.user_id == user_id).order_by(Punch.claimed_at.desc()).limit(30).all()

    # 3. EOD Reports
    eods = db.query(EODReport).filter(EODReport.user_id == user_id).order_by(EODReport.date.desc()).limit(20).all()

    # 4. Assigned Tasks
    tasks = db.query(Task).filter(Task.assignee_id == user_id).order_by(Task.created_at.desc()).all()

    return {
        "profile": {
            "id": target_user.id,
            "full_name": target_user.full_name,
            "email": target_user.email,
            "role": target_user.role.name if target_user.role else "employee",
            "is_active": target_user.is_active,
            "is_archived": bool(getattr(target_user, 'is_archived', False)),
            "designation": getattr(target_user, 'designation', 'Team Member'),
            "avatar_url": getattr(target_user, 'avatar_url', None),
            "created_at": target_user.created_at
        },
        "leave_balance": {
            "year": current_year,
            "allotted": balance.allotted if balance else 18,
            "used": balance.used if balance else 0,
            "remaining": (balance.allotted - balance.used) if balance else 18
        },
        "leave_requests": [
            {
                "id": l.id,
                "from_date": str(l.from_date),
                "to_date": str(l.to_date),
                "half_day": l.half_day,
                "reason": l.reason,
                "status": l.status,
                "created_at": l.created_at
            } for l in leave_requests
        ],
        "punches": [
            {
                "id": p.id,
                "punch_type": p.punch_type,
                "claimed_at": p.claimed_at,
                "work_mode": p.work_mode,
                "day": str(p.day),
                "device_type": p.device_type,
                "ip": p.ip
            } for p in punches
        ],
        "eod_reports": [
            {
                "id": e.id,
                "date": str(e.date),
                "body_md": e.body_md,
                "submitted_at": e.submitted_at,
                "reviewed_by": e.reviewed_by_name if hasattr(e, "reviewed_by_name") else None
            } for e in eods
        ],
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "due_date": str(t.due_date) if t.due_date else None,
                "project_name": t.project.name if t.project else "General"
            } for t in tasks
        ]
    }


class UpdateUserStatusRequest(BaseModel):
    is_active: bool

class ResetPasswordRequest(BaseModel):
    new_password: str

@router.patch("/{user_id}/status")
def update_user_status(
    user_id: str,
    payload: UpdateUserStatusRequest,
    current_user: User = Depends(requires_permission("users.create_non_admin")),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    target_user.is_active = payload.is_active
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "admin",
        action="user.toggle_status",
        entity="User",
        entity_id=target_user.id,
        after_state={"is_active": target_user.is_active, "user_email": target_user.email}
    )

    return {"message": "User status updated successfully", "is_active": target_user.is_active}


@router.patch("/{user_id}/archive")
def archive_user(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    caller_role = current_user.role.name if current_user.role else "employee"
    if caller_role not in ["admin", "md"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only Admin and MD roles can archive employee accounts."
        )

    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot archive your own active account."
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target_user.is_archived = True
    target_user.is_active = False
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=caller_role,
        action="user.archive",
        entity="User",
        entity_id=target_user.id,
        after_state={"is_archived": True, "is_active": False, "user_email": target_user.email}
    )

    return {"message": f"Employee '{target_user.full_name}' has been archived.", "is_archived": True}

@router.patch("/{user_id}/unarchive")
def unarchive_user(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    caller_role = current_user.role.name if current_user.role else "employee"
    if caller_role not in ["admin", "md"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only Admin and MD roles can unarchive employee accounts."
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target_user.is_archived = False
    target_user.is_active = True
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=caller_role,
        action="user.unarchive",
        entity="User",
        entity_id=target_user.id,
        after_state={"is_archived": False, "is_active": True, "user_email": target_user.email}
    )

    return {"message": f"Employee '{target_user.full_name}' has been unarchived and restored.", "is_archived": False}

@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    caller_role = current_user.role.name if current_user.role else "employee"
    if caller_role not in ["admin", "md"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only Admin and MD roles can remove employee accounts."
        )

    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own active account."
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    emp_name = target_user.full_name
    emp_email = target_user.email

    try:
        db.delete(target_user)
        db.commit()
    except Exception as e:
        db.rollback()
        # Fallback to archived + inactive status if foreign key constraint exists
        target_user.is_archived = True
        target_user.is_active = False
        db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=caller_role,
        action="user.delete",
        entity="User",
        entity_id=user_id,
        after_state={"deleted_email": emp_email, "deleted_name": emp_name}
    )

    return {"message": f"Employee '{emp_name}' has been removed successfully."}


@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    payload: ResetPasswordRequest,
    current_user: User = Depends(requires_permission("users.create_non_admin")),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    target_user.password_hash = hash_password(payload.new_password)
    target_user.must_change_password = True
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "admin",
        action="user.reset_password",
        entity="User",
        entity_id=target_user.id,
        after_state={"user_email": target_user.email}
    )

    return {"message": "Password reset successfully"}

class UpdateProfileRequest(BaseModel):
    full_name: str
    designation: Optional[str] = None
    bio: Optional[str] = None
    theme: Optional[str] = None

@router.put("/me")
def update_my_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    fn_clean = payload.full_name.strip()
    if not fn_clean:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Full name cannot be empty")

    current_user.full_name = fn_clean
    if payload.designation is not None:
        current_user.designation = payload.designation.strip()
    if payload.bio is not None and hasattr(current_user, 'bio'):
        current_user.bio = payload.bio.strip()
    if payload.theme is not None and hasattr(current_user, 'theme'):
        current_user.theme = payload.theme.strip()

    db.commit()
    db.refresh(current_user)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "user",
        action="user.update_profile",
        entity="User",
        entity_id=current_user.id,
        after_state={"full_name": current_user.full_name, "designation": getattr(current_user, 'designation', None)}
    )

    return {
        "message": "Profile updated successfully",
        "full_name": current_user.full_name,
        "email": current_user.email,
        "designation": getattr(current_user, 'designation', None),
        "bio": getattr(current_user, 'bio', None),
        "theme": getattr(current_user, 'theme', None),
        "avatar_url": getattr(current_user, 'avatar_url', None)
    }


@router.post("/me/avatar")
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload profile media image for the current user."""
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Allowed types: JPG, PNG, WEBP, GIF, SVG"
        )

    avatars_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "avatars")
    os.makedirs(avatars_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1] or ".png"
    unique_filename = f"avatar_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(avatars_dir, unique_filename)

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 5MB")

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    avatar_url = f"/api/uploads/avatars/{unique_filename}"
    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "user",
        action="user.upload_avatar",
        entity="User",
        entity_id=current_user.id,
        after_state={"avatar_url": avatar_url}
    )

    return {
        "message": "Profile avatar uploaded successfully",
        "avatar_url": avatar_url
    }



