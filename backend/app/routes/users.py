from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, get_password_hash, verify_password
from ..database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=schemas.User)
def get_my_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/me/profile", response_model=schemas.User)
def update_my_profile(
    body: schemas.UserProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.full_name = body.full_name
    db.commit()
    db.refresh(user)
    return user


@router.put("/me/password")
def update_my_password(
    body: schemas.UserPasswordUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if verify_password(body.new_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="New password must be different from current password.")

    user.hashed_password = get_password_hash(body.new_password)
    db.commit()

    return {"message": "Password updated successfully."}
