import sys
import os
from datetime import date, timedelta
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from main import app
from seed import seed_database
from core.database import SessionLocal
from models.auth import User, Role
from models.eod import EODReport, EODTemplate
from core.security import hash_password
from core.rate_limit import _failed_attempts

client = TestClient(app)

def setup_module(module):
    _failed_attempts.clear()
    seed_database()

def test_eod_template_and_submission():
    # 1. Fetch default template
    tmpl_resp = client.get("/eod/template/default")
    if tmpl_resp.status_code != 200:
        print("Template fetch failed status:", tmpl_resp.status_code, "body:", tmpl_resp.json())
    assert tmpl_resp.status_code == 200

    tmpl_data = tmpl_resp.json()
    assert "Today's Work" in tmpl_data["body_md"]

    db = SessionLocal()
    emp_role = db.query(Role).filter(Role.name == "employee").first()
    emp_user = db.query(User).filter(User.email == "eod_emp@company.com").first()
    if not emp_user:
        emp_user = User(
            email="eod_emp@company.com",
            password_hash=hash_password("EodPass123!"),
            full_name="EOD Employee",
            role_id=emp_role.id
        )
        db.add(emp_user)
        db.commit()
    emp_user_id = emp_user.id
    db.close()

    # Login as Employee
    emp_login = client.post("/auth/login", json={"email": "eod_emp@company.com", "password": "EodPass123!"})
    emp_cookie = emp_login.cookies["ems_jwt"]

    today = date.today()

    # Clean up any residual EOD report for test isolation
    db = SessionLocal()
    db.query(EODReport).filter(EODReport.user_id == emp_user_id, EODReport.date == today).delete()
    db.commit()
    db.close()


    # 2. Submit EOD Report for today
    submit_resp = client.post(
        "/eod",
        json={"date": str(today), "body_md": tmpl_data["body_md"] + "\n- Completed feature task 1"},
        cookies={"ems_jwt": emp_cookie}
    )
    assert submit_resp.status_code == 201
    report_data = submit_resp.json()
    assert report_data["locked"] is False
    report_id = report_data["id"]

    # 3. Edit own report for today -> Allowed
    edit_resp = client.patch(
        f"/eod/{report_id}",
        json={"body_md": report_data["body_md"] + "\n- Added extra unit test"},
        cookies={"ems_jwt": emp_cookie}
    )
    assert edit_resp.status_code == 200
    assert "extra unit test" in edit_resp.json()["body_md"]

    # 4. Simulate Midnight Lock by setting report locked = True
    db = SessionLocal()
    rep = db.query(EODReport).filter(EODReport.id == report_id).first()
    rep.locked = True
    db.commit()
    db.close()

    locked_edit = client.patch(
        f"/eod/{report_id}",
        json={"body_md": "Attempt to edit locked report"},
        cookies={"ems_jwt": emp_cookie}
    )
    assert locked_edit.status_code == 403
    assert "Midnight Lock" in locked_edit.json()["detail"]

def test_team_eod_summary():
    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminPassword123!"})
    assert admin_login.status_code == 200
    admin_cookie = admin_login.cookies["ems_jwt"]


    today = date.today()

    team_resp = client.get(f"/eod/team?target_date={today}", cookies={"ems_jwt": admin_cookie})
    assert team_resp.status_code == 200
    team_data = team_resp.json()
    assert "submitted" in team_data
    assert "missing" in team_data

if __name__ == "__main__":
    print("Running Day 7 EOD Reports Tests...")
    setup_module(None)
    test_eod_template_and_submission()
    print("[OK] EOD template fetch, report submission, edit & midnight lock passed.")
    test_team_eod_summary()
    print("[OK] MD/Admin team EOD summary passed.")
    print("=" * 50)
    print("ALL DAY 7 EOD TESTS PASSED CLEANLY!")
    print("=" * 50)
