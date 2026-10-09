import sys
import os
from datetime import date, timedelta
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from main import app
from seed import seed_database
from core.database import SessionLocal
from models.auth import User, Role
from models.leave import LeaveRequest, LeaveBalance
from models.calendar import DayStatus
from core.security import hash_password
from core.rate_limit import _failed_attempts

client = TestClient(app)

def setup_module(module):
    _failed_attempts.clear()
    seed_database()

def test_leave_application_and_approval_flow():
    db = SessionLocal()
    emp_role = db.query(Role).filter(Role.name == "employee").first()
    emp_user = db.query(User).filter(User.email == "leave_user@company.com").first()
    if not emp_user:
        emp_user = User(
            email="leave_user@company.com",
            password_hash=hash_password("LeavePass123!"),
            full_name="Leave User",
            role_id=emp_role.id
        )
        db.add(emp_user)
        db.commit()
    db.close()

    # Login as Employee
    emp_login = client.post("/auth/login", json={"email": "leave_user@company.com", "password": "LeavePass123!"})
    emp_cookie = emp_login.cookies["ems_jwt"]

    from_d = date(2026, 8, 10)
    to_d = date(2026, 8, 12)

    # Clean up test leave requests and reset balance for test idempotency
    db = SessionLocal()
    u = db.query(User).filter(User.email == "leave_user@company.com").first()
    if u:
        db.query(LeaveRequest).filter(LeaveRequest.user_id == u.id).delete()
        bal = db.query(LeaveBalance).filter(LeaveBalance.user_id == u.id, LeaveBalance.year == 2026).first()
        if bal:
            bal.used = 0
        db.commit()
    db.close()



    # 1. Apply for Leave
    apply_resp = client.post(
        "/leave",
        json={"from_date": str(from_d), "to_date": str(to_d), "half_day": False, "reason": "Family Function"},
        cookies={"ems_jwt": emp_cookie}
    )
    assert apply_resp.status_code == 201
    leave_data = apply_resp.json()
    assert leave_data["status"] == "pending"
    leave_id = leave_data["id"]

    # 2. Overlapping Application -> Must fail (400)
    overlap_resp = client.post(
        "/leave",
        json={"from_date": "2026-08-11", "to_date": "2026-08-14", "half_day": False, "reason": "Overlap Test"},
        cookies={"ems_jwt": emp_cookie}
    )
    assert overlap_resp.status_code == 400
    assert "overlaps" in overlap_resp.json()["detail"]

    # 3. Login as Admin and Approve
    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    admin_cookie = admin_login.cookies["ems_jwt"]

    approve_resp = client.post(
        f"/leave/{leave_id}/approve",
        json={"note": "Approved by Admin"},
        cookies={"ems_jwt": admin_cookie}
    )
    assert approve_resp.status_code == 200
    app_data = approve_resp.json()
    assert app_data["status"] == "approved"

    # 4. Check Calendar Sync & Balance
    my_leaves = client.get("/leave/me", cookies={"ems_jwt": emp_cookie})
    assert my_leaves.status_code == 200
    bal = my_leaves.json()["balance"]
    assert bal["used"] == 3

    # Check DayStatus rows
    db = SessionLocal()
    day_status_row = db.query(DayStatus).filter(DayStatus.user_id == leave_data["user_id"], DayStatus.date == from_d).first()
    assert day_status_row is not None
    assert day_status_row.status == "leave"
    assert day_status_row.source == "manual"
    db.close()

if __name__ == "__main__":
    print("Running Day 6 Leave Management Tests...")
    setup_module(None)
    test_leave_application_and_approval_flow()
    print("[OK] Leave application, overlap block, approval & calendar sync passed.")
    print("=" * 50)
    print("ALL DAY 6 LEAVE TESTS PASSED CLEANLY!")
    print("=" * 50)
