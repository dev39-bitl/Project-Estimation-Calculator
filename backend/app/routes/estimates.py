from fastapi import APIRouter, Depends, HTTPException, Query, Body, UploadFile, File, Form
from fastapi.responses import FileResponse
from pathlib import Path
import os
import re
import uuid
from sqlalchemy.orm import Session
from .. import crud, schemas, calculator, models
from ..database import get_db
from ..auth import get_current_user
from ..email_service import send_admin_notification_email
from pydantic import ValidationError

router = APIRouter(prefix="/api", tags=["estimates"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "estimate_files"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "txt", "zip"}

ALLOWED_PROJECT_STATUSES = {
    "Draft",
    "Estimation Initiation",
    "Client Review",
    "Client Feedback",
    "Project Awarded",
    "Canceled",
    "On Hold",
    "Revised Estimate",
    "Approved Internally",
    "Closed",
}


# ---------------------------------------------------------------------------
# Notification helpers
# ---------------------------------------------------------------------------

def _notify_admin_new_estimate(estimate: models.Estimate, estimator: models.User, db: Session | None = None) -> None:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    send_admin_notification_email(
        subject="New estimate created",
        title="New estimate created",
        message="An estimator has created or finalized an estimate.",
        details={
            "Project name": estimate.name or "-",
            "Client name": estimate.client_name or "-",
            "Estimator name": estimator.full_name,
            "Estimator email": estimator.email,
            "Total hours": str(round(float(estimate.total_estimated_hours or 0), 2)),
            "Final fixed cost": str(round(float(estimate.final_fixed_cost or estimate.total_fixed_cost or 0), 2)),
            "Status": estimate.status or "Estimation Initiation",
            "Portal link": frontend_url,
        },
        db=db,
        event_type="estimate_created",
    )


def _notify_admin_draft_created(estimate: models.Estimate, estimator: models.User, db: Session | None = None) -> None:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    send_admin_notification_email(
        subject="New estimate created",
        title="New estimate draft created",
        message="An estimate draft has been auto-saved for the first time.",
        details={
            "Project name": estimate.name or "Untitled Estimate",
            "Client name": estimate.client_name or "-",
            "Estimator name": estimator.full_name,
            "Estimator email": estimator.email,
            "Status": estimate.status or "Draft",
            "Portal link": frontend_url,
        },
        db=db,
        event_type="estimate_draft_created",
    )


def _notify_admin_version_updated(
    estimate: models.Estimate,
    estimator: models.User,
    old_version: int,
    new_version: int,
    change_comment: str,
    db: Session | None = None,
) -> None:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    send_admin_notification_email(
        subject="Estimate updated",
        title="Estimate updated",
        message="An estimator has submitted a new estimate version.",
        details={
            "Project name": estimate.name or "-",
            "Estimator name": estimator.full_name,
            "Estimator email": estimator.email,
            "Old version": str(old_version),
            "New version": str(new_version),
            "Change comment": change_comment or "-",
            "Portal link": frontend_url,
        },
        db=db,
        event_type="estimate_updated",
    )


def _notify_admin_status_changed_by_estimator(
    estimate: models.Estimate,
    estimator: models.User,
    old_status: str,
    new_status: str,
    db: Session | None = None,
) -> None:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    send_admin_notification_email(
        subject="Estimate status changed by estimator",
        title="Estimate status changed by estimator",
        message="An estimator updated estimate project status.",
        details={
            "Project name": estimate.name or "-",
            "Estimator name": estimator.full_name,
            "Estimator email": estimator.email,
            "Old status": old_status,
            "New status": new_status,
            "Portal link": frontend_url,
        },
        db=db,
        event_type="estimate_status_changed_by_estimator",
    )


def _sanitize_filename(name: str) -> str:
    base = os.path.basename(name or "file")
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
    return cleaned or "file"


def _has_minimum_draft_data(payload: dict) -> bool:
    if not isinstance(payload, dict):
        return False
    name = str(payload.get('name') or '').strip()
    if name:
        return True

    tech = payload.get('tech_stack_json') or {}
    if isinstance(tech, dict) and str(tech.get('primary') or '').strip():
        return True

    modules = payload.get('modules') or []
    if isinstance(modules, list):
        for mod in modules:
            if not isinstance(mod, dict):
                continue
            if str(mod.get('name') or '').strip():
                return True
            for feat in (mod.get('features') or []):
                if not isinstance(feat, dict):
                    continue
                if str(feat.get('name') or '').strip():
                    return True
                try:
                    if float(feat.get('estimated_hours') or 0) > 0:
                        return True
                except (TypeError, ValueError):
                    pass
    return False


# ===== Legacy Estimate Endpoints (Backward Compatible) =====

@router.post("/estimates", response_model=schemas.Estimate)
def create_estimate(estimate_in: dict = Body(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Create an estimate. Accepts legacy payloads or new fixed-cost payloads at the same endpoint for compatibility."""
    try:
        if isinstance(estimate_in, dict):
            # Status is admin-controlled; ignore user-supplied status at creation.
            estimate_in.pop("status", None)

        # If modules or project_info present, treat as fixed-cost estimate
        if isinstance(estimate_in, dict) and ("modules" in estimate_in or "project_info" in estimate_in or estimate_in.get("is_fixed_cost")):
            fixed = schemas.EstimateCreateFixedCost(**estimate_in)
            result = crud.create_estimate_fixed_cost(db, fixed, user=current_user)
        else:
            # Otherwise try legacy schema
            legacy = schemas.EstimateCreateLegacy(**estimate_in)
            result = crud.create_estimate_legacy(db, legacy, user=current_user)

        _notify_admin_new_estimate(result, current_user, db=db)
        return result
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save estimate: {str(e)}")


@router.post('/estimates/draft', response_model=schemas.Estimate)
def create_estimate_draft(estimate_in: dict = Body(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Create a draft estimate for in-progress form data (no version history)."""
    try:
        if not _has_minimum_draft_data(estimate_in):
            raise HTTPException(status_code=422, detail='Minimum draft data required (project name, primary technology, or module/feature).')

        estimate_in = dict(estimate_in or {})
        estimate_in['status'] = 'Draft'
        estimate_in['is_draft'] = True
        estimate_in.pop('last_change_comment', None)
        fixed = schemas.EstimateCreateFixedCost(**estimate_in)
        created = crud.create_estimate_draft(db, fixed, user=current_user)
        _notify_admin_draft_created(created, current_user, db=db)
        return created
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'Failed to auto-save draft: {str(e)}')


@router.put('/estimates/{estimate_id}/draft', response_model=schemas.Estimate)
def update_estimate_draft(estimate_id: int, estimate_in: dict = Body(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Update an existing draft estimate in-place (no version history)."""
    db_estimate = crud.get_estimate(db, estimate_id)
    if not db_estimate:
        raise HTTPException(status_code=404, detail='Estimate not found')
    if db_estimate.created_by_user_id is not None and db_estimate.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not authorized to modify this estimate')
    if not db_estimate.is_draft and str(db_estimate.status or '').strip().lower() != 'draft':
        raise HTTPException(status_code=409, detail='This estimate is not an active draft')

    if not _has_minimum_draft_data(estimate_in):
        raise HTTPException(status_code=422, detail='Minimum draft data required (project name, primary technology, or module/feature).')

    try:
        estimate_in = dict(estimate_in or {})
        estimate_in['status'] = 'Draft'
        estimate_in['is_draft'] = True
        estimate_in.pop('last_change_comment', None)
        fixed = schemas.EstimateCreateFixedCost(**estimate_in)
        updated = crud.update_estimate_draft(db, estimate_id, fixed, user=current_user)
        if not updated:
            raise HTTPException(status_code=404, detail='Estimate not found')
        return updated
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'Failed to auto-save draft: {str(e)}')


@router.get("/estimates/{estimate_id}", response_model=schemas.Estimate)
def get_estimate(estimate_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get a specific estimate by ID"""
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if estimate.created_by_user_id is not None and estimate.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this estimate")
    for item in estimate.files or []:
        item.download_url = f"/api/files/{item.id}"
    for comment in estimate.comments or []:
        if comment.file:
            comment.file.download_url = f"/api/files/{comment.file.id}"
    return estimate


@router.get("/estimates", response_model=list[schemas.Estimate])
def get_all_estimates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get all estimates with pagination (only current user)"""
    # admin can see all estimates
    if current_user.role == 'admin':
        estimates = crud.get_all_estimates(db, user_id=None, skip=skip, limit=limit)
    else:
        estimates = crud.get_all_estimates(db, user_id=current_user.id, skip=skip, limit=limit)

    for estimate in estimates:
        for item in estimate.files or []:
            item.download_url = f"/api/files/{item.id}"
        for comment in estimate.comments or []:
            if comment.file:
                comment.file.download_url = f"/api/files/{comment.file.id}"
    return estimates


@router.get("/files/{file_id}")
def download_estimate_file(file_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    estimate_file = crud.get_estimate_file(db, file_id)
    if not estimate_file:
        raise HTTPException(status_code=404, detail="File not found")

    estimate = crud.get_estimate(db, estimate_file.estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    is_admin = current_user.role == 'admin'
    is_owner = estimate.created_by_user_id is not None and estimate.created_by_user_id == current_user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to access this file")

    file_path = Path(estimate_file.file_path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Stored file not found")

    return FileResponse(path=str(file_path), filename=estimate_file.original_filename, media_type="application/octet-stream")


@router.get("/estimates/{estimate_id}/files", response_model=list[schemas.EstimateFile])
def list_estimate_files(estimate_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    is_admin = current_user.role == 'admin'
    is_owner = estimate.created_by_user_id is not None and estimate.created_by_user_id == current_user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to view files for this estimate")

    for item in estimate.files or []:
        item.download_url = f"/api/files/{item.id}"
    return estimate.files or []


@router.post("/estimates/{estimate_id}/files", response_model=list[schemas.EstimateFile])
async def upload_estimate_files(
    estimate_id: int,
    files: list[UploadFile] = File(...),
    upload_comment: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    is_admin = current_user.role == 'admin'
    is_owner = estimate.created_by_user_id is not None and estimate.created_by_user_id == current_user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to upload files for this estimate")
    if not is_admin and estimate.is_editable is False:
        raise HTTPException(status_code=403, detail="This estimate is locked by admin and cannot be edited.")

    if not files:
        raise HTTPException(status_code=422, detail="No files provided")

    normalized_comment = (upload_comment or "").strip()
    if len(normalized_comment) > 500:
        raise HTTPException(status_code=422, detail="Document purpose/comment must be 500 characters or fewer")
    if not normalized_comment:
        normalized_comment = None

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    uploaded: list[models.EstimateFile] = []

    for upload in files:
        if not upload or not upload.filename:
            continue

        safe_original = _sanitize_filename(upload.filename)
        extension = safe_original.rsplit('.', 1)[-1].lower() if '.' in safe_original else ''
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=422, detail=f"Unsupported file type: {safe_original}")

        payload = await upload.read()
        if len(payload) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"File size exceeds 10 MB limit: {safe_original}")

        stored_filename = f"{uuid.uuid4().hex}.{extension}" if extension else uuid.uuid4().hex
        abs_path = UPLOAD_DIR / stored_filename
        abs_path.write_bytes(payload)

        estimate_file = crud.add_estimate_file(
            db,
            estimate_id=estimate_id,
            user=current_user,
            original_filename=safe_original,
            stored_filename=stored_filename,
            file_path=str(abs_path),
            uploaded_by_role=current_user.role,
            file_size=len(payload),
            mime_type=(upload.content_type or "application/octet-stream"),
            upload_comment=normalized_comment,
        )
        uploaded.append(estimate_file)

    db.commit()
    for item in uploaded:
        db.refresh(item)
        item.download_url = f"/api/files/{item.id}"

    # Optional notifications after successful upload only; never block action.
    try:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
        if current_user.role == 'admin':
            if estimate.created_by_email:
                from ..email_service import send_notification_email

                send_notification_email(
                    to_email=estimate.created_by_email,
                    subject="New supporting files added by admin",
                    message="Admin uploaded supporting files to your estimate.",
                    estimate_title=estimate.name,
                    details={
                        "Project name": estimate.name or "-",
                        "Files uploaded": str(len(uploaded)),
                        "Upload comment": normalized_comment or "No comment added",
                        "Portal link": frontend_url,
                    },
                    event_type="admin_supporting_files_uploaded",
                )
        else:
            # Notify admin only for non-draft/finalized estimate uploads.
            if not estimate.is_draft and str(estimate.status or '').strip().lower() != 'draft':
                send_admin_notification_email(
                    subject="Supporting files uploaded",
                    title="Supporting files uploaded",
                    message="Estimator uploaded supporting files to an estimate.",
                    details={
                        "Project name": estimate.name or "-",
                        "Estimator name": current_user.full_name,
                        "Estimator email": current_user.email,
                        "Files uploaded": str(len(uploaded)),
                        "Upload comment": normalized_comment or "No comment added",
                        "Portal link": frontend_url,
                    },
                    db=db,
                    event_type="estimator_supporting_files_uploaded",
                )
    except Exception:
        pass

    return uploaded


@router.delete("/estimates/{estimate_id}/files/{file_id}")
def delete_estimate_file(
    estimate_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    estimate_file = crud.get_estimate_file(db, file_id)
    if not estimate_file or estimate_file.estimate_id != estimate_id:
        raise HTTPException(status_code=404, detail="File not found")

    is_admin = current_user.role == 'admin'
    is_owner = estimate.created_by_user_id is not None and estimate.created_by_user_id == current_user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to delete this file")
    if not is_admin and estimate.is_editable is False:
        raise HTTPException(status_code=403, detail="This estimate is locked by admin and cannot be edited.")

    file_path = Path(estimate_file.file_path or "")
    db.delete(estimate_file)
    db.commit()
    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
        except OSError:
            pass

    return {"message": "File deleted successfully"}


@router.put("/estimates/{estimate_id}", response_model=schemas.Estimate)
def update_estimate(estimate_id: int, estimate_in: dict = Body(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Update an existing estimate"""
    db_estimate = crud.get_estimate(db, estimate_id)
    if not db_estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if db_estimate.created_by_user_id is not None and db_estimate.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this estimate")
    if db_estimate.is_editable is False:
        raise HTTPException(status_code=403, detail="This estimate is locked by admin and cannot be edited.")
    try:
        if not isinstance(estimate_in, dict):
            raise HTTPException(status_code=422, detail="Invalid update payload")

        old_version = int(db_estimate.version_number or 1)

        # Status is admin-controlled; ignore estimator-supplied status.
        estimate_in.pop("status", None)

        # Frontend sends full fixed-cost payload for edits. Comment is mandatory.
        if "modules" in estimate_in or "project_info" in estimate_in or estimate_in.get("is_fixed_cost"):
            fixed = schemas.EstimateCreateFixedCost(**estimate_in)
            is_draft_finalize = bool(db_estimate.is_draft) or str(db_estimate.status or '').strip().lower() == 'draft'
            if not is_draft_finalize and (not fixed.last_change_comment or not fixed.last_change_comment.strip()):
                raise HTTPException(status_code=422, detail="Change comment is required when updating an estimate")
            updated = crud.update_estimate_fixed_cost(
                db,
                estimate_id,
                fixed,
                user=current_user,
                require_change_comment=not is_draft_finalize,
            )
        else:
            legacy = schemas.EstimateUpdate(**estimate_in)
            updated = crud.update_estimate(db, estimate_id, legacy)

        if not updated:
            raise HTTPException(status_code=404, detail="Estimate not found")
        was_draft_before = bool(db_estimate.is_draft) or str(db_estimate.status or '').lower() == 'draft'
        if was_draft_before:
            _notify_admin_new_estimate(updated, current_user, db=db)
        else:
            new_version = int(updated.version_number or old_version)
            _notify_admin_version_updated(
                updated,
                current_user,
                old_version=old_version,
                new_version=new_version,
                change_comment=str(estimate_in.get('last_change_comment') or ''),
                db=db,
            )
        return updated
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to update estimate: {str(e)}")


@router.delete("/estimates/{estimate_id}")
def delete_estimate(estimate_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete an estimate"""
    db_estimate = crud.get_estimate(db, estimate_id)
    if not db_estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if db_estimate.created_by_user_id is not None and db_estimate.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this estimate")
    success = crud.delete_estimate(db, estimate_id)
    if not success:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return {"message": "Estimate deleted successfully"}


@router.patch("/estimates/{estimate_id}/comments/read")
def mark_comments_read(estimate_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Mark all admin comments on this estimate as read by the estimator"""
    db_estimate = crud.get_estimate(db, estimate_id)
    if not db_estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if db_estimate.created_by_user_id is not None and db_estimate.created_by_user_id != current_user.id:
        if current_user.role != 'admin':
            raise HTTPException(status_code=403, detail="Not authorized")
    crud.mark_comments_read(db, estimate_id)
    return {"message": "Comments marked as read"}


@router.patch("/estimates/{estimate_id}/status", response_model=schemas.Estimate)
def update_estimate_status_by_estimator(
    estimate_id: int,
    body: schemas.EstimateStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Allow estimator/owner to update project status and notify admin."""
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    is_owner = estimate.created_by_user_id is not None and estimate.created_by_user_id == current_user.id
    if current_user.role != 'admin' and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to update this estimate status")

    new_status = (body.status or "").strip()
    if new_status not in ALLOWED_PROJECT_STATUSES:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Invalid project status",
                "allowed_statuses": sorted(ALLOWED_PROJECT_STATUSES),
            },
        )

    old_status = estimate.status or "Estimation Initiation"
    estimate.status = new_status
    db.commit()
    db.refresh(estimate)

    if old_status != new_status:
        _notify_admin_status_changed_by_estimator(estimate, current_user, old_status, new_status, db=db)

    return estimate


# ===== Fixed-Cost Estimation Endpoints =====

@router.post("/fixed-cost-estimates/", response_model=schemas.Estimate)
def create_fixed_cost_estimate(estimate: schemas.EstimateCreateFixedCost, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Create a new fixed-cost estimate with modules and features"""
    return crud.create_estimate_fixed_cost(db, estimate, user=current_user)


@router.get("/estimates/{estimate_id}/breakdown")
def get_estimate_breakdown(estimate_id: int, db: Session = Depends(get_db)):
    """Get detailed breakdown of estimate calculation (modules, features, costs, overhead)"""
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    
    if not estimate.is_fixed_cost:
        raise HTTPException(status_code=400, detail="This estimate is not a fixed-cost estimate")
    
    stack_level = estimate.tech_stack_json.get("stack_level", "standard") if estimate.tech_stack_json else "standard"
    stack_multiplier = calculator.get_stack_multiplier(db, stack_level)
    
    breakdown = calculator.calculate_estimate_breakdown(
        db, estimate, estimate.modules, estimate.settings, stack_multiplier
    )
    return breakdown


# ===== Module Management =====

@router.post("/estimates/{estimate_id}/modules/", response_model=schemas.Module)
def create_module(estimate_id: int, module: schemas.ModuleCreate, db: Session = Depends(get_db)):
    """Create a new module in an estimate"""
    estimate = crud.get_estimate(db, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return crud.create_module(db, estimate_id, module)


@router.put("/modules/{module_id}", response_model=schemas.Module)
def update_module(module_id: int, module: schemas.ModuleUpdate, db: Session = Depends(get_db)):
    """Update a module"""
    db_module = crud.update_module(db, module_id, module)
    if not db_module:
        raise HTTPException(status_code=404, detail="Module not found")
    return db_module


@router.delete("/modules/{module_id}")
def delete_module(module_id: int, db: Session = Depends(get_db)):
    """Delete a module"""
    success = crud.delete_module(db, module_id)
    if not success:
        raise HTTPException(status_code=404, detail="Module not found")
    return {"message": "Module deleted successfully"}


# ===== Feature Management =====

@router.post("/modules/{module_id}/features/", response_model=schemas.Feature)
def create_feature(module_id: int, feature: schemas.FeatureCreate, db: Session = Depends(get_db)):
    """Create a new feature in a module"""
    module = crud.get_module(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return crud.create_feature(db, module_id, feature)


@router.put("/features/{feature_id}", response_model=schemas.Feature)
def update_feature(feature_id: int, feature: schemas.FeatureUpdate, db: Session = Depends(get_db)):
    """Update a feature"""
    db_feature = crud.update_feature(db, feature_id, feature)
    if not db_feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    return db_feature


@router.delete("/features/{feature_id}")
def delete_feature(feature_id: int, db: Session = Depends(get_db)):
    """Delete a feature"""
    success = crud.delete_feature(db, feature_id)
    if not success:
        raise HTTPException(status_code=404, detail="Feature not found")
    return {"message": "Feature deleted successfully"}


# ===== Rate Card Management =====

@router.get("/rate-cards/", response_model=list[schemas.InternalRateCard])
def get_rate_cards(db: Session = Depends(get_db)):
    """Get all internal rate cards"""
    cards = crud.get_all_rate_cards(db)
    if not cards:
        # Create defaults if none exist
        cards = crud.get_or_create_default_rate_cards(db)
    return cards


@router.post("/rate-cards/", response_model=schemas.InternalRateCard)
def create_rate_card(rate_card: schemas.InternalRateCardCreate, db: Session = Depends(get_db)):
    """Create or update a rate card"""
    existing = db.query(models.InternalRateCard).filter(
        models.InternalRateCard.role_name == rate_card.role_name
    ).first()
    
    if existing:
        return crud.update_rate_card(db, existing.id, rate_card)
    return crud.create_rate_card(db, rate_card)


@router.put("/rate-cards/{rate_card_id}", response_model=schemas.InternalRateCard)
def update_rate_card(rate_card_id: int, rate_card: schemas.InternalRateCardCreate, db: Session = Depends(get_db)):
    """Update a rate card"""
    db_rate = crud.update_rate_card(db, rate_card_id, rate_card)
    if not db_rate:
        raise HTTPException(status_code=404, detail="Rate card not found")
    return db_rate


# ===== Tech Stack Management =====

@router.get("/tech-stacks/", response_model=list[schemas.TechStack])
def get_tech_stacks(db: Session = Depends(get_db)):
    """Get all tech stacks"""
    stacks = crud.get_all_tech_stacks(db)
    if not stacks:
        # Create defaults if none exist
        stacks = crud.get_or_create_default_tech_stacks(db)
    return stacks


# ===== Health Check =====

@router.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "2.0", "mode": "fixed-cost-estimation"}
