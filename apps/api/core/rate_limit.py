import time
from typing import Dict, List, Tuple
from fastapi import HTTPException, status, Request

# In-memory sliding window rate limiter fallback (with Redis hooks when available)
_failed_attempts: Dict[str, List[float]] = {}
WINDOW_SECONDS = 15 * 60  # 15 minutes
MAX_FAILED_ATTEMPTS = 5

def check_rate_limit(request: Request, email: str):
    """
    Rate limit check: Max 5 failed attempts / 15 min per IP+email.
    Throws HTTP 429 Too Many Requests if limit exceeded.
    """
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{email.lower().strip()}"
    
    now = time.time()
    attempts = _failed_attempts.get(key, [])
    
    # Filter attempts within the 15-minute window
    valid_attempts = [t for t in attempts if now - t < WINDOW_SECONDS]
    _failed_attempts[key] = valid_attempts
    
    if len(valid_attempts) >= MAX_FAILED_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again in 15 minutes."
        )

def record_failed_attempt(request: Request, email: str):
    """Record a failed login attempt for the IP+email key."""
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{email.lower().strip()}"
    
    now = time.time()
    attempts = _failed_attempts.get(key, [])
    attempts.append(now)
    _failed_attempts[key] = attempts

def clear_failed_attempts(request: Request, email: str):
    """Clear failed attempts on successful login."""
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{email.lower().strip()}"
    if key in _failed_attempts:
        del _failed_attempts[key]
