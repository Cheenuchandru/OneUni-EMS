# OneUni-EMS — Enterprise Employee Management System

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Proprietary-emerald?style=for-the-badge)]()

> **Oneuni Agri Platform Pvt Ltd** — DPIIT-recognised company behind [Agri.in](https://agri.in), [Milk.in](https://milk.in), and [TheOrganic.in](https://theorganic.in).

---

## 🌟 Overview

**OneUni-EMS** is a production-ready, full-stack Enterprise Employee Management System designed for high-integrity workforce tracking, EOD reporting, executive governance, and automated attendance management.

Built with a **Next.js 15 App Router** frontend and a high-performance **Python FastAPI monorepo backend**, the system enforces strict audit trails, dual-timestamp validation, and multi-tier Role-Based Access Control (RBAC).

---

## ✨ Key Features

### 🕒 1. Dual-Timestamp Punch Engine
- **Tamper-Resistant Tracking**: Captures both client-claimed timestamp (`claimed_at`) and server-verified timestamp (`server_at`).
- **Flagged Discrepancies**: Automatically flags time gaps exceeding 10 minutes to prevent system time manipulation.
- **Work Modes & Context**: Tracks Office vs Work From Home (WFH) along with device type, OS, browser, and IP address.

### 📝 2. EOD Reports & Executive Review Console
- **Daily Progress Tracking**: Employees submit markdown EOD reports linked to specific assigned projects.
- **1–5★ Rating & Review Notes**: MD and Managers can review reports, leave appreciation notes, and assign star ratings.
- **Card-Wise Activity Stream**: Visual cards displaying daily submitted EODs and task completions.

### 👥 3. Advanced Governance & Employee Management
- **Full Employee Governance**: MD and Admin roles can Create Users, Archive/Deactivate, Restore, or Remove accounts.
- **Default Password Standard**: Auto-generates initial credentials set strictly to `1UniAgMiOr`.
- **Mandatory First Login Password Change**: Intercepts first login with a mandatory security reset screen requiring the employee to set their permanent password.

### 📅 4. Attendance Regularizations & Holidays
- **Punch Correction Requests**: Employees request punch adjustments with reason notes; MD/Admin approve or reject with 1-click.
- **Calendar & Holiday Management**: Define company holidays, non-working days, and trigger automated day-marking jobs.

### 📊 5. MD Executive Portal & Live Presence
- **"Who's In Today" Bar**: Live breakdown of Office attendance, WFH, and Employees on Leave.
- **CSV Data Exports**: Export complete attendance logs and employee reports in standard CSV format.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Next.js 15.5 (App Router, Server & Client Components) |
| **Styling & Aesthetics** | Vanilla CSS Tokens, TailwindCSS, Dark Emerald Glassmorphism UI |
| **Backend API** | Python 3.11, FastAPI Monolith Architecture |
| **Database & ORM** | PostgreSQL 16 (SQLite fallback for dev), SQLAlchemy 2.0 |
| **Caching & Queue** | Redis 7 |
| **Authentication** | SHA-256 Pre-Hashing + Bcrypt, JWT in `httpOnly` `SameSite=Lax` Cookies |
| **DevOps & Deploy** | Docker, Docker Compose, GitHub Actions CI/CD Pipeline |

---

## 📁 Repository Structure

```text
EMS/
├── apps/
│   ├── api/                  # Python FastAPI Backend Monolith
│   │   ├── core/             # Database, Security, RBAC & Permissions
│   │   ├── models/           # SQLAlchemy Data Models (Auth, Attendance, Leave, EOD, Projects)
│   │   ├── routers/          # API Route Controllers
│   │   ├── seed.py           # Database Seeder & Schema Migrations
│   │   ├── main.py           # FastAPI Application Entrypoint
│   │   └── Dockerfile
│   └── web/                  # Next.js 15 Web Application
│       ├── app/              # App Router Pages (/admin, /md, /login, /dashboard, /punch, /eod)
│       ├── components/       # AuthProvider, Header, Logo, Navigation
│       ├── public/           # Static Favicons & Assets
│       └── Dockerfile
├── infra/                    # Production Docker Compose Configurations
├── .github/workflows/        # CI/CD Deployment Workflows (deploy.yml)
├── docker-compose.yml        # Root Multi-Container Orchestration
├── RUNBOOK.md                # Operational Maintenance & Backup Guide
└── README.md                 # System Documentation
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **Python**: `v3.11` or higher
- **Docker & Docker Compose** (Optional for containerized run)

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run Development Server
Install dependencies and launch both API and Web concurrently:
```bash
# Install Monorepo Root Dependencies
npm install

# Run Concurrently (FastAPI on http://localhost:8200 & Next.js on http://localhost:3009)
npm run dev
```

---

## 🐳 Docker Deployment (Production)

To launch the full production container stack (**PostgreSQL + Redis + FastAPI + Next.js + Mail**):

```bash
# Build and start all services in detached mode
docker-compose up -d --build

# View container logs
docker-compose logs -f

# Check stack status
docker-compose ps
```

### Service Access URLs:
- **Web Portal**: [http://localhost:3200](http://localhost:3200) *(or port configured in `.env`)*
- **API Monolith**: [http://localhost:8200](http://localhost:8200)
- **API Swagger Docs**: [http://localhost:8200/docs](http://localhost:8200/docs)

---

## 🔑 Default Seeded Accounts

| Role | Email | Initial Password |
|---|---|---|
| **System Admin** | `admin@company.com` | `AdminPassword123!` |
| **Managing Director (MD)** | `md@company.com` | `MDPassword123!` |
| **Team Employee** | `sarah@company.com` | `Employee123!` |
| **Newly Created User** | `*any*` | **`1UniAgMiOr`** *(Requires mandatory reset on 1st login)* |

---

## 🔒 Security Standards

- **Pre-Hashed Password Hashing**: Passwords are pre-hashed with SHA-256 before `bcrypt` processing to mitigate length attacks.
- **Secure Cookie Storage**: Authentication JWT tokens are stored strictly in `httpOnly`, `SameSite=Lax` cookies.
- **Audit Logging**: All account creations, role changes, archives, deletes, and punch overrides generate immutable entries in `audit_log`.
- **Security Headers**: Enforces `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and strict `Content-Security-Policy`.

---

## 📄 License & Ownership

© 2026 **Oneuni Agri Platform Pvt Ltd**. All rights reserved.  
Proprietary workforce software built for internal enterprise operations.
