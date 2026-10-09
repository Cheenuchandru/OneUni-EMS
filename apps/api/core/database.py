import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

database_url = settings.DATABASE_URL

# Handle SQLite fallback for local dev when PostgreSQL is not running
if "postgresql" in database_url and os.environ.get("USE_SQLITE_FALLBACK", "true").lower() == "true":
    # Use SQLite for standalone local execution if postgres is unreachable
    try:
        from sqlalchemy import inspect
        test_engine = create_engine(database_url, connect_args={"connect_timeout": 2})
        test_engine.connect().close()
    except Exception:
        # Fallback to local SQLite file database
        database_url = "sqlite:///./ems_dev.db"

connect_args = {"check_same_thread": False} if "sqlite" in database_url else {}

engine = create_engine(database_url, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
