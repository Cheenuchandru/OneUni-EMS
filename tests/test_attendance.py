import sys
import os
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from main import app
from seed import seed_database
from core.database import SessionLocal
from models.auth import User, Role
from models.attendance import Punch
from models.audit import AuditLog
from core.security import hash_password
from core.rate_limit import _failed_attempts
from core.device import parse_device_info

client = TestClient(app)

def setup_module(module):
    _failed_attempts.clear()
    seed_database()

def test_user_agent_parsing():
    # 1. iPhone Safari UA
    iphone_ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
    class DummyRequest:
        headers = {"user-agent": iphone_ua, "x-forwarded-for": "203.0.113.195"}
        client = None

    parsed_iphone = parse_device_info(DummyRequest())
    assert parsed_iphone["device_type"] == "mobile"
    assert "iOS" in parsed_iphone["os_name"]
    assert parsed_iphone["ip"] == "203.0.113.195"

    # 2. Windows Chrome UA
    windows_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    class DummyRequestWin:
        headers = {"user-agent": windows_ua}
        client = type("client", (), {"host": "192.168.1.50"})()

    parsed_win = parse_device_info(DummyRequestWin())
    assert parsed_win["device_type"] == "desktop"
    assert "Windows" in parsed_win["os_name"]
    assert parsed_win["ip"] == "192.168.1.50"

def test_punch_in_out_flow_and_immutability():
    db = SessionLocal()
    emp_role = db.query(Role).filter(Role.name == "employee").first()
    emp_user = db.query(User).filter(User.email == "punch_emp@company.com").first()
    if not emp_user:
        emp_user = User(
            email="punch_emp@company.com",
            password_hash=hash_password("PunchEmp123!"),
            full_name="Punch Employee",
            role_id=emp_role.id
        )
        db.add(emp_user)
        db.commit()
    db.close()

    # Clean up punches for test isolation
    db = SessionLocal()
    u = db.query(User).filter(User.email == "punch_emp@company.com").first()
    if u:
        db.query(Punch).filter(Punch.user_id == u.id, Punch.day == datetime.now(timezone.utc).date()).delete()
        db.commit()
    db.close()

    # Login as Employee
    login_resp = client.post("/auth/login", json={"email": "punch_emp@company.com", "password": "PunchEmp123!"})
    assert login_resp.status_code == 200
    emp_cookie = login_resp.cookies["ems_jwt"]


    now_utc = datetime.now(timezone.utc)
    claimed_time = (now_utc - timedelta(minutes=15)).isoformat()

    # 1. Punch IN
    punch_in_resp = client.post(
        "/attendance/punch",
        json={"punch_type": "in", "claimed_at": claimed_time, "work_mode": "office"},
        headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)"},
        cookies={"ems_jwt": emp_cookie}
    )
    assert punch_in_resp.status_code == 201
    in_data = punch_in_resp.json()
    assert in_data["punch_type"] == "in"
    assert in_data["device_type"] == "mobile"
    assert in_data["gap_minutes"] >= 14.0

    punch_id = in_data["id"]

    # 2. Duplicate Punch IN on same day -> Must fail (400)
    dup_in = client.post(
        "/attendance/punch",
        json={"punch_type": "in", "claimed_at": claimed_time, "work_mode": "office"},
        cookies={"ems_jwt": emp_cookie}
    )
    assert dup_in.status_code == 400
    assert "already recorded" in dup_in.json()["detail"]

    # 3. Punch OUT
    punch_out_resp = client.post(
        "/attendance/punch",
        json={"punch_type": "out", "claimed_at": now_utc.isoformat(), "work_mode": "office"},
        cookies={"ems_jwt": emp_cookie}
    )
    assert punch_out_resp.status_code == 201
    out_data = punch_out_resp.json()
    assert out_data["punch_type"] == "out"

    # 4. Employee attempt to edit punch via Admin route -> Must fail (403)
    emp_patch = client.patch(
        f"/attendance/admin/punches/{punch_id}",
        json={"reason": "Self edit attempt"},
        cookies={"ems_jwt": emp_cookie}
    )
    assert emp_patch.status_code == 403

def test_admin_punch_edit_with_reason():
    # Login as Admin
    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    admin_cookie = admin_login.cookies["ems_jwt"]

    # Get employee punch ID
    db = SessionLocal()
    emp_user = db.query(User).filter(User.email == "punch_emp@company.com").first()
    punch = db.query(Punch).filter(Punch.user_id == emp_user.id, Punch.punch_type == "in").first()
    assert punch is not None
    punch_id = punch.id
    db.close()

    # 1. Admin edit missing reason -> Must fail (400)
    no_reason = client.patch(
        f"/attendance/admin/punches/{punch_id}",
        json={"reason": "   ", "work_mode": "wfh"},
        cookies={"ems_jwt": admin_cookie}
    )
    assert no_reason.status_code == 400

    # 2. Admin edit with valid reason -> Succeeds (200)
    admin_patch = client.patch(
        f"/attendance/admin/punches/{punch_id}",
        json={"reason": "Approved late adjustment by HR", "work_mode": "wfh"},
        cookies={"ems_jwt": admin_cookie}
    )
    assert admin_patch.status_code == 200
    patched_data = admin_patch.json()
    assert patched_data["work_mode"] == "wfh"

    # 3. Verify audit log entry
    db = SessionLocal()
    audit_row = db.query(AuditLog).filter(AuditLog.action == "punch.admin_edit", AuditLog.entity_id == punch_id).first()
    assert audit_row is not None
    assert audit_row.after_state["edit_reason"] == "Approved late adjustment by HR"
    assert audit_row.after_state["work_mode"] == "wfh"
    db.close()

if __name__ == "__main__":
    print("Running Day 4 Attendance Engine Tests...")
    setup_module(None)
    test_user_agent_parsing()
    print("[OK] Server-side User-Agent & IP device capture passed.")
    test_punch_in_out_flow_and_immutability()
    print("[OK] Dual timestamps, punch IN/OUT flow & employee immutability passed.")
    test_admin_punch_edit_with_reason()
    print("[OK] Admin punch edit with mandatory reason & audit snapshot passed.")
    print("=" * 50)
    print("ALL DAY 4 ATTENDANCE TESTS PASSED CLEANLY!")
    print("=" * 50)
