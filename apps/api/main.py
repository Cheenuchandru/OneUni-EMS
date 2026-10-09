import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from config import settings
from routers import auth, users, roles, attendance, calendar, leave, eod, projects, mail, dashboard, comms, notes
from seed import seed_database

app = FastAPI(
    title="Employee Management System (EMS) API",
    version="2.0-final",
    description="Internal Employee Management System API monolith with dual timestamps, RBAC, and mail worker."
)

# Static Files Directory for Profile Avatars
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
    return response


# Register Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(attendance.router)
app.include_router(calendar.router)
app.include_router(leave.router)
app.include_router(eod.router)
app.include_router(projects.router)
app.include_router(mail.router)
app.include_router(dashboard.router)
app.include_router(comms.router)
app.include_router(notes.router)










@app.on_event("startup")
def on_startup():
    """Run database seeder on application startup."""
    seed_database()

@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "ok",
        "version": "2.0-final",
        "environment": settings.ENVIRONMENT,
        "mail_provider": settings.SMTP_PROVIDER
    }

@app.get("/", tags=["System"])
async def root():
    return {
        "message": "Welcome to Employee Management System (EMS) API v2.0-final",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    import os

    ssl_key = os.getenv("SSL_KEYFILE", os.path.join(os.path.dirname(__file__), "key.pem"))
    ssl_cert = os.getenv("SSL_CERTFILE", os.path.join(os.path.dirname(__file__), "cert.pem"))
    
    if os.getenv("ENABLE_HTTPS", "false").lower() == "true" and os.path.exists(ssl_key) and os.path.exists(ssl_cert):
        print(f"[HTTPS] Starting FastAPI server on https://localhost:{settings.API_PORT}")
        uvicorn.run("main:app", host="0.0.0.0", port=settings.API_PORT, reload=True, ssl_keyfile=ssl_key, ssl_certfile=ssl_cert)
    else:
        print(f"[HTTP] Starting FastAPI server on http://localhost:{settings.API_PORT}")
        uvicorn.run("main:app", host="0.0.0.0", port=settings.API_PORT, reload=True)
