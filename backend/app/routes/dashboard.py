from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

DASHBOARD_STATUSES = [
    "Draft",
    "Estimation Initiation",
    "Client Review",
    "Client Feedback",
    "Revised Estimate",
    "Approved Internally",
    "Project Awarded",
    "On Hold",
    "Canceled",
    "Closed",
]


@router.get("/summary", response_model=schemas.DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    estimates = db.query(models.Estimate).filter(models.Estimate.created_by_user_id == current_user.id).all()

    status_breakdown = {status: 0 for status in DASHBOARD_STATUSES}

    draft_count = 0
    editable_count = 0
    locked_count = 0
    total_hours = 0.0
    total_fixed_cost = 0.0

    latest = None
    latest_sort_value = None

    for estimate in estimates:
        status = (estimate.status or "Estimation Initiation").strip() or "Estimation Initiation"
        is_draft = bool(estimate.is_draft) or status.lower() == "draft"

        if is_draft:
            draft_count += 1
        elif estimate.is_editable is False:
            locked_count += 1
        else:
            editable_count += 1

        status_breakdown[status] = status_breakdown.get(status, 0) + 1
        total_hours += float(estimate.total_estimated_hours or 0)
        total_fixed_cost += float(estimate.final_fixed_cost or estimate.total_fixed_cost or 0)

        sort_value = estimate.updated_at or estimate.created_at
        if latest is None or (sort_value and latest_sort_value and sort_value > latest_sort_value) or (
            latest is not None and latest_sort_value is None and sort_value is not None
        ):
            latest = estimate
            latest_sort_value = sort_value

    latest_payload = None
    if latest is not None:
        latest_payload = {
            "id": latest.id,
            "name": latest.name,
            "status": latest.status,
            "updated_at": latest.updated_at or latest.created_at,
        }

    return {
        "total_estimates": len(estimates),
        "draft_count": draft_count,
        "editable_count": editable_count,
        "locked_count": locked_count,
        "total_hours": round(total_hours, 2),
        "total_fixed_cost": round(total_fixed_cost, 2),
        "latest_estimate": latest_payload,
        "status_breakdown": status_breakdown,
    }
