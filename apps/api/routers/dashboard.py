from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timezone, timedelta
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import User, Role
from models.attendance import Punch
from models.calendar import CalendarDay, DayStatus
from models.leave import LeaveRequest, LeaveBalance
from models.eod import EODReport, EODTemplate
from models.projects import Project, Task
from models.audit import AuditLog
from core.rbac import requires_permission

router = APIRouter(prefix="/dashboard", tags=["Role Dashboards"])

@router.get("/employee")
def get_employee_dashboard(
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    today = datetime.now(timezone.utc).date()
    current_year = today.year
    current_month_str = today.strftime("%Y-%m")

    # 1. Today's Punch Card Status
    punches_today = db.query(Punch).filter(Punch.user_id == current_user.id, Punch.day == today).all()
    punch_in = next((p for p in punches_today if p.punch_type == "in"), None)
    punch_out = next((p for p in punches_today if p.punch_type == "out"), None)

    # 2. Leave Balance
    balance = db.query(LeaveBalance).filter(LeaveBalance.user_id == current_user.id, LeaveBalance.year == current_year).first()
    bal_data = {
        "year": current_year,
        "allotted": balance.allotted if balance else 18,
        "used": balance.used if balance else 0,
        "remaining": (balance.allotted - balance.used) if balance else 18
    }

    # 3. Today's EOD Report Status
    eod_today = db.query(EODReport).filter(EODReport.user_id == current_user.id, EODReport.date == today).first()
    default_tmpl = db.query(EODTemplate).filter(EODTemplate.is_default == True).first()

    # 4. My Tasks
    my_tasks = db.query(Task).filter(Task.assignee_id == current_user.id).order_by(Task.created_at.desc()).all()

    # 5. My Activity Feed (from audit_log)
    activities = db.query(AuditLog).filter(AuditLog.actor_id == current_user.id).order_by(AuditLog.at.desc()).limit(20).all()

    return {
        "user": {"id": current_user.id, "name": current_user.full_name, "email": current_user.email, "role": current_user.role.name},
        "punch_card": {
            "punch_in": {"claimed_at": punch_in.claimed_at, "server_at": punch_in.server_at, "mode": punch_in.work_mode} if punch_in else None,
            "punch_out": {"claimed_at": punch_out.claimed_at, "server_at": punch_out.server_at} if punch_out else None,
            "status": "punched_out" if punch_out else ("punched_in" if punch_in else "not_punched")
        },
        "leave_balance": bal_data,
        "eod_today": {
            "submitted": eod_today is not None,
            "report_id": eod_today.id if eod_today else None,
            "body_md": eod_today.body_md if eod_today else (default_tmpl.body_md if default_tmpl else "")
        },
        "tasks": [
            {
                "id": t.id,
                "project_id": t.project_id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "due_date": str(t.due_date) if t.due_date else None
            } for t in my_tasks
        ],
        "activity_feed": [
            {
                "id": a.id,
                "action": a.action,
                "entity": a.entity,
                "at": a.at,
                "details": a.after_state
            } for a in activities
        ]
    }

@router.get("/md")
def get_md_dashboard(
    current_user: User = Depends(requires_permission("attendance.view_all")),
    db: Session = Depends(get_db)
):
    today = datetime.now(timezone.utc).date()

    # 1. Live Punch Feed Today & Calculate Working Hours per Employee
    punches_today = db.query(Punch).filter(Punch.day == today).order_by(Punch.claimed_at.desc()).all()
    punch_feed = []
    
    # Group by user_id for working hours calculation
    user_punches_map = {}
    for p in punches_today:
        if p.user_id not in user_punches_map:
            user_punches_map[p.user_id] = []
        user_punches_map[p.user_id].append(p)
        
        c_at = p.claimed_at.replace(tzinfo=timezone.utc) if p.claimed_at.tzinfo is None else p.claimed_at
        s_at = p.server_at.replace(tzinfo=timezone.utc) if p.server_at.tzinfo is None else p.server_at
        gap = round(abs((s_at - c_at).total_seconds()) / 60.0, 1)
        punch_feed.append({
            "id": p.id,
            "user_id": p.user_id,
            "user_name": p.user.full_name if p.user else "Employee",
            "user_avatar": getattr(p.user, 'avatar_url', None) if p.user else None,
            "punch_type": p.punch_type,
            "claimed_at": c_at,
            "server_at": s_at,
            "gap_minutes": gap,
            "flag_gap": gap > 10.0,
            "work_mode": p.work_mode,
            "device_type": p.device_type,
            "os_name": p.os_name,
            "browser": p.browser,
            "ip": p.ip
        })

    # Calculate employee working hours
    now_utc = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    employee_hours_list = []

    for u_id, u_punches in user_punches_map.items():
        p_in = next((p for p in u_punches if p.punch_type == "in"), None)
        p_out = next((p for p in u_punches if p.punch_type == "out"), None)
        u_obj = u_punches[0].user if u_punches else None
        u_name = u_obj.full_name if u_obj else u_id
        u_avatar = getattr(u_obj, 'avatar_url', None) if u_obj else None

        in_time_str = (p_in.claimed_at + ist_offset).strftime("%I:%M %p IST") if p_in else "Not Punched IN"
        out_time_str = (p_out.claimed_at + ist_offset).strftime("%I:%M %p IST") if p_out else "Active (Punched IN)"

        hours_str = "0h 0m"
        is_active = False
        if p_in and p_out:
            in_dt = p_in.claimed_at.replace(tzinfo=timezone.utc) if p_in.claimed_at.tzinfo is None else p_in.claimed_at
            out_dt = p_out.claimed_at.replace(tzinfo=timezone.utc) if p_out.claimed_at.tzinfo is None else p_out.claimed_at
            sec = max(0, int((out_dt - in_dt).total_seconds()))
            hrs = sec // 3600
            mins = (sec % 3600) // 60
            hours_str = f"{hrs}h {mins}m"
        elif p_in:
            in_dt = p_in.claimed_at.replace(tzinfo=timezone.utc) if p_in.claimed_at.tzinfo is None else p_in.claimed_at
            sec = max(0, int((now_utc - in_dt).total_seconds()))
            hrs = sec // 3600
            mins = (sec % 3600) // 60
            hours_str = f"{hrs}h {mins}m (Running)"
            is_active = True

        employee_hours_list.append({
            "user_id": u_id,
            "user_name": u_name,
            "user_avatar": u_avatar,
            "in_time": in_time_str,
            "out_time": out_time_str,
            "working_hours": hours_str,
            "is_active": is_active,
            "work_mode": p_in.work_mode if p_in else "office"
        })

    # 2. Pending Leave Approvals Queue
    from sqlalchemy import func
    pending_leaves = db.query(LeaveRequest).filter(func.lower(LeaveRequest.status) == "pending").order_by(LeaveRequest.created_at.asc()).all()
    user_name_map = {u.id: u.full_name for u in db.query(User).all()}

    # 3. Today's EOD Summary
    eod_reports = db.query(EODReport).filter(EODReport.date == today).all()

    # 4. Active Projects
    projects = db.query(Project).all()

    # 5. Employees Directory
    all_roles = db.query(Role).all()
    role_map = {r.id: r.name for r in all_roles}
    employees = db.query(User).order_by(User.full_name.asc()).all()
    emp_list = [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": role_map.get(u.role_id, "employee"),
            "role_id": u.role_id,
            "is_active": u.is_active,
            "is_archived": bool(getattr(u, 'is_archived', False)),
            "designation": getattr(u, 'designation', 'Team Member'),
            "avatar_url": getattr(u, 'avatar_url', None)
        } for u in employees
    ]

    # 6. Tasks Breakdown: Deadline Reached vs Deadline Completed
    all_tasks = db.query(Task).order_by(Task.created_at.desc()).all()
    deadline_reached = []
    deadline_completed = []

    for t in all_tasks:
        t_data = {
            "id": t.id,
            "title": t.title,
            "project_name": t.project.name if t.project else "General",
            "assignee_name": t.assignee.full_name if t.assignee else "Unassigned",
            "status": t.status,
            "priority": t.priority,
            "due_date": str(t.due_date) if t.due_date else None
        }
        if t.status == "done":
            deadline_completed.append(t_data)
        else:
            # Reached deadline / due today or past due or active
            deadline_reached.append(t_data)

    return {
        "live_punch_feed": punch_feed,
        "employee_hours_summary": employee_hours_list,
        "pending_leaves_count": len(pending_leaves),
        "pending_leaves": [
            {
                "id": l.id,
                "user_name": user_name_map.get(l.user_id, "Employee"),
                "from_date": str(l.from_date),
                "to_date": str(l.to_date),
                "half_day": l.half_day,
                "reason": l.reason
            } for l in pending_leaves
        ],
        "eod_submitted_count": len(eod_reports),
        "projects_count": len(projects),
        "total_employees": len(emp_list),
        "employees": emp_list,
        "deadline_reached_tasks": deadline_reached,
        "deadline_completed_tasks": deadline_completed
    }


@router.get("/admin")
def get_admin_dashboard(
    current_user: User = Depends(requires_permission("users.manage_all")),
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    today = datetime.now(timezone.utc).date()
    total_users = db.query(User).count()
    total_roles = db.query(Role).count()
    total_audits = db.query(AuditLog).count()

    pending_leaves = db.query(LeaveRequest).filter(func.lower(LeaveRequest.status) == "pending").order_by(LeaveRequest.created_at.asc()).all()
    user_name_map = {u.id: u.full_name for u in db.query(User).all()}

    eod_reports = db.query(EODReport).filter(EODReport.date == today).all()
    projects = db.query(Project).all()
    punches_today = db.query(Punch).filter(Punch.day == today).order_by(Punch.claimed_at.desc()).all()

    recent_audits = db.query(AuditLog).order_by(AuditLog.at.desc()).limit(30).all()

    return {
        "system_stats": {
            "total_users": total_users,
            "total_roles": total_roles,
            "total_audit_logs": total_audits,
            "pending_leaves_count": len(pending_leaves),
            "eod_submitted_count": len(eod_reports),
            "projects_count": len(projects)
        },
        "pending_leaves": [
            {
                "id": l.id,
                "user_name": user_name_map.get(l.user_id, "Employee"),
                "from_date": str(l.from_date),
                "to_date": str(l.to_date),
                "half_day": l.half_day,
                "reason": l.reason
            } for l in pending_leaves
        ],
        "live_punch_feed": [
            {
                "id": p.id,
                "user_name": user_name_map.get(p.user_id, "Employee"),
                "punch_type": p.punch_type,
                "claimed_at": p.claimed_at,
                "work_mode": p.work_mode,
                "device_type": p.device_type,
                "ip": p.ip
            } for p in punches_today
        ],
        "audit_logs": [
            {
                "id": a.id,
                "actor_id": a.actor_id,
                "actor_role": a.actor_role,
                "action": a.action,
                "entity": a.entity,
                "entity_id": a.entity_id,
                "before_state": a.before_state,
                "after_state": a.after_state,
                "at": a.at
            } for a in recent_audits
        ]
    }


@router.get("/presence-today")
def get_presence_today(
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    today = datetime.now(timezone.utc).date()
    active_users = db.query(User).filter(User.is_active == True).all()

    # Get day statuses for today
    day_statuses = db.query(DayStatus).filter(DayStatus.date == today).all()
    ds_map = {ds.user_id: ds.status for ds in day_statuses}

    # Get punches today
    punches = db.query(Punch).filter(Punch.day == today, Punch.punch_type == "in").all()
    punched_map = {p.user_id: p for p in punches}

    office_users = []
    wfh_users = []
    leave_users = []
    absent_users = []

    for u in active_users:
        u_info = {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "department": u.department or "Engineering",
            "designation": getattr(u, 'designation', 'Team Member'),
            "avatar_url": getattr(u, 'avatar_url', None)
        }
        st = ds_map.get(u.id)
        if st in ["leave", "half"]:
            leave_users.append(u_info)
        elif u.id in punched_map:
            p = punched_map[u.id]
            if p.work_mode == "wfh":
                wfh_users.append(u_info)
            else:
                office_users.append(u_info)
        elif st == "wfh":
            wfh_users.append(u_info)
        elif st == "present":
            office_users.append(u_info)
        else:
            absent_users.append(u_info)

    return {
        "date": str(today),
        "total_active": len(active_users),
        "office_count": len(office_users),
        "wfh_count": len(wfh_users),
        "leave_count": len(leave_users),
        "absent_count": len(absent_users),
        "office_users": office_users,
        "wfh_users": wfh_users,
        "leave_users": leave_users,
        "absent_users": absent_users
    }

