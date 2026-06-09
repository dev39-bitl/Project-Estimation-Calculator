import hashlib
import os
import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from ..database import get_db
from ..email_service import send_verification_code_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_CODE_SALT = os.getenv("PW_SALT", "brainium-local-dev-salt-2024")


def _hash_code(code: str) -> str:
    return hashlib.sha256((code + _CODE_SALT).encode()).hexdigest()


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def _get_code_expiry_minutes() -> int:
    try:
        return int(os.getenv("EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES", "10"))
    except (ValueError, TypeError):
        return 10


def _invalidate_old_codes(db: Session, user_id: int) -> None:
    """Mark all unused codes as used for a given user before issuing a new one."""
    db.query(models.EmailVerification).filter(
        models.EmailVerification.user_id == user_id,
        models.EmailVerification.is_used == False,  # noqa: E712
    ).update({"is_used": True})
    db.commit()


def _create_and_send_verification_code(db: Session, user: models.User) -> None:
    """Generate a fresh code, store its hash, and dispatch the email."""
    _invalidate_old_codes(db, user.id)

    code = _generate_code()
    expiry_minutes = _get_code_expiry_minutes()

    verification = models.EmailVerification(
        user_id=user.id,
        email=user.email,
        code_hash=_hash_code(code),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes),
        is_used=False,
    )
    db.add(verification)
    db.commit()

    # Raises if SMTP not configured — signup will surface as 503
    send_verification_code_email(user.email, user.full_name, code)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/signup", response_model=schemas.User)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="This email is already registered.")

    user = models.User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        company_name=user_in.company_name,
        role=(user_in.role or "estimator"),
        is_active=True,
        is_email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        _create_and_send_verification_code(db, user)
    except Exception as exc:
        # Roll back the new user so they can retry signup cleanly
        db.delete(user)
        db.commit()
        raise HTTPException(
            status_code=503,
            detail=(
                "Account could not be created because the verification email "
                "failed to send. Please check SMTP configuration. "
                f"Detail: {str(exc)}"
            ),
        )

    return user


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login", response_model=schemas.Token)
def login(form_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your account has been disabled by the administrator.",
        )
    if not user.is_email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in.",
        )

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return schemas.Token(access_token=access_token, token_type="bearer", user=user)


@router.post("/verify-email")
def verify_email(body: schemas.VerifyEmailRequest, db: Session = Depends(get_db)):
    """Submit a 6-digit code to verify the user's email address."""
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_email_verified:
        return {"message": "Email already verified. You can log in."}

    code_hash = _hash_code(body.code.strip())
    now = datetime.now(timezone.utc)

    record = (
        db.query(models.EmailVerification)
        .filter(
            models.EmailVerification.user_id == user.id,
            models.EmailVerification.code_hash == code_hash,
            models.EmailVerification.is_used == False,  # noqa: E712
        )
        .order_by(models.EmailVerification.created_at.desc())
        .first()
    )

    if not record:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired. Please request a new one.",
        )

    record.is_used = True
    user.is_email_verified = True
    user.email_verified_at = now
    db.commit()

    return {"message": "Email verified successfully. You can now log in."}


@router.post("/resend-verification-code")
def resend_verification_code(
    body: schemas.ResendVerificationRequest, db: Session = Depends(get_db)
):
    """Issue a fresh 6-digit code and email it to the user."""
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_email_verified:
        return {"message": "Email already verified. You can log in."}

    try:
        _create_and_send_verification_code(db, user)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Could not send verification email: {str(exc)}",
        )

    return {"message": "A new verification code has been sent to your email."}


@router.get("/me", response_model=schemas.User)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
