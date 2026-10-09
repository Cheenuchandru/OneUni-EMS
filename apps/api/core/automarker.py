from datetime import date
from sqlalchemy.orm import Session
from models.auth import User
from models.attendance import Punch
from models.calendar import CalendarDay, DayStatus
from models.leave import LeaveRequest
from core.uuid7 import generate_uuid7


# Standard Indian Public / National Holidays (month, day)
INDIAN_GOVT_FESTIVALS = {
    (1, 1): "New Year's Day",
    (1, 26): "Republic Day",
    (5, 1): "May Day / Labour Day",
    (8, 15): "Independence Day",
    (10, 2): "Gandhi Jayanti",
    (10, 24): "Vijayadashami / Dussehra",
    (11, 12): "Diwali / Deepavali",
    (1, 14): "Pongal / Makar Sankranti",
    (12, 25): "Christmas Day"
}

def auto_mark_day(target_date: date, db: Session) -> dict:
    active_users = db.query(User).filter(User.is_active == True).all()
    cal_day = db.query(CalendarDay).filter(CalendarDay.date == target_date).first()

    # Determine day_type: Check explicit cal_day, then Sunday (weekday 6) or Indian Festival
    month_day = (target_date.month, target_date.day)
    if cal_day:
        day_type = cal_day.day_type
    elif target_date.weekday() == 6 or month_day in INDIAN_GOVT_FESTIVALS:
        day_type = "holiday"
    elif target_date.weekday() == 5:
        day_type = "weekend"
    else:
        day_type = "working"

    processed_counts = {"present": 0, "absent": 0, "leave": 0, "holiday": 0, "wfh": 0, "half": 0, "ot": 0}

    for user in active_users:
        # Check if manual status override exists
        existing_status = db.query(DayStatus).filter(
            DayStatus.user_id == user.id,
            DayStatus.date == target_date
        ).first()

        if existing_status and existing_status.source == "manual":
            continue  # Manual override wins

        # 1. Check for approved leave on target_date
        approved_leave = db.query(LeaveRequest).filter(
            LeaveRequest.user_id == user.id,
            LeaveRequest.status == "approved",
            LeaveRequest.from_date <= target_date,
            LeaveRequest.to_date >= target_date
        ).first()

        if approved_leave:
            calculated_status = "leave"
        else:
            # 2. Punch check
            punch_in = db.query(Punch).filter(
                Punch.user_id == user.id,
                Punch.day == target_date,
                Punch.punch_type == "in"
            ).first()

            if punch_in:
                # If employee punched IN on holiday or weekend, mark as OT (Overtime)
                if day_type in ["holiday", "weekend"]:
                    calculated_status = "ot"
                else:
                    calculated_status = punch_in.work_mode if punch_in.work_mode in ["wfh", "half"] else "present"
            elif day_type in ["holiday", "weekend"]:
                calculated_status = "holiday"
            else:
                calculated_status = "absent"

        if existing_status:
            existing_status.status = calculated_status
            existing_status.source = "auto"
        else:
            new_status = DayStatus(
                id=generate_uuid7(),
                user_id=user.id,
                date=target_date,
                status=calculated_status,
                source="auto"
            )
            db.add(new_status)

        processed_counts[calculated_status] = processed_counts.get(calculated_status, 0) + 1

    db.commit()
    return {
        "date": str(target_date),
        "day_type": day_type,
        "summary": processed_counts
    }

