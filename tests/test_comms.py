import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from main import app
from seed import seed_database
from core.database import SessionLocal
from models.comms import Announcement, Comment, Notification
from core.rate_limit import _failed_attempts

client = TestClient(app)

def setup_module(module):
    _failed_attempts.clear()
    seed_database()

def test_announcements_comments_notifications_export():
    # 1. Login as Admin
    admin_login = client.post("/auth/login", json={"email": "admin@company.com", "password": "AdminTestPass123!"})
    assert admin_login.status_code == 200
    admin_cookie = admin_login.cookies["ems_jwt"]

    # 2. Create Announcement
    ann_resp = client.post(
        "/announcements",
        json={"title": "Q3 All Hands Meeting", "body_md": "All hands meeting scheduled for Friday 3 PM.", "pinned": True},
        cookies={"ems_jwt": admin_cookie}
    )
    assert ann_resp.status_code == 201
    ann_data = ann_resp.json()
    assert ann_data["title"] == "Q3 All Hands Meeting"
    assert ann_data["pinned"] is True

    # 3. List Announcements
    list_ann = client.get("/announcements", cookies={"ems_jwt": admin_cookie})
    assert list_ann.status_code == 200
    assert len(list_ann.json()) >= 1

    # 4. Create Comment on a task
    comm_resp = client.post(
        "/comments",
        json={"entity_type": "task", "entity_id": "task_123_abc", "body": "Please review the PR."},
        cookies={"ems_jwt": admin_cookie}
    )
    assert comm_resp.status_code == 201
    comm_data = comm_resp.json()
    assert comm_data["body"] == "Please review the PR."

    # 5. Get Comments
    get_comm = client.get("/comments/task/task_123_abc", cookies={"ems_jwt": admin_cookie})
    assert get_comm.status_code == 200
    assert len(get_comm.json()) >= 1

    # 6. Notifications check
    notif_resp = client.get("/notifications", cookies={"ems_jwt": admin_cookie})
    assert notif_resp.status_code == 200
    notifs = notif_resp.json()
    assert len(notifs) >= 1

    # 7. Test Attendance CSV Export
    csv_resp = client.get("/export/attendance.csv", cookies={"ems_jwt": admin_cookie})
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Employee_Name,Employee_Email,Date,Status" in csv_resp.text

if __name__ == "__main__":
    print("Running Day 13 Comms & CSV Export Tests...")
    setup_module(None)
    test_announcements_comments_notifications_export()
    print("[OK] Announcements, Comments, Notifications, and Attendance CSV Export passed.")
    print("=" * 50)
    print("ALL DAY 13 COMMS TESTS PASSED CLEANLY!")
    print("=" * 50)
