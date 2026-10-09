from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime, timezone, timedelta
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import User
from models.leave import LeaveRequest, LeaveBalance
from models.calendar import DayStatus
from core.rbac import requires_permission
from middleware.audit import log_audit_event
from core.uuid7 import generate_uuid7

router = APIRouter(prefix="/leave", tags=["Leave Management"])

class ApplyLeaveRequest(BaseModel):
    from_date: date
    to_date: date
    half_day: bool = False
    reason: str

class DecisionRequest(BaseModel):
    note: Optional[str] = None

class LeaveBalanceResponse(BaseModel):
    year: int
    allotted: int
    used: int
    remaining: int

class LeaveResponse(BaseModel):
    id: str
    user_id: str
    user_full_name: str
    from_date: str
    to_date: str
    half_day: bool
    reason: str
    status: str
    decided_by_name: Optional[str] = None
    decided_at: Optional[datetime] = None
    decision_note: Optional[str] = None

def format_leave_response(req: LeaveRequest, user_name: str = "") -> LeaveResponse:
    return LeaveResponse(
        id=req.id,
        user_id=req.user_id,
        user_full_name=user_name or (req.user.full_name if req.user else ""),
        from_date=str(req.from_date),
        to_date=str(req.to_date),
        half_day=req.half_day,
        reason=req.reason,
        status=req.status,
        decided_by_name=req.decider.full_name if req.decider else None,
        decided_at=req.decided_at,
        decision_note=req.decision_note
    )

def get_or_create_balance(user_id: str, year: int, db: Session) -> LeaveBalance:
    balance = db.query(LeaveBalance).filter(LeaveBalance.user_id == user_id, LeaveBalance.year == year).first()
    if not balance:
        balance = LeaveBalance(user_id=user_id, year=year, allotted=18, used=0)
        db.add(balance)
        db.commit()
        db.refresh(balance)
    return balance

@router.post("", response_model=LeaveResponse, status_code=status.HTTP_201_CREATED)
def apply_leave(
    payload: ApplyLeaveRequest,
    current_user: User = Depends(requires_permission("leave.request")),
    db: Session = Depends(get_db)
):
    if payload.to_date < payload.from_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="to_date cannot be before from_date")

    # Check date overlap with existing pending or approved requests
    overlap = db.query(LeaveRequest).filter(
        LeaveRequest.user_id == current_user.id,
        LeaveRequest.status.in_(["pending", "approved"]),
        LeaveRequest.from_date <= payload.to_date,
        LeaveRequest.to_date >= payload.from_date
    ).first()

    if overlap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Leave request overlaps with an existing {overlap.status} request ({overlap.from_date} to {overlap.to_date})"
        )

    new_request = LeaveRequest(
        user_id=current_user.id,
        from_date=payload.from_date,
        to_date=payload.to_date,
        half_day=payload.half_day,
        reason=payload.reason,
        status="pending",
        decided_by=None,
        decided_at=None,
        decision_note=None
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    # Log Audit
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "employee",
        action="leave.apply",
        entity="LeaveRequest",
        entity_id=new_request.id,
        after_state={"from_date": str(payload.from_date), "to_date": str(payload.to_date), "status": "pending"}
    )

    return format_leave_response(new_request, current_user.full_name)


@router.get("/me")
def get_my_leaves(
    current_user: User = Depends(requires_permission("leave.request")),
    db: Session = Depends(get_db)
):
    current_year = datetime.now().year
    balance = get_or_create_balance(current_user.id, current_year, db)

    requests = db.query(LeaveRequest).filter(
        LeaveRequest.user_id == current_user.id
    ).order_by(LeaveRequest.created_at.desc()).all()

    return {
        "balance": LeaveBalanceResponse(
            year=balance.year,
            allotted=balance.allotted,
            used=balance.used,
            remaining=balance.allotted - balance.used
        ),
        "requests": [format_leave_response(r, current_user.full_name) for r in requests]
    }

@router.delete("/{leave_id}", status_code=status.HTTP_200_OK)
def cancel_own_pending_leave(
    leave_id: str,
    current_user: User = Depends(requires_permission("leave.request")),
    db: Session = Depends(get_db)
):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id, LeaveRequest.user_id == current_user.id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending leave requests can be cancelled")

    req.status = "cancelled"
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "employee",
        action="leave.cancel",
        entity="LeaveRequest",
        entity_id=req.id,
        after_state={"status": "cancelled"}
    )

    return {"message": "Leave request cancelled successfully"}

@router.get("/pending", response_model=List[LeaveResponse])
def list_pending_leaves(
    current_user: User = Depends(requires_permission("leave.approve")),
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    pending_list = db.query(LeaveRequest).filter(
        func.lower(LeaveRequest.status) == "pending"
    ).order_by(LeaveRequest.created_at.asc()).all()

    return [format_leave_response(r) for r in pending_list]

@router.post("/{leave_id}/approve", response_model=LeaveResponse)
def approve_leave(
    leave_id: str,
    payload: DecisionRequest,
    current_user: User = Depends(requires_permission("leave.approve")),
    db: Session = Depends(get_db)
):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Leave request is already {req.status}")

    # Calculate days
    days_count = (req.to_date - req.from_date).days + 1
    if req.half_day:
        days_count = 0.5

    # Update request inside single transaction
    now_utc = datetime.now(timezone.utc)
    req.status = "approved"
    req.decided_by = current_user.id
    req.decided_at = now_utc
    req.decision_note = payload.note

    # Update Leave Balance
    balance = get_or_create_balance(req.user_id, req.from_date.year, db)
    balance.used += int(days_count) if not req.half_day else 1

    # Write DayStatus leave rows to sync calendar
    curr_date = req.from_date
    while curr_date <= req.to_date:
        existing_status = db.query(DayStatus).filter(DayStatus.user_id == req.user_id, DayStatus.date == curr_date).first()
        status_val = "leave" if not req.half_day else "half"
        if existing_status:
            existing_status.status = status_val
            existing_status.source = "manual"
        else:
            db.add(DayStatus(id=generate_uuid7(), user_id=req.user_id, date=curr_date, status=status_val, source="manual"))
        curr_date += timedelta(days=1)

    db.commit()
    db.refresh(req)

    # Log Audit
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "md",
        action="leave.approve",
        entity="LeaveRequest",
        entity_id=req.id,
        after_state={"status": "approved", "note": payload.note, "days_used": days_count}
    )

    return format_leave_response(req)

@router.post("/{leave_id}/reject", response_model=LeaveResponse)
def reject_leave(
    leave_id: str,
    payload: DecisionRequest,
    current_user: User = Depends(requires_permission("leave.approve")),
    db: Session = Depends(get_db)
):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Leave request is already {req.status}")

    now_utc = datetime.now(timezone.utc)
    req.status = "rejected"
    req.decided_by = current_user.id
    req.decided_at = now_utc
    req.decision_note = payload.note

    db.commit()
    db.refresh(req)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "md",
        action="leave.reject",
        entity="LeaveRequest",
        entity_id=req.id,
        after_state={"status": "rejected", "note": payload.note}
    )

    return format_leave_response(req)
