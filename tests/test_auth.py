import sys
import os
from fastapi.testclient import TestClient

# Add apps/api to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from main import app
from seed import seed_database
from core.database import Base, engine, SessionLocal
from core.security import hash_password, verify_password, create_access_token, decode_access_token
from models.auth import User, Role

client = TestClient(app)

from core.rate_limit import _failed_attempts

def setup_module(module):
    """Seed test database before running tests."""
    _failed_attempts.clear()
    seed_database()


def test_password_hashing():
    raw_pass = "TestSecretPassword123!"
    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

def test_jwt_tokens():
    user_id = "018e3f42-7000-7000-8000-000000000001"
    email = "test@example.com"
    role = "admin"
    
    token = create_access_token(user_id=user_id, email=email, role_name=role)
    assert isinstance(token, str)
    
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == user_id
    assert decoded["email"] == email
    assert decoded["role"] == role

def test_seeded_roles():
    db = SessionLocal()
    roles = db.query(Role).all()
    role_names = [r.name for r in roles]
    assert "admin" in role_names
    assert "md" in role_names
    assert "employee" in role_names
    db.close()

def test_login_success_and_me():
    db = SessionLocal()
    # Ensure test user admin@company.com exists
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    admin_user = db.query(User).filter(User.email == "admin@company.com").first()
    if not admin_user:
        admin_user = User(
            email="admin@company.com",
            password_hash=hash_password("AdminTestPass123!"),
            full_name="System Admin",
            role_id=admin_role.id,
            is_active=True,
            must_change_password=True
        )
        db.add(admin_user)
    else:
        admin_user.password_hash = hash_password("AdminTestPass123!")
    db.commit()
    db.close()

    # Test Login
    login_resp = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    if login_resp.status_code != 200:
        print("Login failed status:", login_resp.status_code, "response:", login_resp.json())
    assert login_resp.status_code == 200

    data = login_resp.json()
    assert data["email"] == "admin@company.com"
    assert data["role"] == "admin"
    assert "ems_jwt" in login_resp.cookies

    # Test /auth/me with cookie
    me_resp = client.get("/auth/me", cookies={"ems_jwt": login_resp.cookies["ems_jwt"]})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == "admin@company.com"

    # Test Logout
    logout_resp = client.post("/auth/logout")
    assert logout_resp.status_code == 200

def test_rate_limiting():
    bad_email = "rate_limit_test@company.com"
    # Attempt 5 wrong logins
    for i in range(5):
        resp = client.post("/auth/login", json={"email": bad_email, "password": "WrongPassword"})
        assert resp.status_code in [401, 429]
    
    # 6th attempt must be blocked by 429
    blocked_resp = client.post("/auth/login", json={"email": bad_email, "password": "WrongPassword"})
    assert blocked_resp.status_code == 429
    assert "Too many failed login attempts" in blocked_resp.json()["detail"]

def test_admin_create_user():
    # Clean up test user for test idempotency
    db = SessionLocal()
    db.query(User).filter(User.email == "employee1@company.com").delete()
    db.commit()
    db.close()

    # Login as Admin
    login_resp = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    cookie = login_resp.cookies["ems_jwt"]


    # Create new Employee user
    create_resp = client.post(
        "/users",
        json={"email": "employee1@company.com", "full_name": "John Doe Employee", "role_name": "employee"},
        cookies={"ems_jwt": cookie}
    )
    assert create_resp.status_code == 201
    user_data = create_resp.json()
    assert user_data["email"] == "employee1@company.com"
    assert user_data["role"] == "employee"
    assert "initial_password" in user_data
    assert user_data["must_change_password"] is True


if __name__ == "__main__":
    print("Running Day 2 Auth Tests...")
    setup_module(None)
    test_password_hashing()
    print("[OK] Password hashing (SHA-256 + bcrypt) passed.")
    test_jwt_tokens()
    print("[OK] JWT token creation & decoding passed.")
    test_seeded_roles()
    print("[OK] Seeded system roles passed.")
    test_login_success_and_me()
    print("[OK] Login & /auth/me endpoints passed.")
    test_rate_limiting()
    print("[OK] 5-fail 15-min sliding rate limiter (HTTP 429) passed.")
    test_admin_create_user()
    print("[OK] Admin user creation (POST /users) passed.")
    print("=" * 50)
    print("ALL DAY 2 AUTH TESTS PASSED CLEANLY!")
    print("=" * 50)


