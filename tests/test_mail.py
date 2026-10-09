import sys
import os
from datetime import datetime, timezone
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from main import app
from seed import seed_database
from core.database import SessionLocal
from models.auth import User, Role
from models.attendance import Punch
from models.mail import MailRoutingRule, MailOutbox

from core.mailer import emit_mail_event, process_outbox_item, resolve_recipients
from core.security import hash_password
from core.rate_limit import _failed_attempts

client = TestClient(app)

def setup_module(module):
    _failed_attempts.clear()
    seed_database()

def test_default_mail_routing_rules_seeded():
    db = SessionLocal()
    rules = db.query(MailRoutingRule).all()
    event_types = [r.event_type for r in rules]
    assert "punch.in" in event_types
    assert "punch.out" in event_types
    assert "leave.requested" in event_types
    assert "eod.missing" in event_types
    db.close()

def test_punch_emits_outbox_and_dispatches():
    db = SessionLocal()
    # Ensure MD user exists
    md_role = db.query(Role).filter(Role.name == "md").first()
    md_user = db.query(User).filter(User.email == "md_boss@company.com").first()
    if not md_user:
        md_user = User(email="md_boss@company.com", password_hash=hash_password("MdPass123!"), full_name="MD Boss", role_id=md_role.id)
        db.add(md_user)
        db.commit()
    db.close()

    # Login as Employee and Punch IN
    emp_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    cookie = emp_login.cookies["ems_jwt"]

    now_utc = datetime.now(timezone.utc)
    today = now_utc.date()

    # Clean up punches for today for clean isolation
    db = SessionLocal()
    admin_u = db.query(User).filter(User.email == "admin@company.com").first()
    db.query(Punch).filter(Punch.user_id == admin_u.id, Punch.day == today).delete()
    db.commit()
    db.close()

    punch_resp = client.post(
        "/attendance/punch",
        json={"punch_type": "in", "claimed_at": now_utc.isoformat(), "work_mode": "office"},
        cookies={"ems_jwt": cookie}
    )
    if punch_resp.status_code != 201:
        print("Punch failed:", punch_resp.status_code, punch_resp.json())
    assert punch_resp.status_code == 201


    # Check Outbox entry
    db = SessionLocal()
    outbox_item = db.query(MailOutbox).filter(MailOutbox.event_type == "punch.in").order_by(MailOutbox.created_at.desc()).first()
    assert outbox_item is not None
    assert "md_boss@company.com" in outbox_item.to_emails

    # Process outbox item
    success = process_outbox_item(outbox_item, db)
    assert success is True
    assert outbox_item.status == "sent"
    db.close()

def test_admin_mail_rules_api():
    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    admin_cookie = admin_login.cookies["ems_jwt"]

    # 1. Get Rules
    rules_resp = client.get("/mail/rules", cookies={"ems_jwt": admin_cookie})
    assert rules_resp.status_code == 200
    assert len(rules_resp.json()) >= 5

    # 2. Add Custom Rule
    new_rule_resp = client.post(
        "/mail/rules",
        json={"event_type": "punch.in", "recipient_type": "email", "recipient_value": "hr_audit@company.com", "enabled": True},
        cookies={"ems_jwt": admin_cookie}
    )
    assert new_rule_resp.status_code == 201
    rule_data = new_rule_resp.json()
    assert rule_data["recipient_value"] == "hr_audit@company.com"

if __name__ == "__main__":
    print("Running Day 9 Mail Engine Tests...")
    setup_module(None)
    test_default_mail_routing_rules_seeded()
    print("[OK] Default mail routing rules seeding passed.")
    test_punch_emits_outbox_and_dispatches()
    print("[OK] Punch outbox event emission, recipient resolution & dispatch passed.")
    test_admin_mail_rules_api()
    print("[OK] Admin mail rules CRUD API passed.")
    print("=" * 50)
    print("ALL DAY 9 MAIL TESTS PASSED CLEANLY!")
    print("=" * 50)
