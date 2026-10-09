import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from main import app
from seed import seed_database
from core.database import SessionLocal
from models.auth import User, Role
from core.security import hash_password
from core.rate_limit import _failed_attempts

client = TestClient(app)

def setup_module(module):
    _failed_attempts.clear()
    seed_database()

def test_dashboards():
    # 1. Login as Admin
    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    assert admin_login.status_code == 200
    admin_cookie = admin_login.cookies["ems_jwt"]

    # Test Admin Dashboard
    admin_dash = client.get("/dashboard/admin", cookies={"ems_jwt": admin_cookie})
    assert admin_dash.status_code == 200
    admin_data = admin_dash.json()
    assert "system_stats" in admin_data
    assert "audit_logs" in admin_data

    # Test MD Dashboard
    md_dash = client.get("/dashboard/md", cookies={"ems_jwt": admin_cookie})
    assert md_dash.status_code == 200
    md_data = md_dash.json()
    assert "live_punch_feed" in md_data

    # Test Employee Dashboard
    emp_dash = client.get("/dashboard/employee", cookies={"ems_jwt": admin_cookie})
    assert emp_dash.status_code == 200
    emp_data = emp_dash.json()
    assert "punch_card" in emp_data
    assert "leave_balance" in emp_data
    assert "eod_today" in emp_data

if __name__ == "__main__":
    print("Running Days 10-12 Dashboard Tests...")
    setup_module(None)
    test_dashboards()
    print("[OK] Employee, MD, and Admin dashboard endpoints passed.")
    print("=" * 50)
    print("ALL DASHBOARD TESTS PASSED CLEANLY!")
    print("=" * 50)
