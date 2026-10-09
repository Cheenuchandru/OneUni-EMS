from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime, timezone
from sqlalchemy import String
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import User
from models.attendance import Punch
from models.eod import EODTemplate, EODReport
from core.rbac import requires_permission
from middleware.audit import log_audit_event

router = APIRouter(prefix="/eod", tags=["EOD Reports Engine"])

class SubmitEODRequest(BaseModel):
    date: date
    body_md: str
    template_id: Optional[str] = None

class CreateTemplateRequest(BaseModel):
    name: str
    body_md: str
    is_default: bool = False

class PatchEODRequest(BaseModel):
    body_md: str

class ReviewEODRequest(BaseModel):
    review_note: str

class EODReportResponse(BaseModel):
    id: str
    user_id: str
    user_full_name: str
    date: str
    body_md: str
    submitted_at: datetime
    locked: bool
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_note: Optional[str] = None


@router.get("/template/default")
def get_default_template(db: Session = Depends(get_db)):
    tmpl = db.query(EODTemplate).filter(EODTemplate.is_default == True, EODTemplate.active == True).first()
    if not tmpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active default EOD template found")
    return {"id": tmpl.id, "name": tmpl.name, "body_md": tmpl.body_md}

@router.post("/templates", status_code=status.HTTP_201_CREATED)
def create_template(
    payload: CreateTemplateRequest,
    current_user: User = Depends(requires_permission("eod.templates")),
    db: Session = Depends(get_db)
):
    if payload.is_default:
        # Deactivate previous default
        db.query(EODTemplate).filter(EODTemplate.is_default == True).update({"is_default": False})

    new_tmpl = EODTemplate(
        name=payload.name,
        body_md=payload.body_md,
        is_default=payload.is_default,
        active=True
    )
    db.add(new_tmpl)
    db.commit()
    db.refresh(new_tmpl)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "admin",
        action="eod_template.create",
        entity="EODTemplate",
        entity_id=new_tmpl.id,
        after_state={"name": new_tmpl.name, "is_default": new_tmpl.is_default}
    )

    return {"id": new_tmpl.id, "name": new_tmpl.name, "body_md": new_tmpl.body_md, "is_default": new_tmpl.is_default}

@router.post("", response_model=EODReportResponse, status_code=status.HTTP_201_CREATED)
def submit_eod(
    payload: SubmitEODRequest,
    current_user: User = Depends(requires_permission("eod.submit")),
    db: Session = Depends(get_db)
):
    existing = db.query(EODReport).filter(EODReport.user_id == current_user.id, EODReport.date == payload.date).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"EOD report for {payload.date} is already submitted")

    today_date = datetime.now(timezone.utc).date()
    is_locked = payload.date < today_date

    new_report = EODReport(
        user_id=current_user.id,
        date=payload.date,
        template_id=payload.template_id,
        body_md=payload.body_md,
        locked=is_locked
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "employee",
        action="eod.submit",
        entity="EODReport",
        entity_id=new_report.id,
        after_state={"date": str(payload.date)}
    )

    return EODReportResponse(
        id=new_report.id,
        user_id=new_report.user_id,
        user_full_name=current_user.full_name,
        date=str(new_report.date),
        body_md=new_report.body_md,
        submitted_at=new_report.submitted_at,
        locked=new_report.locked
    )

@router.patch("/{report_id}", response_model=EODReportResponse)
def edit_own_eod(
    report_id: str,
    payload: PatchEODRequest,
    current_user: User = Depends(requires_permission("eod.submit")),
    db: Session = Depends(get_db)
):
    report = db.query(EODReport).filter(EODReport.id == report_id, EODReport.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="EOD report not found")

    today_date = datetime.now(timezone.utc).date()
    if report.locked or report.date < today_date:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Midnight Lock: EOD reports cannot be edited after midnight of their submission date"
        )

    before_body = report.body_md
    report.body_md = payload.body_md
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "employee",
        action="eod.edit",
        entity="EODReport",
        entity_id=report.id,
        before_state={"body_md": before_body},
        after_state={"body_md": payload.body_md}
    )

    return EODReportResponse(
        id=report.id,
        user_id=report.user_id,
        user_full_name=current_user.full_name,
        date=str(report.date),
        body_md=report.body_md,
        submitted_at=report.submitted_at,
        locked=report.locked
    )

@router.get("/me", response_model=List[EODReportResponse])
def get_my_eods(
    month: Optional[str] = None,
    current_user: User = Depends(requires_permission("eod.view_own")),
    db: Session = Depends(get_db)
):
    query = db.query(EODReport).filter(EODReport.user_id == current_user.id)
    if month:
        query = query.filter(EODReport.date.cast(String).like(f"{month}%"))
    reports = query.order_by(EODReport.date.desc()).all()
    return [
        EODReportResponse(
            id=r.id,
            user_id=r.user_id,
            user_full_name=current_user.full_name,
            date=str(r.date),
            body_md=r.body_md,
            submitted_at=r.submitted_at,
            locked=r.locked
        ) for r in reports
    ]

@router.get("/feed")
def get_eod_activity_feed(
    limit: int = 50,
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    query = db.query(EODReport)
    if current_user.role and current_user.role.name == "employee":
        query = query.filter(EODReport.user_id == current_user.id)

    reports = query.order_by(EODReport.submitted_at.desc()).limit(limit).all()

    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "user_name": r.user.full_name if r.user else "Employee",
            "user_role": r.user.role.name if (r.user and r.user.role) else "employee",
            "date": str(r.date),
            "body_md": r.body_md,
            "submitted_at": r.submitted_at,
            "locked": r.locked,
            "reviewed_by_name": r.reviewer.full_name if r.reviewer else None,
            "reviewed_at": r.reviewed_at,
            "review_note": r.review_note,
            "rating": r.rating
        } for r in reports
    ]

@router.get("/team")
def get_team_eod_summary(
    target_date: date,
    current_user: User = Depends(requires_permission("eod.view_all")),
    db: Session = Depends(get_db)
):
    active_users = db.query(User).filter(User.is_active == True).all()

    # Query submitted reports
    reports = db.query(EODReport).filter(EODReport.date == target_date).all()
    report_map = {r.user_id: r for r in reports}

    # Query users who punched IN on target_date
    punches = db.query(Punch).filter(Punch.day == target_date, Punch.punch_type == "in").all()
    punched_user_ids = {p.user_id for p in punches}

    submitted_list = []
    missing_list = []

    for u in active_users:
        if u.id in report_map:
            r = report_map[u.id]
            reviewer_user = db.query(User).filter(User.id == r.reviewed_by).first() if r.reviewed_by else None
            submitted_list.append({
                "id": r.id,
                "user_id": u.id,
                "user_name": u.full_name,
                "submitted_at": r.submitted_at,
                "locked": r.locked,
                "body_md": r.body_md,
                "reviewed_by_name": reviewer_user.full_name if reviewer_user else None,
                "reviewed_at": r.reviewed_at,
                "review_note": r.review_note
            })
        elif u.id in punched_user_ids:
            missing_list.append({
                "user_id": u.id,
                "user_name": u.full_name,
                "email": u.email
            })

    return {
        "date": str(target_date),
        "total_submitted": len(submitted_list),
        "total_missing": len(missing_list),
        "submitted": submitted_list,
        "missing": missing_list
    }

@router.post("/{report_id}/review", response_model=EODReportResponse)
def review_employee_eod(
    report_id: str,
    payload: ReviewEODRequest,
    current_user: User = Depends(requires_permission("eod.view_all")),
    db: Session = Depends(get_db)
):
    """MD / Admin endpoint to review employee EOD report, attach feedback notes, and give 1-5 star rating."""
    report = db.query(EODReport).filter(EODReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="EOD report not found")

    now_utc = datetime.now(timezone.utc)
    report.reviewed_by = current_user.id
    report.reviewed_at = now_utc
    report.review_note = payload.review_note
    report.rating = payload.rating
    db.commit()
    db.refresh(report)

    # Fan out notification to employee
    from models.comms import Notification
    notif = Notification(
        user_id=report.user_id,
        type="eod_reviewed",
        payload={"date": str(report.date), "rating": report.rating, "reviewer_name": current_user.full_name}
    )
    db.add(notif)
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "md",
        action="eod.review",
        entity="EODReport",
        entity_id=report.id,
        after_state={"review_note": payload.review_note, "rating": payload.rating, "reviewed_by": current_user.id}
    )

    user_obj = db.query(User).filter(User.id == report.user_id).first()
    return EODReportResponse(
        id=report.id,
        user_id=report.user_id,
        user_full_name=user_obj.full_name if user_obj else report.user_id,
        date=str(report.date),
        body_md=report.body_md,
        submitted_at=report.submitted_at,
        locked=report.locked,
        reviewed_by_name=current_user.full_name,
        reviewed_at=report.reviewed_at,
        review_note=report.review_note,
        rating=report.rating
    )


@router.post("/jobs/check-missing")
def check_missing_eod_job(
    target_date: Optional[date] = None,
    current_user: User = Depends(requires_permission("eod.view_all")),
    db: Session = Depends(get_db)
):
    """Job to detect missing EOD reports at 20:30 IST and emit mail events to outbox."""
    t_date = target_date or datetime.now(timezone.utc).date()
    summary = get_team_eod_summary(target_date=t_date, current_user=current_user, db=db)

    from core.mailer import emit_mail_event
    emitted_count = 0
    for missing_user in summary["missing"]:
        emit_mail_event(
            db=db,
            event_type="eod.missing",
            payload={
                "target_date": str(t_date),
                "user_name": missing_user["user_name"],
                "user_email": missing_user["email"]
            }
        )
        emitted_count += 1

    return {
        "date": str(t_date),
        "missing_count": summary["total_missing"],
        "mail_events_emitted": emitted_count
    }

