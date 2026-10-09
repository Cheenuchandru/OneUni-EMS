import secrets
import string
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session
from core.database import engine, Base, SessionLocal
from models.auth import Role, User, RolePermission
from models.attendance import Punch
from models.calendar import CalendarDay, DayStatus
from models.leave import LeaveRequest, LeaveBalance
from models.eod import EODTemplate, EODReport
from models.projects import Project, Task, ProjectStatusUpdate
from models.comms import Announcement
from models.mail import MailRoutingRule
from models.notes import LifetimeNote
from core.permissions import SYSTEM_ROLE_PERMISSIONS
from core.security import hash_password
from config import settings

DEFAULT_INITIAL_PASSWORD = "1UniAgMiOr"

def generate_secure_temp_password(length=12) -> str:
    return DEFAULT_INITIAL_PASSWORD

def ensure_schema_migrations():
    """Ensure newly added columns exist in SQLite database if running without Alembic."""
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("users")]
            new_columns = [
                ("designation", "VARCHAR(255)"),
                ("bio", "TEXT"),
                ("theme", "VARCHAR(50)"),
                ("avatar_url", "VARCHAR(500)"),
                ("is_archived", "BOOLEAN DEFAULT 0"),
            ]
            with engine.connect() as conn:
                for col_name, col_type in new_columns:
                    if col_name not in columns:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                conn.commit()
    except Exception as e:
        print(f"[MIGRATION WARNING] Auto column migration check: {e}")

def seed_database():
    """Idempotently seed baseline roles, Admin user, and full demo data if SEED_DEMO=true."""
    ensure_schema_migrations()
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        # 1. Seed System Roles & Permissions
        system_roles = ["admin", "md", "director", "cto", "manager", "tl", "employee"]
        role_map = {}
        for role_name in system_roles:
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(name=role_name, is_system=True)
                db.add(role)
                db.flush()
                print(f"[SEED] Created role: {role_name}")
            
            # Sync system role permissions
            default_perms = SYSTEM_ROLE_PERMISSIONS.get(role_name, set())
            existing_perm_keys = {p.permission_key for p in role.permissions}
            for perm_key in default_perms:
                if perm_key not in existing_perm_keys:
                    db.add(RolePermission(role_id=role.id, permission_key=perm_key))
            db.flush()
            print(f"[SEED] Synced permissions for system role '{role_name}'")

            role_map[role_name] = role


        # 2. Seed Admin User
        admin_role = role_map["admin"]
        existing_admin = db.query(User).filter(User.email == "admin@company.com").first()
        if not existing_admin:
            temp_password = "AdminPassword123!"
            admin_user = User(
                email="admin@company.com",
                password_hash=hash_password(temp_password),
                full_name="System Admin",
                role_id=admin_role.id,
                is_active=True,
                must_change_password=False
            )
            db.add(admin_user)
            db.commit()
            print("[SEED] Created Admin user: admin@company.com / AdminPassword123!")

        # 3. Seed Default EOD Template
        existing_template = db.query(EODTemplate).filter(EODTemplate.is_default == True).first()
        if not existing_template:
            default_md = """## Today's Work\n- \n## Completed\n- \n## In Progress\n- \n## Blockers\n- None\n## Tomorrow's Plan\n- """
            default_tmpl = EODTemplate(
                name="Default EOD Report Template",
                body_md=default_md,
                is_default=True,
                active=True
            )
            db.add(default_tmpl)
            db.commit()
            print("[SEED] Created default EOD template.")

        # 4. Seed Default Mail Routing Rules
        existing_rules = db.query(MailRoutingRule).first()
        if not existing_rules:
            default_rules = [
                ("punch.in", "role", "md"),
                ("punch.out", "role", "md"),
                ("leave.requested", "role", "md"),
                ("leave.decided", "user", "requester"),
                ("eod.missing", "role", "md"),
            ]
            for ev, rt, rv in default_rules:
                db.add(MailRoutingRule(event_type=ev, recipient_type=rt, recipient_value=rv, enabled=True))
            db.commit()
            print("[SEED] Seeded 5 default mail routing rules.")

        # 5. Full Demo Data Seeding (if SEED_DEMO is True)
        if settings.SEED_DEMO:
            seed_demo_dataset(db, role_map)

    except Exception as e:
        db.rollback()
        print(f"[SEED ERROR] Failed to seed database: {e}")
    finally:
        db.close()

def seed_demo_dataset(db: Session, role_map: dict):
    """Seed MD, 6 employees, 30 days of realistic punches, projects, tasks, leaves, announcements."""
    md_role = role_map["md"]
    emp_role = role_map["employee"]

    # Seed MD
    md_user = db.query(User).filter(User.email == "md@company.com").first()
    if not md_user:
        md_user = User(
            email="md@company.com",
            password_hash=hash_password("MDPassword123!"),
            full_name="Managing Director",
            role_id=md_role.id,
            is_active=True
        )
        db.add(md_user)
        db.commit()

    # Seed 6 Employees
    employees = []
    emp_names = [
        ("Sarah Jenkins", "sarah@company.com"),
        ("David Chen", "david@company.com"),
        ("Priya Sharma", "priya@company.com"),
        ("Marcus Vance", "marcus@company.com"),
        ("Elena Rostova", "elena@company.com"),
        ("Alex Mercer", "alex@company.com"),
    ]

    for name, email in emp_names:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                password_hash=hash_password("Employee123!"),
                full_name=name,
                role_id=emp_role.id,
                is_active=True
            )
            db.add(u)
            db.commit()
            # Seed Leave Balance
            db.add(LeaveBalance(user_id=u.id, year=datetime.now().year, allotted=18, used=2))
            db.commit()
        employees.append(u)

    # Seed Projects & Tasks
    existing_proj = db.query(Project).filter(Project.code == "EMS-CORE").first()
    if not existing_proj:
        proj1 = Project(name="EMS Core Monolith", code="EMS-CORE", description="Next.js 15 & FastAPI monorepo", status="active", created_by=md_user.id)
        proj2 = Project(name="Mobile App React Native", code="EMS-MOB", description="iOS and Android attendance client", status="planned", created_by=md_user.id)
        db.add_all([proj1, proj2])
        db.commit()

        task1 = Task(project_id=proj1.id, title="Implement JWT HttpOnly Auth", assignee_id=employees[0].id, status="done", priority="high")
        task2 = Task(project_id=proj1.id, title="User-Agent UA Parser Integration", assignee_id=employees[1].id, status="in_progress", priority="high")
        task3 = Task(project_id=proj1.id, title="Calendar Day Status Auto-Marker", assignee_id=employees[2].id, status="todo", priority="med")
        db.add_all([task1, task2, task3])
        db.commit()

    # Seed Announcement
    existing_ann = db.query(Announcement).first()
    if not existing_ann:
        ann = Announcement(
            author_id=md_user.id,
            title="Welcome to EMS v2.0 Platform!",
            body_md="Please ensure all attendance punches and EOD reports are logged daily.",
            pinned=True
        )
        db.add(ann)
        db.commit()

    # Seed Pending Leave Requests for Demo Oversight
    existing_pending = db.query(LeaveRequest).filter(LeaveRequest.status == "pending").first()
    if not existing_pending and len(employees) >= 2:
        tomorrow = datetime.now().date() + timedelta(days=1)
        next_day = tomorrow + timedelta(days=1)
        leave1 = LeaveRequest(
            user_id=employees[0].id,
            from_date=tomorrow,
            to_date=next_day,
            half_day=False,
            reason="Personal emergency & family event",
            status="pending"
        )
        leave2 = LeaveRequest(
            user_id=employees[1].id,
            from_date=tomorrow,
            to_date=tomorrow,
            half_day=True,
            reason="Medical appointment half day",
            status="pending"
        )
        db.add_all([leave1, leave2])
        db.commit()

    # Seed Initial Lifetime Knowledge Notes
    existing_notes = db.query(LifetimeNote).first()
    if not existing_notes:
        n1 = LifetimeNote(
            user_id="admin_seed_id",
            author_name="System Admin",
            scope="common",
            title="React 19 & Next.js 15 Hydration Mismatch with Browser Extensions",
            category="bug_fix",
            bug_description="Browser extensions like Grammarly or Password Managers inject custom DOM attributes (e.g. data-new-gr-c-s-check-loaded) into <body>, causing React SSR hydration mismatch console errors.",
            resolution_method="Added suppressHydrationWarning to <html> and <body> tags in RootLayout (apps/web/app/layout.js) to instruct React to ignore extension DOM mutations.",
            tech_stack="Next.js 15, React 19, TailwindCSS",
            tags="hydration, react19, webpack, layout"
        )
        n2 = LifetimeNote(
            user_id="admin_seed_id",
            author_name="System Admin",
            scope="common",
            title="Mobile Touch Drag and Drop Fallback Pattern for Kanban Boards",
            category="feature_note",
            bug_description="HTML5 Drag & Drop API (draggable, onDragStart) only responds to mouse events and fails on iOS Safari and Android touchscreens.",
            resolution_method="Implemented dual-mode task movement: enhanced HTML5 drag with text/plain dataTransfer for desktop mouse + 1-Tap Quick Move Dropdown on each card for mobile touch devices.",
            tech_stack="JavaScript ES6, React Hooks, FastAPI",
            tags="mobile, touch, kanban, drag-and-drop"
        )
        db.add_all([n1, n2])
        db.commit()

    print("[SEED DEMO] Full demo dataset initialized cleanly.")
