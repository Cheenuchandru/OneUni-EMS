from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import User
from models.attendance import Punch
from models.calendar import DayStatus
from core.uuid7 import generate_uuid7
from core.rbac import requires_permission
from core.device import parse_device_info
from middleware.audit import log_audit_event

router = APIRouter(prefix="/attendance", tags=["Attendance Immutability Engine"])

class PunchRequest(BaseModel):
    punch_type: str  # in | out
    claimed_at: datetime
    work_mode: str = "office"  # office | wfh | half

class AdminPatchPunchRequest(BaseModel):
    reason: str
    claimed_at: Optional[datetime] = None
    work_mode: Optional[str] = None

class PunchResponse(BaseModel):
    id: str
    user_id: str
    user_full_name: str
    punch_type: str
    claimed_at: datetime
    server_at: datetime
    gap_minutes: float
    work_mode: str
    day: str
    ip: str
    device_type: str
    os_name: str
    os_version: str
    browser: str

def format_punch_response(punch: Punch, user_name: str = "") -> PunchResponse:
    # Handle naive datetime vs aware datetime comparison
    c_at = punch.claimed_at.replace(tzinfo=timezone.utc) if punch.claimed_at.tzinfo is None else punch.claimed_at
    s_at = punch.server_at.replace(tzinfo=timezone.utc) if punch.server_at.tzinfo is None else punch.server_at
    gap = round(abs((s_at - c_at).total_seconds()) / 60.0, 1)

    return PunchResponse(
        id=punch.id,
        user_id=punch.user_id,
        user_full_name=user_name or (punch.user.full_name if punch.user else ""),
        punch_type=punch.punch_type,
        claimed_at=c_at,
        server_at=s_at,
        gap_minutes=gap,
        work_mode=punch.work_mode,
        day=str(punch.day),
        ip=punch.ip,
        device_type=punch.device_type,
        os_name=punch.os_name,
        os_version=punch.os_version,
        browser=punch.browser,
    )

@router.post("/punch", response_model=PunchResponse, status_code=status.HTTP_201_CREATED)
def record_punch(
    payload: PunchRequest,
    request: Request,
    current_user: User = Depends(requires_permission("attendance.punch")),
    db: Session = Depends(get_db)
):
    punch_type = payload.punch_type.lower().strip()
    if punch_type not in ["in", "out"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="punch_type must be 'in' or 'out'")

    work_mode = payload.work_mode.lower().strip()
    if work_mode not in ["office", "wfh", "half"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="work_mode must be 'office', 'wfh', or 'half'")

    # Extract calendar date from claimed_at
    claimed_at_utc = payload.claimed_at.replace(tzinfo=timezone.utc) if payload.claimed_at.tzinfo is None else payload.claimed_at
    punch_day = claimed_at_utc.date()

    # 1. Enforce max 1 punch in and 1 punch out per user per day
    existing_same_type = db.query(Punch).filter(
        Punch.user_id == current_user.id,
        Punch.day == punch_day,
        Punch.punch_type == punch_type
    ).first()

    if existing_same_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have already recorded a Punch '{punch_type.upper()}' for {punch_day}"
        )

    # 2. Cannot punch out without punch in on the same day
    if punch_type == "out":
        punch_in_exists = db.query(Punch).filter(
            Punch.user_id == current_user.id,
            Punch.day == punch_day,
            Punch.punch_type == "in"
        ).first()
        if not punch_in_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot Punch OUT without a recorded Punch IN for {punch_day}"
            )

    # 3. Derive Device & IP server-side
    device_info = parse_device_info(request)

    # Create immutable punch
    now_server = datetime.now(timezone.utc)
    new_punch = Punch(
        user_id=current_user.id,
        punch_type=punch_type,
        claimed_at=claimed_at_utc,
        server_at=now_server,
        ip=device_info["ip"],
        user_agent=device_info["user_agent"],
        device_type=device_info["device_type"],
        os_name=device_info["os_name"],
        os_version=device_info["os_version"],
        browser=device_info["browser"],
        work_mode=work_mode,
        day=punch_day
    )

    db.add(new_punch)
    
    # Upsert calendar DayStatus on punch record so employee calendar updates immediately
    from models.calendar import CalendarDay
    cal_day = db.query(CalendarDay).filter(CalendarDay.date == punch_day).first()
    is_holiday_or_weekend = (cal_day and cal_day.day_type in ["holiday", "weekend"]) or (punch_day.weekday() in [5, 6]) or ((punch_day.month, punch_day.day) in [(1,1),(1,26),(5,1),(8,15),(10,2),(10,24),(11,12),(1,14),(12,25)])

    if is_holiday_or_weekend:
        cal_status_val = "ot"
    else:
        cal_status_val = "wfh" if work_mode == "wfh" else ("half" if work_mode == "half" else "present")

    existing_ds = db.query(DayStatus).filter(DayStatus.user_id == current_user.id, DayStatus.date == punch_day).first()
    if existing_ds:
        if existing_ds.source != "manual":  # Don't overwrite manual admin override
            existing_ds.status = cal_status_val
            existing_ds.source = "auto"
    else:
        db.add(DayStatus(id=generate_uuid7(), user_id=current_user.id, date=punch_day, status=cal_status_val, source="auto"))

    db.commit()
    db.refresh(new_punch)

    # Audit log
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "employee",
        action=f"punch.{punch_type}",
        entity="Punch",
        entity_id=new_punch.id,
        after_state={
            "punch_type": punch_type,
            "claimed_at": claimed_at_utc.isoformat(),
            "work_mode": work_mode,
            "device": device_info["device_type"],
            "ip": device_info["ip"]
        }
    )

    # Emit Transactional Mail Event to Outbox
    from core.mailer import emit_mail_event
    emit_mail_event(
        db=db,
        event_type=f"punch.{punch_type}",
        payload={
            "user_name": current_user.full_name,
            "user_email": current_user.email,
            "punch_type": punch_type,
            "claimed_at": claimed_at_utc.strftime("%Y-%m-%d %H:%M:%S IST"),
            "server_at": now_server.strftime("%Y-%m-%d %H:%M:%S IST"),
            "gap_minutes": round(abs((now_server - claimed_at_utc).total_seconds()) / 60.0, 1),
            "work_mode": work_mode,
            "device": f"{device_info['device_type']} ({device_info['os_name']} / {device_info['browser']})",
            "ip": device_info["ip"]
        }
    )

    # Check for Late Punch IN (after 09:10 AM IST) & Late Punch OUT
    from datetime import timedelta
    ist_offset = timedelta(hours=5, minutes=30)
    punch_ist = claimed_at_utc + ist_offset

    if punch_type == "in":
        # Threshold: 09:10 AM IST
        if punch_ist.hour > 9 or (punch_ist.hour == 9 and punch_ist.minute > 10):
            late_mins = (punch_ist.hour - 9) * 60 + punch_ist.minute - 10
            emit_mail_event(
                db=db,
                event_type="punch.late_in",
                payload={
                    "user_name": current_user.full_name,
                    "user_email": current_user.email,
                    "punch_time": punch_ist.strftime("%I:%M:%S %p IST"),
                    "threshold_time": "09:10:00 AM IST",
                    "late_minutes": late_mins,
                    "date": str(punch_day),
                    "work_mode": work_mode
                }
            )
    elif punch_type == "out":
        # Threshold: Late punch out after 06:00 PM (18:00) IST
        if punch_ist.hour >= 18:
            overtime_mins = (punch_ist.hour - 18) * 60 + punch_ist.minute
            emit_mail_event(
                db=db,
                event_type="punch.late_out",
                payload={
                    "user_name": current_user.full_name,
                    "user_email": current_user.email,
                    "punch_time": punch_ist.strftime("%I:%M:%S %p IST"),
                    "threshold_time": "06:00:00 PM IST",
                    "overtime_minutes": overtime_mins,
                    "date": str(punch_day)
                }
            )

    return format_punch_response(new_punch, current_user.full_name)



@router.get("/me", response_model=List[PunchResponse])
def get_my_punches(
    month: Optional[str] = None,
    current_user: User = Depends(requires_permission("attendance.view_own")),
    db: Session = Depends(get_db)
):
    query = db.query(Punch).filter(Punch.user_id == current_user.id)
    if month:  # Format YYYY-MM
        query = query.filter(Punch.day.cast(String).like(f"{month}%"))
    
    punches = query.order_by(Punch.claimed_at.desc()).all()
    return [format_punch_response(p, current_user.full_name) for p in punches]

@router.get("/users/{user_id}", response_model=List[PunchResponse])
def get_user_punches(
    user_id: str,
    month: Optional[str] = None,
    current_user: User = Depends(requires_permission("attendance.view_all")),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    query = db.query(Punch).filter(Punch.user_id == user_id)
    if month:
        query = query.filter(Punch.day.cast(String).like(f"{month}%"))

    punches = query.order_by(Punch.claimed_at.desc()).all()
    return [format_punch_response(p, target_user.full_name) for p in punches]

@router.patch("/admin/punches/{punch_id}", response_model=PunchResponse)
def admin_edit_punch(
    punch_id: str,
    payload: AdminPatchPunchRequest,
    current_user: User = Depends(requires_permission("attendance.edit_with_reason")),
    db: Session = Depends(get_db)
):
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mandatory 'reason' field must be provided for Admin punch edits"
        )

    punch = db.query(Punch).filter(Punch.id == punch_id).first()
    if not punch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Punch record not found")

    before_state = {
        "claimed_at": punch.claimed_at.isoformat(),
        "work_mode": punch.work_mode,
        "day": str(punch.day)
    }

    if payload.claimed_at:
        c_utc = payload.claimed_at.replace(tzinfo=timezone.utc) if payload.claimed_at.tzinfo is None else payload.claimed_at
        punch.claimed_at = c_utc
        punch.day = c_utc.date()

    if payload.work_mode:
        wm = payload.work_mode.lower().strip()
        if wm in ["office", "wfh", "half"]:
            punch.work_mode = wm

    db.commit()
    db.refresh(punch)

    after_state = {
        "claimed_at": punch.claimed_at.isoformat(),
        "work_mode": punch.work_mode,
        "day": str(punch.day),
        "edit_reason": payload.reason
    }

    # Record snapshot audit entry with mandatory reason
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "admin",
        action="punch.admin_edit",
        entity="Punch",
        entity_id=punch.id,
        before_state=before_state,
        after_state=after_state
    )

    return format_punch_response(punch)


class CreateRegularizationRequest(BaseModel):
    day: str  # YYYY-MM-DD
    punch_type: str  # in | out
    requested_time: datetime
    work_mode: Optional[str] = "office"
    reason: str

class RegularizationResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    day: str
    punch_type: str
    requested_time: datetime
    work_mode: str
    reason: str
    status: str
    created_at: datetime

@router.post("/regularize", response_model=RegularizationResponse, status_code=status.HTTP_201_CREATED)
def apply_regularization(
    payload: CreateRegularizationRequest,
    current_user: User = Depends(requires_permission("attendance.punch")),
    db: Session = Depends(get_db)
):
    from models.attendance import AttendanceRegularization
    from datetime import date
    
    req_date = date.fromisoformat(payload.day)
    req_time_utc = payload.requested_time.replace(tzinfo=timezone.utc) if payload.requested_time.tzinfo is None else payload.requested_time

    reg = AttendanceRegularization(
        user_id=current_user.id,
        day=req_date,
        punch_type=payload.punch_type.lower().strip(),
        requested_time=req_time_utc,
        work_mode=payload.work_mode.lower().strip() if payload.work_mode else "office",
        reason=payload.reason.strip(),
        status="pending"
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "employee",
        action="attendance.regularization_apply",
        entity="AttendanceRegularization",
        entity_id=reg.id,
        after_state={"day": str(reg.day), "punch_type": reg.punch_type, "reason": reg.reason}
    )

    return RegularizationResponse(
        id=reg.id,
        user_id=reg.user_id,
        user_name=current_user.full_name,
        day=str(reg.day),
        punch_type=reg.punch_type,
        requested_time=reg.requested_time,
        work_mode=reg.work_mode,
        reason=reg.reason,
        status=reg.status,
        created_at=reg.created_at
    )

@router.get("/regularize/pending", response_model=List[RegularizationResponse])
def get_pending_regularizations(
    current_user: User = Depends(requires_permission("attendance.view_all")),
    db: Session = Depends(get_db)
):
    from models.attendance import AttendanceRegularization
    regs = db.query(AttendanceRegularization).filter(AttendanceRegularization.status == "pending").order_by(AttendanceRegularization.created_at.asc()).all()
    user_map = {u.id: u.full_name for u in db.query(User).all()}

    return [
        RegularizationResponse(
            id=r.id,
            user_id=r.user_id,
            user_name=user_map.get(r.user_id, "Employee"),
            day=str(r.day),
            punch_type=r.punch_type,
            requested_time=r.requested_time,
            work_mode=r.work_mode,
            reason=r.reason,
            status=r.status,
            created_at=r.created_at
        ) for r in regs
    ]

@router.post("/regularize/{reg_id}/approve")
def approve_regularization(
    reg_id: str,
    current_user: User = Depends(requires_permission("attendance.view_all")),
    db: Session = Depends(get_db)
):
    from models.attendance import AttendanceRegularization, Punch
    from models.comms import Notification

    reg = db.query(AttendanceRegularization).filter(AttendanceRegularization.id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regularization request not found")

    reg.status = "approved"
    reg.decided_by = current_user.id
    reg.decided_at = datetime.now(timezone.utc)

    # Auto-create actual Punch record
    existing_punch = db.query(Punch).filter(
        Punch.user_id == reg.user_id,
        Punch.day == reg.day,
        Punch.punch_type == reg.punch_type
    ).first()

    if not existing_punch:
        now_server = datetime.now(timezone.utc)
        new_punch = Punch(
            user_id=reg.user_id,
            punch_type=reg.punch_type,
            claimed_at=reg.requested_time,
            server_at=now_server,
            ip="regularization.override",
            user_agent="System Approval",
            device_type="desktop",
            os_name="System",
            os_version="1.0",
            browser="System",
            work_mode=reg.work_mode,
            day=reg.day
        )
        db.add(new_punch)

        # Sync DayStatus
        cal_status = "wfh" if reg.work_mode == "wfh" else ("half" if reg.work_mode == "half" else "present")
        existing_ds = db.query(DayStatus).filter(DayStatus.user_id == reg.user_id, DayStatus.date == reg.day).first()
        if existing_ds:
            existing_ds.status = cal_status
        else:
            db.add(DayStatus(id=generate_uuid7(), user_id=reg.user_id, date=reg.day, status=cal_status, source="auto"))

    db.commit()

    # Notify employee
    notif = Notification(
        user_id=reg.user_id,
        type="regularization_approved",
        payload={"day": str(reg.day), "punch_type": reg.punch_type}
    )
    db.add(notif)
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "md",
        action="attendance.regularization_approve",
        entity="AttendanceRegularization",
        entity_id=reg.id,
        after_state={"status": "approved"}
    )

    return {"message": "Attendance regularization approved and punch recorded!"}

@router.post("/regularize/{reg_id}/reject")
def reject_regularization(
    reg_id: str,
    current_user: User = Depends(requires_permission("attendance.view_all")),
    db: Session = Depends(get_db)
):
    from models.attendance import AttendanceRegularization

    reg = db.query(AttendanceRegularization).filter(AttendanceRegularization.id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regularization request not found")

    reg.status = "rejected"
    reg.decided_by = current_user.id
    reg.decided_at = datetime.now(timezone.utc)
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "md",
        action="attendance.regularization_reject",
        entity="AttendanceRegularization",
        entity_id=reg.id,
        after_state={"status": "rejected"}
    )

    return {"message": "Attendance regularization rejected"}

