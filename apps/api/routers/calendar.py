from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
from sqlalchemy import String
from sqlalchemy.orm import Session

from core.database import get_db
from models.auth import User
from models.calendar import CalendarDay, DayStatus
from core.rbac import requires_permission
from core.automarker import auto_mark_day
from middleware.audit import log_audit_event

router = APIRouter(prefix="/calendar", tags=["Calendar Engine"])

class UpsertCalendarDayRequest(BaseModel):
    date: date
    day_type: str  # working | weekend | holiday
    label: Optional[str] = None

class MarkDayJobRequest(BaseModel):
    target_date: Optional[date] = None

class DayStatusResponse(BaseModel):
    user_id: str
    date: str
    status: str
    source: str
    marked_at: datetime

@router.get("/days")
def get_calendar_days(month: str, db: Session = Depends(get_db)):
    """Get company calendar day configurations for a month (YYYY-MM)."""
    days = db.query(CalendarDay).filter(CalendarDay.date.cast(String).like(f"{month}%")).all()
    return [{"date": str(d.date), "day_type": d.day_type, "label": d.label} for d in days]

@router.get("/daily-summary")
def get_daily_summary(
    month: str,
    current_user: User = Depends(requires_permission("attendance.view_all")),
    db: Session = Depends(get_db)
):
    """Get daily employee presence/absent/leave counts for a month for MD/Admin overview."""
    statuses = db.query(DayStatus).filter(DayStatus.date.cast(String).like(f"{month}%")).all()
    summary = {}
    for s in statuses:
        d_str = str(s.date)
        if d_str not in summary:
            summary[d_str] = {"present": 0, "absent": 0, "leave": 0, "wfh": 0, "half": 0, "holiday": 0, "total": 0}
        st = s.status if s.status in summary[d_str] else "present"
        summary[d_str][st] = summary[d_str].get(st, 0) + 1
        summary[d_str]["total"] += 1
    return summary

@router.post("/days", status_code=status.HTTP_200_OK)
def upsert_calendar_day(
    payload: UpsertCalendarDayRequest,
    current_user: User = Depends(requires_permission("calendar.manage")),
    db: Session = Depends(get_db)
):
    dt = payload.day_type.lower().strip()
    if dt not in ["working", "weekend", "holiday"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="day_type must be 'working', 'weekend', or 'holiday'")

    cal_day = db.query(CalendarDay).filter(CalendarDay.date == payload.date).first()
    before_state = {"day_type": cal_day.day_type, "label": cal_day.label} if cal_day else None

    if cal_day:
        cal_day.day_type = dt
        cal_day.label = payload.label
    else:
        cal_day = CalendarDay(date=payload.date, day_type=dt, label=payload.label)
        db.add(cal_day)

    # If marked as holiday, also auto-update DayStatus for all users on that day if not manual
    if dt == "holiday":
        all_users = db.query(User).filter(User.is_active == True).all()
        for u in all_users:
            ds = db.query(DayStatus).filter(DayStatus.user_id == u.id, DayStatus.date == payload.date).first()
            if ds:
                if ds.source != "manual":
                    ds.status = "holiday"
            else:
                db.add(DayStatus(id=generate_uuid7(), user_id=u.id, date=payload.date, status="holiday", source="auto"))

    db.commit()

    # Log audit event
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "admin",
        action="calendar.day_upsert",
        entity="CalendarDay",
        entity_id=str(payload.date),
        before_state=before_state,
        after_state={"day_type": dt, "label": payload.label}
    )

    return {"date": str(cal_day.date), "day_type": cal_day.day_type, "label": cal_day.label}

@router.get("/me", response_model=List[DayStatusResponse])
def get_my_calendar_status(
    month: str,
    current_user: User = Depends(requires_permission("calendar.view")),
    db: Session = Depends(get_db)
):
    statuses = db.query(DayStatus).filter(
        DayStatus.user_id == current_user.id,
        DayStatus.date.cast(String).like(f"{month}%")
    ).all()

    return [
        DayStatusResponse(
            user_id=s.user_id,
            date=str(s.date),
            status=s.status,
            source=s.source,
            marked_at=s.marked_at
        ) for s in statuses
    ]

@router.get("/users/{user_id}", response_model=List[DayStatusResponse])
def get_user_calendar_status(
    user_id: str,
    month: str,
    current_user: User = Depends(requires_permission("attendance.view_all")),
    db: Session = Depends(get_db)
):
    statuses = db.query(DayStatus).filter(
        DayStatus.user_id == user_id,
        DayStatus.date.cast(String).like(f"{month}%")
    ).all()

    return [
        DayStatusResponse(
            user_id=s.user_id,
            date=str(s.date),
            status=s.status,
            source=s.source,
            marked_at=s.marked_at
        ) for s in statuses
    ]

@router.post("/admin/jobs/mark-day")
def trigger_mark_day_job(
    payload: Optional[MarkDayJobRequest] = None,
    current_user: User = Depends(requires_permission("calendar.manage")),
    db: Session = Depends(get_db)
):
    """Admin backfill endpoint to auto-mark attendance for any target date."""
    target_d = payload.target_date if (payload and payload.target_date) else date.today()
    result = auto_mark_day(target_d, db)
    return result

