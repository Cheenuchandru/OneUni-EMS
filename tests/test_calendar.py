import sys
import os
from datetime import date, datetime, timezone
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from main import app
from seed import seed_database
from core.database import SessionLocal
from models.auth import User, Role
from models.attendance import Punch
from models.calendar import CalendarDay, DayStatus
from core.security import hash_password
from core.rate_limit import _failed_attempts

client = TestClient(app)

def setup_module(module):
    _failed_attempts.clear()
    seed_database()

def test_auto_marker_absent_and_holiday():
    target_date = date(2026, 7, 20)  # Monday (Working Day)

    # Clean up any residual calendar records for clean test isolation
    db = SessionLocal()
    db.query(CalendarDay).filter(CalendarDay.date == target_date).delete()
    db.query(DayStatus).filter(DayStatus.date == target_date).delete()
    db.commit()
    db.close()

    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    admin_cookie = admin_login.cookies["ems_jwt"]


    # 1. Trigger mark-day for target_date when employee has NO punch -> Must mark 'absent'
    job_resp = client.post(
        "/calendar/admin/jobs/mark-day",
        json={"target_date": str(target_date)},
        cookies={"ems_jwt": admin_cookie}
    )
    assert job_resp.status_code == 200
    summary = job_resp.json()["summary"]
    if summary.get("absent", 0) < 1:
        print("Auto mark summary:", job_resp.json())
    assert summary["absent"] >= 1


    # 2. Declare target_date as Holiday via calendar management API
    cal_resp = client.post(
        "/calendar/days",
        json={"date": str(target_date), "day_type": "holiday", "label": "Company Foundation Day"},
        cookies={"ems_jwt": admin_cookie}
    )
    assert cal_resp.status_code == 200

    # 3. Re-run mark-day job -> Must flip status to 'holiday'
    job_resp2 = client.post(
        "/calendar/admin/jobs/mark-day",
        json={"target_date": str(target_date)},
        cookies={"ems_jwt": admin_cookie}
    )
    assert job_resp2.status_code == 200
    summary2 = job_resp2.json()["summary"]
    assert summary2["holiday"] >= 1

def test_punch_overrides_working_day():
    db = SessionLocal()
    emp_user = db.query(User).filter(User.email == "admin@company.com").first()
    target_date = date(2026, 7, 21)  # Tuesday

    # Clean up existing punches for clean isolation
    db.query(Punch).filter(Punch.user_id == emp_user.id, Punch.day == target_date).delete()
    db.commit()


    # Record Punch IN for admin on target_date
    now_utc = datetime.now(timezone.utc)
    new_punch = Punch(
        user_id=emp_user.id,
        punch_type="in",
        claimed_at=now_utc,
        server_at=now_utc,
        ip="127.0.0.1",
        user_agent="Test",
        device_type="desktop",
        os_name="Windows",
        os_version="10",
        browser="Chrome",
        work_mode="wfh",
        day=target_date
    )
    db.add(new_punch)
    db.commit()
    db.close()

    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    admin_cookie = admin_login.cookies["ems_jwt"]

    # Run mark-day -> Must mark 'wfh' for admin
    job_resp = client.post(
        "/calendar/admin/jobs/mark-day",
        json={"target_date": str(target_date)},
        cookies={"ems_jwt": admin_cookie}
    )
    assert job_resp.status_code == 200
    
    # Query status
    my_status = client.get("/calendar/me?month=2026-07", cookies={"ems_jwt": admin_cookie})
    assert my_status.status_code == 200
    statuses = my_status.json()
    jul21_status = next((s for s in statuses if s["date"] == "2026-07-21"), None)
    assert jul21_status is not None
    assert jul21_status["status"] == "wfh"

if __name__ == "__main__":
    print("Running Day 5 Calendar Engine Tests...")
    setup_module(None)
    test_auto_marker_absent_and_holiday()
    print("[OK] Auto-marker absent & holiday override passed.")
    test_punch_overrides_working_day()
    print("[OK] Punch IN overrides working day status passed.")
    print("=" * 50)
    print("ALL DAY 5 CALENDAR TESTS PASSED CLEANLY!")
    print("=" * 50)
