from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user, require_admin
from .. import crud, schemas, models
from ..email_service import send_notification_email
import csv
from fastapi.responses import StreamingResponse
from io import StringIO
from pathlib import Path
import uuid

router = APIRouter(prefix="/api/admin", tags=["admin"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "estimate_files"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "txt", "zip"}

ALLOWED_PROJECT_STATUSES = {
    "Estimation Initiation",
    "Client Review",
    "Client Feedback",
    "Project Awarded",
    "Canceled",
    "On Hold",
    "Revised Estimate",
    "Approved Internally",
}


def _can_delete_user(db: Session, target_user: models.User, current_user: models.User) -> tuple[bool, str | None]:
    if target_user.id == current_user.id:
        return False, "You cannot delete your own admin account."
    if target_user.role == 'admin':
        admin_count = db.query(models.User).filter(models.User.role == 'admin').count()
        if admin_count <= 1:
            return False, "Cannot delete the only admin account."
    return True, None


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    total_users = db.query(models.User).count()
    total_estimates = db.query(models.Estimate).count()
    recent_estimates = db.query(models.Estimate).order_by(models.Estimate.created_at.desc()).limit(10).all()
    total_value = db.query(models.Estimate).with_entities(models.Estimate.total_fixed_cost).all()
    total_value_sum = sum([v[0] or 0 for v in total_value])
    return {
        "total_users": total_users,
        "total_estimates": total_estimates,
        "recent_estimates": recent_estimates,
        "total_value": total_value_sum,
    }


# ===== User Management =====

@router.get("/users", response_model=list[schemas.User])
def list_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    return db.query(models.User).all()


@router.patch("/users/{user_id}/block", response_model=schemas.User)
def block_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot block your own account.")
    user = crud.block_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}/unblock", response_model=schemas.User)
def unblock_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    user = crud.unblock_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    ok, reason = _can_delete_user(db, target, current_user)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)
    success = crud.delete_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}


@router.post("/users/bulk-delete")
def bulk_delete_users(payload: dict = Body(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    ids = payload.get("ids") if isinstance(payload, dict) else None
    if not isinstance(ids, list) or not ids:
        raise HTTPException(status_code=422, detail="ids must be a non-empty list")

    deleted = 0
    skipped: list[dict] = []
    for raw_id in ids:
        try:
            user_id = int(raw_id)
        except (TypeError, ValueError):
            skipped.append({"id": raw_id, "reason": "Invalid id"})
            continue

        target = db.query(models.User).filter(models.User.id == user_id).first()
        if not target:
            skipped.append({"id": user_id, "reason": "User not found"})
            continue

        ok, reason = _can_delete_user(db, target, current_user)
        if not ok:
            skipped.append({"id": user_id, "reason": reason})
            continue

        if crud.delete_user(db, user_id):
            deleted += 1
        else:
            skipped.append({"id": user_id, "reason": "Delete failed"})

    return {"message": "Bulk user delete completed", "deleted": deleted, "skipped": skipped}


# ===== Estimate Management =====

@router.get("/estimates", response_model=list[schemas.Estimate])
def list_estimates(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    estimates = db.query(models.Estimate).all()
    for estimate in estimates:
        for item in estimate.files or []:
            item.download_url = f"/api/files/{item.id}"
        for comment in estimate.comments or []:
            if comment.file:
                comment.file.download_url = f"/api/files/{comment.file.id}"
    return estimates


@router.get("/estimates/{estimate_id}", response_model=schemas.Estimate)
def get_estimate(estimate_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    for item in estimate.files or []:
        item.download_url = f"/api/files/{item.id}"
    for comment in estimate.comments or []:
        if comment.file:
            comment.file.download_url = f"/api/files/{comment.file.id}"
    return estimate


@router.delete("/estimates/{estimate_id}")
def delete_estimate(estimate_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    db.delete(estimate)
    db.commit()
    return {"message": "Estimate deleted successfully"}


@router.post("/estimates/bulk-delete")
def bulk_delete_estimates(payload: dict = Body(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    ids = payload.get("ids") if isinstance(payload, dict) else None
    if not isinstance(ids, list) or not ids:
        raise HTTPException(status_code=422, detail="ids must be a non-empty list")

    deleted = 0
    skipped: list[dict] = []
    for raw_id in ids:
        try:
            estimate_id = int(raw_id)
        except (TypeError, ValueError):
            skipped.append({"id": raw_id, "reason": "Invalid id"})
            continue

        estimate = crud.get_estimate(db, estimate_id)
        if not estimate:
            skipped.append({"id": estimate_id, "reason": "Estimate not found"})
            continue

        db.delete(estimate)
        deleted += 1

    db.commit()
    return {"message": "Bulk estimate delete completed", "deleted": deleted, "skipped": skipped}


@router.patch("/estimates/{estimate_id}/lock")
def lock_estimate(estimate_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    estimate.is_editable = False
    db.commit()
    # Notify estimator
    if estimate.created_by_email:
        send_notification_email(
            to_email=estimate.created_by_email,
            subject="Your estimate has been locked",
            message=f"Admin has locked editing for your estimate. You can still view it in read-only mode.",
            estimate_title=estimate.name,
        )
    return {"message": "Estimate locked", "is_editable": False}


@router.patch("/estimates/{estimate_id}/unlock")
def unlock_estimate(estimate_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    estimate.is_editable = True
    db.commit()
    # Notify estimator
    if estimate.created_by_email:
        send_notification_email(
            to_email=estimate.created_by_email,
            subject="Your estimate has been unlocked",
            message="Admin has re-enabled editing for your estimate. You can now update it.",
            estimate_title=estimate.name,
        )
    return {"message": "Estimate unlocked", "is_editable": True}


@router.patch("/estimates/{estimate_id}/status", response_model=schemas.Estimate)
def update_estimate_status(
    estimate_id: int,
    body: schemas.EstimateStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(current_user)
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    status = (body.status or "").strip()
    if status not in ALLOWED_PROJECT_STATUSES:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Invalid project status",
                "allowed_statuses": sorted(ALLOWED_PROJECT_STATUSES),
            },
        )

    estimate.status = status
    db.commit()
    db.refresh(estimate)
    # Notify estimator
    if estimate.created_by_email:
        send_notification_email(
            to_email=estimate.created_by_email,
            subject=f"Estimate status updated: {status}",
            message=f"The status of your estimate has been changed to '{status}' by an admin.",
            estimate_title=estimate.name,
        )
    return estimate


@router.post("/estimates/{estimate_id}/comments", response_model=schemas.EstimateComment)
async def add_comment(
    estimate_id: int,
    comment_text: str = Form(...),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(current_user)
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if not comment_text.strip():
        raise HTTPException(status_code=422, detail="Comment text cannot be empty")

    estimate_file = None
    if file and file.filename:
        extension = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=422, detail="Unsupported file type")

        payload = await file.read()
        if len(payload) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File size exceeds 10 MB limit")

        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        stored_filename = f"{uuid.uuid4().hex}.{extension}" if extension else uuid.uuid4().hex
        abs_path = UPLOAD_DIR / stored_filename
        abs_path.write_bytes(payload)

        estimate_file = crud.add_estimate_file(
            db,
            estimate_id=estimate_id,
            user=current_user,
            original_filename=file.filename,
            stored_filename=stored_filename,
            file_path=str(abs_path),
        )

    comment = crud.add_estimate_comment(
        db,
        estimate_id,
        comment_text.strip(),
        current_user,
        file_id=(estimate_file.id if estimate_file else None),
    )
    if comment.file:
        comment.file.download_url = f"/api/files/{comment.file.id}"
    # Notify estimator
    if estimate.created_by_email:
        send_notification_email(
            to_email=estimate.created_by_email,
            subject="New admin comment on your estimate",
            message=f"An admin has added a comment: \"{comment_text.strip()[:200]}\"",
            estimate_title=estimate.name,
        )
    return comment


# ===== Reports / CSV Export =====

def generate_csv_users(db: Session):
    users = db.query(models.User).all()
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "full_name", "email", "role", "company_name", "status", "created_at"])
    for u in users:
        writer.writerow([u.id, u.full_name, u.email, u.role, u.company_name or '', "Active" if u.is_active else "Blocked", u.created_at])
    buf.seek(0)
    return buf


def generate_csv_estimates(db: Session):
    estimates = db.query(models.Estimate).all()
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Estimate ID", "Project Name", "Client Name", "Estimator Name", "Estimator Email",
        "Project Status", "Total Hours", "Final Fixed Cost", "Version", "Editable Status",
        "Created At", "Updated At"
    ])
    for e in estimates:
        writer.writerow([
            e.id, e.name, e.client_name or '', e.created_by_name or '', e.created_by_email or '',
            e.status or 'Estimation Initiation',
            e.total_estimated_hours or 0, e.total_fixed_cost or 0,
            e.version_number or 1,
            "Editable" if e.is_editable else "Locked",
            e.created_at, e.updated_at,
        ])
    buf.seek(0)
    return buf


@router.get("/reports/users.csv")
def export_users_csv(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    buf = generate_csv_users(db)
    return StreamingResponse(buf, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=users.csv"})


@router.get("/reports/estimates.csv")
def export_estimates_csv(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    buf = generate_csv_estimates(db)
    return StreamingResponse(buf, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=estimates.csv"})
