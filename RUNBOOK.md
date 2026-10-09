# EMS (Employee Management System) - Operational Runbook

## Deployment Quickstart

### 1. Environment Configuration
Copy `.env.example` to `.env` and fill in production secrets:
```bash
cp .env.example .env
```
Ensure the following key variables are configured:
- `ENVIRONMENT=production`
- `DATABASE_URL=postgresql://ems_user:SECURE_PASSWORD@db:5432/ems_db`
- `JWT_SECRET=YOUR_PRODUCTION_HIGH_ENTROPY_SECRET_KEY`
- `SMTP_USER=oneuni@gmail.com`
- `SMTP_PASSWORD=YOUR_16_CHAR_GMAIL_APP_PASSWORD`

### 2. Launch Stack via Docker Compose
```bash
docker compose -f infra/docker-compose.yml up -d --build
```

### 3. Service Port Mappings
- **Web App Interface (Next.js 15):** `http://localhost:3200`
- **FastAPI Monolith API:** `http://localhost:8200`
- **API Documentation (Swagger UI):** `http://localhost:8200/docs`
- **PostgreSQL Database:** `localhost:5432`
- **Redis Cache & Queue:** `localhost:6379`
- **MailHog Local Dev Web UI:** `http://localhost:8025`

---

## Seeded Default Accounts
| Role | Email | Default Password |
|---|---|---|
| **Admin** | `admin@company.com` | `AdminPassword123!` |
| **Managing Director (MD)** | `md@company.com` | `MDPassword123!` |
| **Employee** | `sarah@company.com` | `Employee123!` |

---

## Maintenance & Backup Procedures

### Database Backup
```bash
docker exec -t ems_db pg_dump -U ems_user ems_db > ./backups/ems_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database Restore
```bash
docker exec -i ems_db psql -U ems_user -d ems_db < ./backups/ems_backup_TARGET.sql
```

---

## Rollback Plan
1. Stop running containers:
   ```bash
   docker compose -f infra/docker-compose.yml down
   ```
2. Checkout stable release tag / commit:
   ```bash
   git checkout tags/v2.0-stable
   ```
3. Re-run migrations and start stack:
   ```bash
   docker compose -f infra/docker-compose.yml up -d --build
   ```

---

## Security Non-Negotiables Verification
- [x] Passwords SHA-256 pre-hashed before bcrypt hashing.
- [x] JWT tokens stored exclusively in `httpOnly`, `SameSite=Lax` cookies.
- [x] Employee punch records are strictly `INSERT`-only.
- [x] All write endpoints append to `audit_log`.
- [x] Security headers enforced (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy`).
