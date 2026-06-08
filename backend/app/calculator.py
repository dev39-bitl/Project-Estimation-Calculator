"""
Advanced fixed-cost project estimation calculator.
Supports feature-level calculations with role-based internal rates and overhead percentages.
"""

from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session
from . import models


def get_complexity_multiplier(complexity: float) -> float:
    """
    Convert complexity score (1-10) to a multiplier.
    Formula: 0.9 + (complexity * 0.1)
    Range: 1.0 (complexity=1) to 1.9 (complexity=10)
    """
    if complexity < 1 or complexity > 10:
        raise ValueError("Complexity must be between 1 and 10")
    return 0.9 + (complexity * 0.1)


def get_stack_multiplier(db: Session, stack_level: str) -> float:
    """
    Get multiplier for tech stack level.
    Default: Standard=1.0, Advanced=1.25, Complex=1.5
    """
    if not stack_level:
        return 1.0
    
    multiplier_map = {"standard": 1.0, "advanced": 1.25, "complex": 1.5}
    return multiplier_map.get(stack_level.lower(), 1.0)


def get_role_hourly_rate(db: Session, role_name: str) -> float:
    """
    Fetch the internal hourly rate for a role.
    Returns default rates if role not found in database.
    """
    if not role_name:
        return 0.0
    
    rate_card = db.query(models.InternalRateCard).filter(
        models.InternalRateCard.role_name.ilike(role_name)
    ).first()
    
    if rate_card:
        return rate_card.hourly_rate
    
    # Fallback default rates (in case database doesn't have rate card yet)
    default_rates = {
        "senior dev": 100.0,
        "junior dev": 60.0,
        "qa tester": 50.0,
        "project manager": 80.0,
    }
    return default_rates.get(role_name.lower(), 75.0)


def calculate_feature_hours(
    base_hours: float,
    quantity: float,
    complexity: float,
    stack_multiplier: float
) -> float:
    """
    Calculate hours for a single feature.
    Formula: base_hours × quantity × complexity_multiplier × stack_multiplier
    """
    complexity_multiplier = get_complexity_multiplier(complexity)
    return base_hours * quantity * complexity_multiplier * stack_multiplier


def calculate_estimate_breakdown(
    db: Session,
    estimate: models.Estimate,
    modules: List[models.Module],
    settings: models.EstimateSettings,
    stack_multiplier: float = 1.0
) -> Dict:
    """
    Calculate complete estimate breakdown for fixed-cost proposal.
    
    Returns:
        Dictionary with module breakdowns, subtotals, and overhead calculations.
    """
    if not settings:
        settings = models.EstimateSettings(
            qa_percentage=15.0, pm_percentage=10.0, risk_percentage=10.0
        )
    
    module_breakdowns = []
    subtotal_hours = 0.0
    subtotal_cost = 0.0
    
    # Calculate each module and its features
    for module in modules:
        module_hours = 0.0
        module_cost = 0.0
        feature_calcs = []
        
        for feature in module.features:
            # Calculate feature hours
            feature_hours = calculate_feature_hours(
                feature.base_hours,
                feature.quantity,
                feature.complexity,
                stack_multiplier
            )
            
            # Get role rate
            hourly_rate = get_role_hourly_rate(db, feature.assigned_role)
            
            # Calculate feature cost (only if billable)
            feature_cost = (feature_hours * hourly_rate) if feature.is_billable else 0.0
            
            feature_calcs.append({
                "feature_id": feature.id,
                "feature_name": feature.name,
                "feature_type": feature.feature_type,
                "base_hours": feature.base_hours,
                "quantity": feature.quantity,
                "complexity": feature.complexity,
                "complexity_multiplier": get_complexity_multiplier(feature.complexity),
                "stack_multiplier": stack_multiplier,
                "calculated_hours": feature_hours,
                "assigned_role": feature.assigned_role,
                "hourly_rate": hourly_rate,
                "is_billable": feature.is_billable,
                "feature_cost": feature_cost,
            })
            
            module_hours += feature_hours
            if feature.is_billable:
                module_cost += feature_cost
        
        module_breakdowns.append({
            "module_id": module.id,
            "module_name": module.name,
            "feature_count": len(module.features),
            "total_hours": module_hours,
            "total_cost": module_cost,
            "features": feature_calcs,
        })
        
        subtotal_hours += module_hours
        subtotal_cost += module_cost
    
    # Calculate QA overhead
    qa_rate = get_role_hourly_rate(db, "qa tester")
    qa_hours = subtotal_hours * (settings.qa_percentage / 100.0)
    qa_cost = qa_hours * qa_rate
    
    # Calculate PM overhead
    pm_rate = get_role_hourly_rate(db, "project manager")
    pm_hours = subtotal_hours * (settings.pm_percentage / 100.0)
    pm_cost = pm_hours * pm_rate
    
    # Calculate Risk Buffer (proportional from subtotal cost, not hours)
    risk_hours = subtotal_hours * (settings.risk_percentage / 100.0)
    risk_cost = subtotal_cost * (settings.risk_percentage / 100.0)
    
    # Final totals
    total_hours = subtotal_hours + qa_hours + pm_hours + risk_hours
    total_cost = subtotal_cost + qa_cost + pm_cost + risk_cost
    
    return {
        "modules": module_breakdowns,
        "subtotal_hours": round(subtotal_hours, 2),
        "subtotal_cost": round(subtotal_cost, 2),
        "qa_percentage": settings.qa_percentage,
        "qa_hours": round(qa_hours, 2),
        "qa_cost": round(qa_cost, 2),
        "pm_percentage": settings.pm_percentage,
        "pm_hours": round(pm_hours, 2),
        "pm_cost": round(pm_cost, 2),
        "risk_percentage": settings.risk_percentage,
        "risk_hours": round(risk_hours, 2),
        "risk_cost": round(risk_cost, 2),
        "total_hours": round(total_hours, 2),
        "total_fixed_cost": round(total_cost, 2),
    }


def validate_estimate_data(effort_hours: Optional[float], complexity_score: Optional[float], resource_cost: Optional[float]) -> Dict:
    """Validate legacy estimation data (backward compatibility)"""
    errors = []
    
    if effort_hours and effort_hours <= 0:
        errors.append("Effort hours must be greater than 0")
    
    if complexity_score and (complexity_score < 1 or complexity_score > 10):
        errors.append("Complexity score must be between 1 and 10")
    
    if resource_cost and resource_cost < 0:
        errors.append("Resource cost cannot be negative")
    
    return {"is_valid": len(errors) == 0, "errors": errors}
