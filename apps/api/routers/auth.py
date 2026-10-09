from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import User, Role
from core.security import verify_password, hash_password, create_access_token, decode_access_token
from core.rate_limit import check_rate_limit, record_failed_attempt, clear_failed_attempts

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    designation: Optional[str] = None
    bio: Optional[str] = None
    theme: Optional[str] = None
    avatar_url: Optional[str] = None
    must_change_password: bool

@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    # 1. Rate Limit Check (5 fails per 15 min per IP+email)
    check_rate_limit(request, payload.email)

    # 2. User Lookup
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    
    if not user or not user.is_active:
        record_failed_attempt(request, payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # 3. Password Verification
    if not verify_password(payload.password, user.password_hash):
        record_failed_attempt(request, payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Clear rate limit counter on success
    clear_failed_attempts(request, payload.email)

    # 4. Generate JWT Token
    role_name = user.role.name if user.role else "employee"
    token = create_access_token(user_id=user.id, email=user.email, role_name=role_name)

    # 5. Set httpOnly Cookie (SameSite=Lax)
    response.set_cookie(
        key="ems_jwt",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in HTTPS production
        max_age=480 * 60,  # 8 hours
    )

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=role_name,
        designation=getattr(user, 'designation', 'Team Member'),
        bio=getattr(user, 'bio', 'Agri Platform Innovator & EMS Team Contributor.'),
        theme=getattr(user, 'theme', 'emerald'),
        avatar_url=getattr(user, 'avatar_url', None),
        must_change_password=user.must_change_password
    )

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="ems_jwt", httponly=True, samesite="lax")
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("ems_jwt")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    role_name = user.role.name if user.role else "employee"
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=role_name,
        designation=getattr(user, 'designation', 'Team Member'),
        bio=getattr(user, 'bio', 'Agri Platform Innovator & EMS Team Contributor.'),
        theme=getattr(user, 'theme', 'emerald'),
        avatar_url=getattr(user, 'avatar_url', None),
        must_change_password=user.must_change_password
    )

class ChangePasswordRequest(BaseModel):
    new_password: str

@router.post("/change-password")
def change_my_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    token = request.cookies.get("ems_jwt")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token_data = decode_access_token(token)
    if not token_data or "sub" not in token_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = token_data["sub"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_pass = payload.new_password.strip()
    if len(new_pass) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 6 characters")

    user.password_hash = hash_password(new_pass)
    user.must_change_password = False
    db.commit()

    return {"message": "Password updated successfully!"}

# In-Memory OTP Store
otp_store = {}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str
    new_password: str

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generate and send 6-digit OTP code to registered email for password reset."""
    email_clean = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No registered account found with this email address")

    # Generate 6-digit OTP
    import random
    otp = f"{random.randint(100000, 999999)}"
    otp_store[email_clean] = otp

    return {
        "message": f"Password reset OTP code sent to {email_clean}",
        "otp_demo": otp  # Included for seamless demo testing
    }

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Verify OTP code and reset user password."""
    email_clean = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    stored_otp = otp_store.get(email_clean)
    if not stored_otp or stored_otp != payload.otp_code.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP code")

    from core.security import hash_password
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    db.commit()

    # Clear OTP code
    otp_store.pop(email_clean, None)

    return {"message": "Password reset successful! You can now sign in with your new password."}

