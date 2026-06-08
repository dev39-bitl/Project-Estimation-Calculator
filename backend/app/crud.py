"""
CRUD operations for fixed-cost project estimation.
Supports legacy estimates and new feature-based fixed-cost estimation.
"""

from sqlalchemy.orm import Session
from typing import Any
from . import models, schemas, calculator


# ===== Internal Rate Card Operations =====

def get_or_create_default_rate_cards(db: Session) -> list[models.InternalRateCard]:
    """Create default rate cards if they don't exist"""
    defaults = [
        ("Senior Dev", 100.0),
        ("Junior Dev", 60.0),
        ("QA Tester", 50.0),
        ("Project Manager", 80.0),
    ]
    
    cards = []
    for role_name, rate in defaults:
        existing = db.query(models.InternalRateCard).filter(
            models.InternalRateCard.role_name == role_name
        ).first()
        
        if not existing:
            card = models.InternalRateCard(role_name=role_name, hourly_rate=rate)
            db.add(card)
            db.commit()
            db.refresh(card)
            cards.append(card)
        else:
            cards.append(existing)
    
    return cards


def get_rate_card(db: Session, rate_card_id: int) -> models.InternalRateCard:
    return db.query(models.InternalRateCard).filter(models.InternalRateCard.id == rate_card_id).first()


def get_all_rate_cards(db: Session) -> list[models.InternalRateCard]:
    return db.query(models.InternalRateCard).all()


def create_rate_card(db: Session, rate_card: schemas.InternalRateCardCreate) -> models.InternalRateCard:
    db_rate = models.InternalRateCard(**rate_card.dict())
    db.add(db_rate)
    db.commit()
    db.refresh(db_rate)
    return db_rate


def update_rate_card(db: Session, rate_card_id: int, rate_card: schemas.InternalRateCardCreate) -> models.InternalRateCard:
    db_rate = get_rate_card(db, rate_card_id)
    if not db_rate:
        return None
    for key, value in rate_card.dict().items():
        setattr(db_rate, key, value)
    db.commit()
    db.refresh(db_rate)
    return db_rate


# ===== Tech Stack Operations =====

def get_or_create_default_tech_stacks(db: Session) -> list[models.TechStack]:
    """Create default tech stacks if they don't exist"""
    defaults = [
        # Frontend
        ("Frontend", "React", "Standard", 1.0),
        ("Frontend", "React", "Advanced", 1.25),
        ("Frontend", "Vue.js", "Standard", 1.0),
        ("Frontend", "Angular", "Advanced", 1.25),
        # Backend
        ("Backend", "Python FastAPI", "Standard", 1.0),
        ("Backend", "Python FastAPI", "Advanced", 1.25),
        ("Backend", "Node.js Express", "Standard", 1.0),
        ("Backend", "Django", "Standard", 1.0),
        # Database
        ("Database", "PostgreSQL", "Standard", 1.0),
        ("Database", "MongoDB", "Advanced", 1.25),
        ("Database", "SQLite", "Standard", 1.0),
        # Platform
        ("Platform/CMS", "WordPress", "Standard", 1.0),
        ("Platform/CMS", "Custom CMS", "Complex", 1.5),
    ]
    
    stacks = []
    for category, name, level, multiplier in defaults:
        existing = db.query(models.TechStack).filter(
            models.TechStack.category == category,
            models.TechStack.name == name,
            models.TechStack.stack_level == level,
        ).first()
        
        if not existing:
            stack = models.TechStack(
                category=category, name=name, stack_level=level, multiplier=multiplier
            )
            db.add(stack)
            db.commit()
            db.refresh(stack)
            stacks.append(stack)
        else:
            stacks.append(existing)
    
    return stacks


def get_all_tech_stacks(db: Session) -> list[models.TechStack]:
    return db.query(models.TechStack).all()


# ===== Estimate Operations (Legacy + Fixed-Cost) =====

def create_estimate_legacy(db: Session, estimate: schemas.EstimateCreateLegacy, user: models.User | None = None) -> models.Estimate:
    """Create legacy estimate for backward compatibility"""
    db_estimate = models.Estimate(
        name=estimate.name,
        description=estimate.description,
        effort_hours=estimate.effort_hours,
        complexity_score=estimate.complexity_score,
        resource_cost=estimate.resource_cost,
        total_cost=estimate.effort_hours * estimate.resource_cost * (0.9 + estimate.complexity_score * 0.1),
        is_fixed_cost=False,
    )
    if user:
           db_estimate.created_by_user_id = user.id
           db_estimate.created_by_name = user.full_name
           db_estimate.created_by_email = user.email
    db.add(db_estimate)
    db.commit()
    db.refresh(db_estimate)
    return db_estimate


def create_estimate_fixed_cost(db: Session, estimate: schemas.EstimateCreateFixedCost, user: models.User | None = None) -> models.Estimate:
    """Create new fixed-cost estimate with modules and features"""
    get_or_create_default_rate_cards(db)
    get_or_create_default_tech_stacks(db)

    def complexity_multiplier(value: Any) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        label = str(value or "medium").strip().lower()
        if label == "low":
            return 1.0
        if label == "high":
            return 2.0
        return 1.5

    settings_obj = estimate.settings or schemas.EstimateSettingsCreate()
    hourly_rate = float((estimate.project_info or {}).get("hourlyRate", 20) or 20)

    subtotal_hours = 0.0
    subtotal_cost = 0.0
    for module_data in estimate.modules or []:
        for feature_data in module_data.features or []:
            estimated_hours = float(feature_data.estimated_hours or feature_data.base_hours or 0)
            multiplier = complexity_multiplier(feature_data.complexity)
            feature_hours = estimated_hours * multiplier
            subtotal_hours += feature_hours
            if feature_data.is_billable:
                subtotal_cost += feature_hours * hourly_rate

    qa_hours = subtotal_hours * (float(settings_obj.qa_percentage or 15) / 100)
    pm_hours = subtotal_hours * (float(settings_obj.pm_percentage or 10) / 100)
    risk_hours = subtotal_hours * (float(settings_obj.risk_percentage or 10) / 100)

    qa_cost = qa_hours * hourly_rate
    pm_cost = pm_hours * hourly_rate
    risk_cost = risk_hours * hourly_rate

    total_hours = subtotal_hours + qa_hours + pm_hours + risk_hours
    final_cost = subtotal_cost + qa_cost + pm_cost + risk_cost

    project_info = estimate.project_info or {}
    tech_stack = estimate.tech_stack_json or {}
    payload_snapshot = estimate.estimate_data_json or estimate.model_dump()

    db_estimate = models.Estimate(
        name=estimate.name,
        project_name=estimate.name,
        description=estimate.description,
        client_name=estimate.client_name,
        project_type=(project_info.get("projectType") if isinstance(project_info, dict) else None),
        primary_technology=(tech_stack.get("primary") if isinstance(tech_stack, dict) else None),
        tech_stack_json=estimate.tech_stack_json,
        project_info=estimate.project_info,
        is_fixed_cost=True,
        estimate_data_json=payload_snapshot,
        currency=estimate.currency or (project_info.get('currency') if isinstance(project_info, dict) else 'USD') or 'USD',
        proposal_summary=estimate.proposal_summary,
        subtotal_hours=subtotal_hours,
        qa_hours=qa_hours,
        pm_hours=pm_hours,
        risk_buffer_hours=risk_hours,
        total_estimated_hours=total_hours,
        subtotal_cost=subtotal_cost,
        qa_cost=qa_cost,
        pm_cost=pm_cost,
        risk_buffer_cost=risk_cost,
        total_fixed_cost=final_cost,
        final_fixed_cost=final_cost,
        created_by_user_id=(user.id if user else None),
        created_by_name=(user.full_name if user else None),
        created_by_email=(user.email if user else None),
        version_number=estimate.version_number or 1,
        is_editable=True if estimate.is_editable is None else estimate.is_editable,
        status=estimate.status or "Estimation Initiation",
        last_change_comment=estimate.last_change_comment,
    )
    db.add(db_estimate)
    db.flush()  # Flush to get estimate ID
    
    # Create settings
    db_settings = models.EstimateSettings(estimate_id=db_estimate.id, **settings_obj.model_dump())
    db.add(db_settings)
    
    # Create modules and features
    for module_data in estimate.modules:
        db_module = models.Module(estimate_id=db_estimate.id, **module_data.model_dump(exclude={"features"}))
        db.add(db_module)
        db.flush()
        
        for feature_data in module_data.features or []:
            numeric_complexity = complexity_multiplier(feature_data.complexity)
            base_hours = float(feature_data.estimated_hours or feature_data.base_hours or 0)
            db_feature = models.Feature(
                module_id=db_module.id,
                name=feature_data.name,
                feature_type=feature_data.feature_type,
                complexity=numeric_complexity,
                base_hours=base_hours,
                quantity=1.0,
                assigned_role=feature_data.assigned_role or 'Estimator',
                is_billable=feature_data.is_billable,
                notes=feature_data.description or feature_data.notes,
                order=feature_data.order,
            )
            db.add(db_feature)

    db_version = models.EstimateVersion(
        estimate_id=db_estimate.id,
        version_number=db_estimate.version_number or 1,
        last_change_comment=estimate.last_change_comment or 'Initial estimate created',
        estimate_data_json=payload_snapshot,
        proposal_summary=estimate.proposal_summary,
        created_by_user_id=(user.id if user else None),
        created_by_name=(user.full_name if user else None),
        created_by_email=(user.email if user else None),
    )
    db.add(db_version)
    
    db.commit()
    db.refresh(db_estimate)

    return db_estimate


def get_user_by_email(db: Session, email: str) -> models.User:
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, full_name: str, email: str, hashed_password: str, company_name: str | None = None, role: str = 'estimator') -> models.User:
    user = models.User(full_name=full_name, email=email, hashed_password=hashed_password, company_name=company_name, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user(db: Session, user_id: int) -> models.User:
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_estimate(db: Session, estimate_id: int) -> models.Estimate:
    return db.query(models.Estimate).filter(models.Estimate.id == estimate_id).first()


def get_all_estimates(db: Session, user_id: int | None = None, skip: int = 0, limit: int = 100) -> list[models.Estimate]:
    q = db.query(models.Estimate)
    if user_id is not None:
        q = q.filter(models.Estimate.created_by_user_id == user_id)
    return q.offset(skip).limit(limit).all()


def update_estimate(db: Session, estimate_id: int, estimate: schemas.EstimateUpdate) -> models.Estimate:
    db_estimate = get_estimate(db, estimate_id)
    if not db_estimate:
        return None
    
    update_data = estimate.model_dump(exclude_unset=True)
    
    # Update overhead settings
    if any(key in update_data for key in ['qa_percentage', 'pm_percentage', 'risk_percentage']):
        if not db_estimate.settings:
            db_estimate.settings = models.EstimateSettings(estimate_id=estimate_id)
            db.add(db_estimate.settings)
        
        for key in ['qa_percentage', 'pm_percentage', 'risk_percentage']:
            if key in update_data:
                setattr(db_estimate.settings, key, update_data.pop(key))
    
    # Update estimate fields
    for key, value in update_data.items():
        setattr(db_estimate, key, value)
    
    db.commit()
    db.refresh(db_estimate)
    
    # Recalculate totals
    update_estimate_totals(db, db_estimate)
    
    return db_estimate


def update_estimate_fixed_cost(
    db: Session,
    estimate_id: int,
    estimate: schemas.EstimateCreateFixedCost,
    user: models.User | None = None,
) -> models.Estimate:
    db_estimate = get_estimate(db, estimate_id)
    if not db_estimate:
        return None

    if not estimate.last_change_comment or not estimate.last_change_comment.strip():
        raise ValueError('Change comment is required when updating an existing estimate.')

    def complexity_multiplier(value: Any) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        label = str(value or "medium").strip().lower()
        if label == "low":
            return 1.0
        if label == "high":
            return 2.0
        return 1.5

    settings_obj = estimate.settings or schemas.EstimateSettingsCreate()
    hourly_rate = float((estimate.project_info or {}).get("hourlyRate", 20) or 20)

    subtotal_hours = 0.0
    subtotal_cost = 0.0
    for module_data in estimate.modules or []:
        for feature_data in module_data.features or []:
            estimated_hours = float(feature_data.estimated_hours or feature_data.base_hours or 0)
            multiplier = complexity_multiplier(feature_data.complexity)
            feature_hours = estimated_hours * multiplier
            subtotal_hours += feature_hours
            if feature_data.is_billable:
                subtotal_cost += feature_hours * hourly_rate

    qa_hours = subtotal_hours * (float(settings_obj.qa_percentage or 15) / 100)
    pm_hours = subtotal_hours * (float(settings_obj.pm_percentage or 10) / 100)
    risk_hours = subtotal_hours * (float(settings_obj.risk_percentage or 10) / 100)

    qa_cost = qa_hours * hourly_rate
    pm_cost = pm_hours * hourly_rate
    risk_cost = risk_hours * hourly_rate

    total_hours = subtotal_hours + qa_hours + pm_hours + risk_hours
    final_cost = subtotal_cost + qa_cost + pm_cost + risk_cost

    project_info = estimate.project_info or {}
    tech_stack = estimate.tech_stack_json or {}
    payload_snapshot = estimate.estimate_data_json or estimate.model_dump()

    # Replace existing modules/features/settings to keep snapshot consistent with edits.
    db.query(models.Feature).filter(models.Feature.module_id.in_(
        db.query(models.Module.id).filter(models.Module.estimate_id == estimate_id)
    )).delete(synchronize_session=False)
    db.query(models.Module).filter(models.Module.estimate_id == estimate_id).delete(synchronize_session=False)
    db.query(models.EstimateSettings).filter(models.EstimateSettings.estimate_id == estimate_id).delete(synchronize_session=False)
    db.flush()

    current_version = int(db_estimate.version_number or 1)

    # Update existing estimate row in-place (no duplicate record creation)
    db_estimate.name = estimate.name
    db_estimate.project_name = estimate.name
    db_estimate.description = estimate.description
    db_estimate.client_name = estimate.client_name
    db_estimate.project_type = (project_info.get("projectType") if isinstance(project_info, dict) else None)
    db_estimate.primary_technology = (tech_stack.get("primary") if isinstance(tech_stack, dict) else None)
    db_estimate.tech_stack_json = estimate.tech_stack_json
    db_estimate.project_info = estimate.project_info
    db_estimate.currency = estimate.currency or (project_info.get('currency') if isinstance(project_info, dict) else 'USD') or 'USD'
    db_estimate.proposal_summary = estimate.proposal_summary
    db_estimate.estimate_data_json = payload_snapshot

    db_estimate.subtotal_hours = subtotal_hours
    db_estimate.qa_hours = qa_hours
    db_estimate.pm_hours = pm_hours
    db_estimate.risk_buffer_hours = risk_hours
    db_estimate.total_estimated_hours = total_hours
    db_estimate.subtotal_cost = subtotal_cost
    db_estimate.qa_cost = qa_cost
    db_estimate.pm_cost = pm_cost
    db_estimate.risk_buffer_cost = risk_cost
    db_estimate.total_fixed_cost = final_cost
    db_estimate.final_fixed_cost = final_cost

    db_estimate.status = estimate.status or db_estimate.status or 'Estimation Initiation'
    db_estimate.is_editable = db_estimate.is_editable if estimate.is_editable is None else estimate.is_editable
    db_estimate.last_change_comment = estimate.last_change_comment
    db_estimate.version_number = current_version + 1

    # Recreate settings
    db_settings = models.EstimateSettings(estimate_id=estimate_id, **settings_obj.model_dump())
    db.add(db_settings)

    # Recreate modules and features linked to the same estimate id
    for module_data in estimate.modules or []:
        db_module = models.Module(estimate_id=estimate_id, **module_data.model_dump(exclude={"features"}))
        db.add(db_module)
        db.flush()

        for feature_data in module_data.features or []:
            numeric_complexity = complexity_multiplier(feature_data.complexity)
            base_hours = float(feature_data.estimated_hours or feature_data.base_hours or 0)
            db_feature = models.Feature(
                module_id=db_module.id,
                name=feature_data.name,
                feature_type=feature_data.feature_type,
                complexity=numeric_complexity,
                base_hours=base_hours,
                quantity=1.0,
                assigned_role=feature_data.assigned_role or 'Estimator',
                is_billable=feature_data.is_billable,
                notes=feature_data.description or feature_data.notes,
                order=feature_data.order,
            )
            db.add(db_feature)

    db_version = models.EstimateVersion(
        estimate_id=estimate_id,
        version_number=db_estimate.version_number,
        last_change_comment=estimate.last_change_comment,
        estimate_data_json=payload_snapshot,
        proposal_summary=estimate.proposal_summary,
        created_by_user_id=(user.id if user else db_estimate.created_by_user_id),
        created_by_name=(user.full_name if user else db_estimate.created_by_name),
        created_by_email=(user.email if user else db_estimate.created_by_email),
    )
    db.add(db_version)

    db.commit()
    db.refresh(db_estimate)
    return db_estimate


def update_estimate_totals(db: Session, estimate: models.Estimate) -> models.Estimate:
    """Recalculate and save total hours and cost"""
    if not estimate.is_fixed_cost:
        return estimate
    
    stack_level = estimate.tech_stack_json.get("stack_level", "standard") if estimate.tech_stack_json else "standard"
    stack_multiplier = calculator.get_stack_multiplier(db, stack_level)
    
    breakdown = calculator.calculate_estimate_breakdown(
        db, estimate, estimate.modules, estimate.settings, stack_multiplier
    )
    
    estimate.total_estimated_hours = breakdown["total_hours"]
    estimate.total_fixed_cost = breakdown["total_fixed_cost"]
    
    db.commit()
    db.refresh(estimate)
    return estimate


def delete_estimate(db: Session, estimate_id: int) -> bool:
    db_estimate = get_estimate(db, estimate_id)
    if not db_estimate:
        return False
    db.delete(db_estimate)
    db.commit()
    return True


# ===== Module Operations =====

def create_module(db: Session, estimate_id: int, module: schemas.ModuleCreate) -> models.Module:
    db_module = models.Module(estimate_id=estimate_id, **module.dict())
    db.add(db_module)
    db.commit()
    db.refresh(db_module)
    return db_module


def get_module(db: Session, module_id: int) -> models.Module:
    return db.query(models.Module).filter(models.Module.id == module_id).first()


def update_module(db: Session, module_id: int, module: schemas.ModuleUpdate) -> models.Module:
    db_module = get_module(db, module_id)
    if not db_module:
        return None
    for key, value in module.dict(exclude_unset=True).items():
        setattr(db_module, key, value)
    db.commit()
    db.refresh(db_module)
    return db_module


def delete_module(db: Session, module_id: int) -> bool:
    db_module = get_module(db, module_id)
    if not db_module:
        return False
    db.delete(db_module)
    db.commit()
    return True


# ===== Feature Operations =====

def create_feature(db: Session, module_id: int, feature: schemas.FeatureCreate) -> models.Feature:
    db_feature = models.Feature(module_id=module_id, **feature.dict())
    db.add(db_feature)
    db.commit()
    db.refresh(db_feature)
    
    # Update estimate totals
    module = get_module(db, module_id)
    if module:
        estimate = get_estimate(db, module.estimate_id)
        if estimate:
            update_estimate_totals(db, estimate)
    
    return db_feature


def get_feature(db: Session, feature_id: int) -> models.Feature:
    return db.query(models.Feature).filter(models.Feature.id == feature_id).first()


def update_feature(db: Session, feature_id: int, feature: schemas.FeatureUpdate) -> models.Feature:
    db_feature = get_feature(db, feature_id)
    if not db_feature:
        return None
    
    for key, value in feature.dict(exclude_unset=True).items():
        setattr(db_feature, key, value)
    
    db.commit()
    db.refresh(db_feature)
    
    # Update estimate totals
    module = get_module(db, db_feature.module_id)
    if module:
        estimate = get_estimate(db, module.estimate_id)
        if estimate:
            update_estimate_totals(db, estimate)
    
    return db_feature


def delete_feature(db: Session, feature_id: int) -> bool:
    db_feature = get_feature(db, feature_id)
    if not db_feature:
        return False
    
    module_id = db_feature.module_id
    db.delete(db_feature)
    db.commit()
    
    # Update estimate totals
    module = get_module(db, module_id)
    if module:
        estimate = get_estimate(db, module.estimate_id)
        if estimate:
            update_estimate_totals(db, estimate)
    
    return True


# ===== Estimate Comment Operations =====

def add_estimate_file(
    db: Session,
    estimate_id: int,
    user: models.User,
    original_filename: str,
    stored_filename: str,
    file_path: str,
) -> models.EstimateFile:
    estimate_file = models.EstimateFile(
        estimate_id=estimate_id,
        uploaded_by_user_id=user.id if user else None,
        uploaded_by_name=user.full_name if user else None,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_path=file_path,
    )
    db.add(estimate_file)
    db.flush()
    return estimate_file


def get_estimate_file(db: Session, file_id: int) -> models.EstimateFile | None:
    return db.query(models.EstimateFile).filter(models.EstimateFile.id == file_id).first()


def add_estimate_comment(
    db: Session,
    estimate_id: int,
    comment_text: str,
    user: models.User,
    file_id: int | None = None,
) -> models.EstimateComment:
    comment = models.EstimateComment(
        estimate_id=estimate_id,
        user_id=user.id,
        user_name=user.full_name,
        user_role=user.role,
        comment_text=comment_text,
        file_id=file_id,
        is_read_by_estimator=False,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def get_estimate_comments(db: Session, estimate_id: int) -> list[models.EstimateComment]:
    return db.query(models.EstimateComment).filter(
        models.EstimateComment.estimate_id == estimate_id
    ).order_by(models.EstimateComment.created_at.asc()).all()


def mark_comments_read(db: Session, estimate_id: int) -> None:
    db.query(models.EstimateComment).filter(
        models.EstimateComment.estimate_id == estimate_id,
        models.EstimateComment.is_read_by_estimator == False,
    ).update({models.EstimateComment.is_read_by_estimator: True}, synchronize_session=False)
    db.commit()


# ===== User Management Operations =====

def block_user(db: Session, user_id: int) -> models.User | None:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


def unblock_user(db: Session, user_id: int) -> models.User | None:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return False
    # Nullify user link on existing estimates — preserve name/email for history
    db.query(models.Estimate).filter(models.Estimate.created_by_user_id == user_id).update(
        {models.Estimate.created_by_user_id: None}, synchronize_session=False
    )
    db.delete(user)
    db.commit()
    return True
