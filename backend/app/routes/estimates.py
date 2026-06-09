from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy.orm import Session
from .. import crud, schemas, calculator, models
from ..database import get_db
from ..auth import get_current_user
from ..email_service import send_notification_email
from pydantic import ValidationError

router = APIRouter(prefix="/api", tags=["estimates"])


# ---------------------------------------------------------------------------
# Notification helpers
# ---------------------------------------------------------------------------

def _get_admin_emails(db: Session) -> list[str]:
    """Return email addresses of all active admin users."""
    admins = db.query(models.User).filter(
        models.User.role == "admin",
        models.User.is_active == True,  # noqa: E712
    ).all()
    return [a.email for a in admins if a.email]


def _notify_admins_new_estimate(db: Session, estimate: models.Estimate, estimator: models.User) -> None:
    for email in _get_admin_emails(db):
        send_notification_email(
            to_email=email,
            subject="New estimate submitted",
            message=(
                f"Estimator <strong>{estimator.full_name}</strong> ({estimator.email}) "
                f"has submitted a new estimate."
            ),
            estimate_title=estimate.name,
        )


def _notify_admins_estimate_updated(db: Session, estimate: models.Estimate, estimator: models.User) -> None:
    for email in _get_admin_emails(db):
        send_notification_email(
            to_email=email,
            subject="Estimate updated",
            message=(
                f"Estimator <strong>{estimator.full_name}</strong> ({estimator.email}) "
                f"has updated an estimate (version {estimate.version_number})."
            ),
            estimate_title=estimate.name,
        )


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

        # Notify all admins about the new estimate
        _notify_admins_new_estimate(db, result, current_user)
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
        return crud.create_estimate_draft(db, fixed, user=current_user)
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
        # Notify admins about the update (skip for drafts)
        if not (db_estimate.is_draft or str(db_estimate.status or '').lower() == 'draft'):
            _notify_admins_estimate_updated(db, updated, current_user)
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
