import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from main import app
from seed import seed_database
from core.database import SessionLocal
from models.auth import User, Role
from models.projects import Project, Task, ProjectStatusUpdate
from core.security import hash_password
from core.rate_limit import _failed_attempts

client = TestClient(app)

def setup_module(module):
    _failed_attempts.clear()
    seed_database()

def test_project_and_task_lifecycle():
    # Clean up test project for test idempotency
    db = SessionLocal()
    p = db.query(Project).filter(Project.code == "EMS-V2").first()
    if p:
        db.query(ProjectStatusUpdate).filter(ProjectStatusUpdate.project_id == p.id).delete()
        db.query(Task).filter(Task.project_id == p.id).delete()
        db.query(Project).filter(Project.id == p.id).delete()
        db.commit()
    db.close()

    # 1. Login as Admin
    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    admin_cookie = admin_login.cookies["ems_jwt"]


    # 2. Create Project
    proj_resp = client.post(
        "/projects",
        json={"name": "EMS Core V2", "code": "EMS-V2", "description": "Employee system rebuild"},
        cookies={"ems_jwt": admin_cookie}
    )
    assert proj_resp.status_code == 201
    proj_data = proj_resp.json()
    proj_id = proj_data["id"]

    # Create test employee 1 & 2
    db = SessionLocal()
    emp_role = db.query(Role).filter(Role.name == "employee").first()
    emp1 = db.query(User).filter(User.email == "proj_emp1@company.com").first()
    if not emp1:
        emp1 = User(email="proj_emp1@company.com", password_hash=hash_password("EmpPass123!"), full_name="Emp One", role_id=emp_role.id)
        db.add(emp1)
    emp2 = db.query(User).filter(User.email == "proj_emp2@company.com").first()
    if not emp2:
        emp2 = User(email="proj_emp2@company.com", password_hash=hash_password("EmpPass123!"), full_name="Emp Two", role_id=emp_role.id)
        db.add(emp2)
    db.commit()
    emp1_id = emp1.id
    emp2_id = emp2.id
    db.close()

    # 3. Create Task assigned to Emp 1
    task_resp = client.post(
        f"/projects/{proj_id}/tasks",
        json={"title": "Setup DB Schemas", "assignee_id": emp1_id, "priority": "high"},
        cookies={"ems_jwt": admin_cookie}
    )
    assert task_resp.status_code == 201
    task_data = task_resp.json()
    task_id = task_data["id"]

    # 4. Login as Emp 1 & Update status of own assigned task -> Allowed
    emp1_login = client.post("/auth/login", json={"email": "proj_emp1@company.com", "password": "EmpPass123!"})
    emp1_cookie = emp1_login.cookies["ems_jwt"]

    status_resp = client.patch(
        f"/projects/tasks/{task_id}/status",
        json={"status": "in_progress", "note": "Started working on Alembic migrations"},
        cookies={"ems_jwt": emp1_cookie}
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "in_progress"

    # 5. Login as Emp 2 & Attempt to update status of task assigned to Emp 1 -> Blocked (403)
    emp2_login = client.post("/auth/login", json={"email": "proj_emp2@company.com", "password": "EmpPass123!"})
    emp2_cookie = emp2_login.cookies["ems_jwt"]

    blocked_resp = client.patch(
        f"/projects/tasks/{task_id}/status",
        json={"status": "done", "note": "Emp 2 attempting status edit"},
        cookies={"ems_jwt": emp2_cookie}
    )
    assert blocked_resp.status_code == 403
    assert "Permission denied" in blocked_resp.json()["detail"]

    # 6. Verify timeline row was created
    detail_resp = client.get(f"/projects/{proj_id}", cookies={"ems_jwt": admin_cookie})
    assert detail_resp.status_code == 200
    timeline = detail_resp.json()["timeline"]
    assert len(timeline) >= 1
    assert timeline[0]["new_status"] == "in_progress"

if __name__ == "__main__":
    print("Running Day 8 Project Management Tests...")
    setup_module(None)
    test_project_and_task_lifecycle()
    print("[OK] Project creation, task assignment, assignee status updates & ownership checks passed.")
    print("=" * 50)
    print("ALL DAY 8 PROJECT TESTS PASSED CLEANLY!")
    print("=" * 50)
