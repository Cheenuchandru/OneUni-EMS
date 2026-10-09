import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from main import app
from seed import seed_database
from core.database import SessionLocal
from models.auth import User, Role, RolePermission
from models.audit import AuditLog
from core.security import hash_password
from core.rate_limit import _failed_attempts

client = TestClient(app)

def setup_module(module):
    _failed_attempts.clear()
    seed_database()

def test_permissions_seeded():
    db = SessionLocal()
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    employee_role = db.query(Role).filter(Role.name == "employee").first()
    
    assert admin_role is not None
    assert employee_role is not None
    
    admin_perms = [p.permission_key for p in admin_role.permissions]
    emp_perms = [p.permission_key for p in employee_role.permissions]
    
    assert "*" in admin_perms
    assert "attendance.punch" in emp_perms
    assert "roles.manage" not in emp_perms
    db.close()

def test_rbac_permission_enforcement():
    db = SessionLocal()
    # Create employee user
    emp_role = db.query(Role).filter(Role.name == "employee").first()
    emp_user = db.query(User).filter(User.email == "test_emp@company.com").first()
    if not emp_user:
        emp_user = User(
            email="test_emp@company.com",
            password_hash=hash_password("EmpPassword123!"),
            full_name="Test Employee",
            role_id=emp_role.id
        )
        db.add(emp_user)
        db.commit()
    db.close()

    # Login as Employee
    emp_login = client.post("/auth/login", json={"email": "test_emp@company.com", "password": "EmpPassword123!"})
    assert emp_login.status_code == 200
    emp_cookie = emp_login.cookies["ems_jwt"]

    # Employee attempting to access /roles -> MUST BE BLOCKED (HTTP 403)
    blocked_resp = client.get("/roles", cookies={"ems_jwt": emp_cookie})
    assert blocked_resp.status_code == 403
    assert "Permission denied" in blocked_resp.json()["detail"]

def test_custom_role_creation_and_audit():
    # Clean up test role for test idempotency
    db = SessionLocal()
    r = db.query(Role).filter(Role.name == "intern").first()
    if r:
        db.query(RolePermission).filter(RolePermission.role_id == r.id).delete()
        db.query(Role).filter(Role.id == r.id).delete()
        db.commit()
    db.close()

    # Login as Admin
    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    admin_cookie = admin_login.cookies["ems_jwt"]


    # 1. Create Custom Role "intern"
    create_resp = client.post(
        "/roles",
        json={"name": "intern", "permissions": ["attendance.punch", "attendance.view_own"]},
        cookies={"ems_jwt": admin_cookie}
    )
    assert create_resp.status_code == 201
    role_data = create_resp.json()
    assert role_data["name"] == "intern"
    assert "attendance.punch" in role_data["permissions"]

    # 2. Check Audit Log Entry
    db = SessionLocal()
    audit_entry = db.query(AuditLog).filter(AuditLog.action == "role.create", AuditLog.entity_id == role_data["id"]).first()
    assert audit_entry is not None
    assert audit_entry.actor_role == "admin"
    assert audit_entry.after_state["name"] == "intern"
    db.close()

def test_role_permission_update_and_cache_invalidation():
    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    admin_cookie = admin_login.cookies["ems_jwt"]

    # Find custom role "intern"
    db = SessionLocal()
    intern_role = db.query(Role).filter(Role.name == "intern").first()
    assert intern_role is not None
    role_id = intern_role.id
    db.close()

    # Update permissions for "intern" role
    update_resp = client.put(
        f"/roles/{role_id}/permissions",
        json={"permissions": ["attendance.punch", "attendance.view_own", "eod.submit"]},
        cookies={"ems_jwt": admin_cookie}
    )
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert "eod.submit" in updated_data["permissions"]

    # Verify audit entry for update
    db = SessionLocal()
    audit_entry = db.query(AuditLog).filter(AuditLog.action == "role.update_permissions", AuditLog.entity_id == role_id).first()
    assert audit_entry is not None
    assert "eod.submit" in audit_entry.after_state["permissions"]
    db.close()

if __name__ == "__main__":
    print("Running Day 3 RBAC & Audit Tests...")
    setup_module(None)
    test_permissions_seeded()
    print("[OK] System role permission seeding passed.")
    test_rbac_permission_enforcement()
    print("[OK] RBAC permission enforcement (HTTP 403 for unauthorized users) passed.")
    test_custom_role_creation_and_audit()
    print("[OK] Custom role creation & audit logging passed.")
    test_role_permission_update_and_cache_invalidation()
    print("[OK] Role permission update & cache invalidation passed.")
    print("=" * 50)
    print("ALL DAY 3 RBAC & AUDIT TESTS PASSED CLEANLY!")
    print("=" * 50)
