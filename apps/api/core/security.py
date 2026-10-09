import hashlib
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from config import settings

def sha256_prehash(password: str) -> bytes:
    """Pre-hash password with SHA-256 before passing to bcrypt."""
    return hashlib.sha256(password.encode("utf-8")).digest()

def hash_password(password: str) -> str:
    """
    Hash password using SHA-256 pre-hash + direct bcrypt.
    Bans passlib due to Python 3.13 deprecation bugs.
    """
    prehashed = sha256_prehash(password)
    hashed = bcrypt.hashpw(prehashed, bcrypt.gensalt())
    return hashed.decode("utf-8")

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify raw password against stored bcrypt hash after SHA-256 pre-hashing."""
    try:
        prehashed = sha256_prehash(password)
        return bcrypt.checkpw(prehashed, hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role_name: str, expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    payload: Dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "role": role_name,
        "iat": now,
        "exp": expire,
    }
    
    encoded_jwt = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate signed JWT access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None
