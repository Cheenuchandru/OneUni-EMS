# CLAUDE.md - Employee Management System (EMS)

## Project Overview
EMS is a plug-and-play internal Employee Management System built with a 14-day vertical-slice roadmap.

- **Owner:** Oneuni Agri Platform Pvt Ltd
- **Version:** 2.0-final
- **Ports:** Web `:3200` | API `:8200` | DB `:5432` | Redis `:6379` | MailHog `:8025`

## Tech Stack
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS
- **Backend:** FastAPI (Python 3.11/3.13), Pydantic v2, SQLAlchemy ORM, Alembic
- **Database:** PostgreSQL 16 (UUIDv7 PKs, cursor pagination)
- **Cache/Queue:** Redis 7 (Rate limiting, permission cache, outbox)
- **Mail:** Gmail SMTP (`smtp.gmail.com:465` SSL) via `aiosmtplib` + background outbox worker (MailHog for dev)
- **Packaging:** Docker Compose

## Non-Negotiables & Rules
1. **FastAPI Modular Monolith:** One PostgreSQL schema per module.
2. **SecureRouter:** Every route 401-by-default, explicit permission key per endpoint checked against `auth.role_permissions`.
3. **UUIDv7 PKs:** Everywhere.
4. **Pagination:** Cursor pagination only (offset pagination banned).
5. **ORM Only:** Pydantic v2 models + SQLAlchemy ORM (no raw SQL except migrations/triggers).
6. **JWT Cookies:** httpOnly, Secure, SameSite=Lax.
7. **Passwords:** SHA-256 pre-hash + direct bcrypt (`passlib` banned due to Python 3.13 incompatibility).
8. **Punch Immutability:** `INSERT`-only for employees. Enforced via API route omission, DB trigger, and ORM post-insert read-only flag.
9. **Audit Trail:** All write endpoints wrapped by audit middleware writing to `audit.audit_log`.

## Monorepo Layout
- `/apps/web` - Next.js 15 frontend
- `/apps/api` - FastAPI backend
- `/infra` - Docker Compose and deployment files

## Progress Log
- **Day 1:** Monorepo scaffold, FastAPI baseline, Next.js baseline, Alembic init, health check `/health`.
- **Day 2:** Auth Foundation complete! SHA-256 + bcrypt hashing, JWT httpOnly cookies, sliding rate-limiter, seeded roles & admin, `/auth/login`, `/auth/logout`, `/auth/me`, `POST /users`, and `/login` + `/me` frontend UI.
- **Day 3:** RBAC Engine + Audit Middleware complete! Permission key registry, `@requires_permission` decorator, 60s permission cache with invalidation, `/roles` management CRUD API, dynamic custom role creation & cloning, and immutable `audit_log` snapshot recording.
- **Day 4:** Attendance Engine complete! Dual timestamps (`claimed_at` vs `server_at`), server-side User-Agent parsing (`ua-parser`) into device class/OS/browser, `punches` schema with `UNIQUE(user_id, day, punch_type)`, 3-way immutability, `/attendance/punch`, `/attendance/me`, `/attendance/users/{id}`, `PATCH /admin/punches/{id}` with mandatory edit reason, and `PunchWidget` UI.
- **Day 5:** Calendar Engine + Auto Day-Marking complete! `calendar_days` & `calendar_day_status` schema, `auto_mark_day(target_date)` engine evaluating approved leave -> holiday -> punch IN -> absent, `/calendar/days` upsert API, `/calendar/me`, `/calendar/users/{id}`, `/admin/jobs/mark-day` backfill endpoint.
- **Day 6:** Leave Management complete! `leave_requests` & `leave_balances` schema, default 18 days/year balance tracking, overlap validation on `POST /leave`, `DELETE /leave/{id}`, `GET /leave/pending`, `POST /leave/{id}/approve` & `reject` syncing calendar status and audit snapshots.
- **Day 7:** EOD Reports with Templates + Midnight Lock complete! `eod_templates` & `eod_reports` schema, default markdown template seeding, `GET /eod/template/default`, `POST /eod`, `PATCH /eod/{id}` with midnight locking (`403 Forbidden` after midnight), `GET /eod/me`, `GET /eod/team` submitted vs missing report detector.
- **Day 8:** Project Management complete! `projects`, `tasks`, and `project_status_updates` schema, `POST /projects`, `GET /projects/{id}` timeline feed, `POST /projects/{id}/tasks`, `PATCH /tasks/{id}/status` with assignee ownership checks (non-assignee blocked with `403 Forbidden`).
- **Day 9:** Mail Engine (Gmail SMTP) + Admin Routing Rules complete! `mail_routing_rules` & `mail_outbox` schema, transactional outbox emitter `emit_mail_event()`, recipient resolution for `role:md` & `user:requester`, `process_outbox_item()` with Gmail SMTP `smtp.gmail.com:465` (SSL) support, `/mail/rules` CRUD API, `/mail/outbox` viewer & retry endpoints.
- **Day 10:** Employee Dashboard complete! Self-service portal at `/dashboard`, punch widget, leave balance, today's EOD status, assigned tasks, and personal activity log feed.
- **Day 11:** MD Dashboard complete! Oversight dashboard at `/md`, live team punch feed (highlighting claimed vs server gap > 10m), pending leave approvals queue, today's EOD report counter, active projects status.
- **Day 12:** Admin Dashboard complete! System master control room at `/admin`, system statistics, user/role management, and DB-level immutable audit log feed.
- **Day 13:** Communication, Bell & CSV Export complete! `announcements`, `comments`, and `notifications` schema, `/announcements`, `/comments`, `/notifications`, and `GET /export/attendance.csv` streaming CSV endpoint.
- **Day 14:** Production Hardening, Seed, Docs & Ship complete! Security Headers Middleware (CSP, X-Frame-Options DENY, nosniff, Referrer-Policy), `SEED_DEMO=true` dataset seeder, `RUNBOOK.md` deployment & rollback guide, full test suite passing.
