from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===== User / Auth Schemas =====
class UserBase(BaseModel):
    full_name: str
    email: str
    company_name: Optional[str] = None
    role: Optional[str] = "estimator"


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    role: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: User


class TokenData(BaseModel):
    email: Optional[str] = None


# ===== Internal Rate Card Schemas =====
class InternalRateCardBase(BaseModel):
    role_name: str
    hourly_rate: float


class InternalRateCardCreate(InternalRateCardBase):
    pass


class InternalRateCard(InternalRateCardBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Tech Stack Schemas =====
class TechStackBase(BaseModel):
    category: str  # Frontend, Backend, Database, Platform/CMS
    name: str
    stack_level: str  # Standard, Advanced, Complex
    multiplier: float


class TechStackCreate(TechStackBase):
    pass


class TechStack(TechStackBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Feature Schemas =====
class FeatureBase(BaseModel):
    name: str
    description: Optional[str] = None
    estimated_hours: Optional[float] = None
    complexity_label: Optional[str] = None
    complexity: float | str = Field(default=1.5)
    is_billable: bool = True

    # Legacy-compatible optional fields
    feature_type: Optional[str] = None
    base_hours: Optional[float] = None
    quantity: Optional[float] = None
    assigned_role: Optional[str] = None
    notes: Optional[str] = None
    order: int = 0


class FeatureCreate(FeatureBase):
    pass


class FeatureUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    estimated_hours: Optional[float] = None
    complexity_label: Optional[str] = None
    feature_type: Optional[str] = None
    complexity: Optional[float | str] = None
    base_hours: Optional[float] = None
    quantity: Optional[float] = None
    assigned_role: Optional[str] = None
    is_billable: Optional[bool] = None
    notes: Optional[str] = None
    order: Optional[int] = None


class Feature(FeatureBase):
    id: int
    module_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Module Schemas =====
class ModuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    order: int = 0


class ModuleCreate(ModuleBase):
    features: List['FeatureCreate'] = []


class ModuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None


class Module(ModuleBase):
    id: int
    estimate_id: int
    features: List[Feature] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Estimate Settings Schemas =====
class EstimateSettingsBase(BaseModel):
    qa_percentage: float = 15.0
    pm_percentage: float = 10.0
    risk_percentage: float = 10.0


class EstimateSettingsCreate(EstimateSettingsBase):
    pass


class EstimateSettingsUpdate(BaseModel):
    qa_percentage: Optional[float] = None
    pm_percentage: Optional[float] = None
    risk_percentage: Optional[float] = None


class EstimateSettings(EstimateSettingsBase):
    id: int
    estimate_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Estimate Schemas (Legacy + New) =====
class EstimateBase(BaseModel):
    name: str
    description: Optional[str] = None


class EstimateCreateLegacy(EstimateBase):
    """Legacy schema for backward compatibility"""
    effort_hours: float
    complexity_score: float
    resource_cost: float


class EstimateCreateFixedCost(BaseModel):
    """New schema for fixed-cost estimation"""
    name: str
    description: Optional[str] = None
    client_name: Optional[str] = None
    tech_stack_json: Optional[Dict[str, Any]] = None
    project_info: Optional[Dict[str, Any]] = None
    modules: List[ModuleCreate] = []
    settings: Optional[EstimateSettingsCreate] = None
    proposal_summary: Optional[str] = None
    estimate_data_json: Optional[Dict[str, Any]] = None
    currency: Optional[str] = None
    version_number: Optional[int] = 1
    status: Optional[str] = "Estimation Initiation"
    is_editable: Optional[bool] = True
    last_change_comment: Optional[str] = None


class EstimateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    client_name: Optional[str] = None
    tech_stack_json: Optional[Dict[str, Any]] = None
    project_info: Optional[Dict[str, Any]] = None
    proposal_summary: Optional[str] = None
    modules: Optional[List[ModuleCreate]] = None
    settings: Optional[EstimateSettingsCreate] = None
    estimate_data_json: Optional[Dict[str, Any]] = None
    last_change_comment: Optional[str] = None
    status: Optional[str] = None
    is_editable: Optional[bool] = None
    qa_percentage: Optional[float] = None
    pm_percentage: Optional[float] = None
    risk_percentage: Optional[float] = None


class Estimate(EstimateBase):
    id: int
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    project_type: Optional[str] = None
    primary_technology: Optional[str] = None
    is_fixed_cost: bool = True
    tech_stack_json: Optional[Dict[str, Any]] = None
    project_info: Optional[Dict[str, Any]] = None
    proposal_summary: Optional[str] = None
    total_fixed_cost: Optional[float] = None
    final_fixed_cost: Optional[float] = None
    total_estimated_hours: Optional[float] = None
    subtotal_hours: Optional[float] = None
    qa_hours: Optional[float] = None
    pm_hours: Optional[float] = None
    risk_buffer_hours: Optional[float] = None
    subtotal_cost: Optional[float] = None
    qa_cost: Optional[float] = None
    pm_cost: Optional[float] = None
    risk_buffer_cost: Optional[float] = None
    estimate_data_json: Optional[Dict[str, Any]] = None
    currency: Optional[str] = None
    modules: List[Module] = []
    settings: Optional[EstimateSettings] = None
    
    # Legacy fields
    effort_hours: Optional[float] = None
    complexity_score: Optional[float] = None
    resource_cost: Optional[float] = None
    total_cost: Optional[float] = None
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_by_email: Optional[str] = None
    version_number: Optional[int] = 1
    is_editable: Optional[bool] = True
    status: Optional[str] = 'Estimation Initiation'
    last_change_comment: Optional[str] = None
    files: List['EstimateFile'] = []
    comments: List['EstimateComment'] = []
    versions: List['EstimateVersion'] = []
    comment_count: Optional[int] = 0
    unread_comment_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ===== Estimate Comment Schemas =====
class EstimateCommentCreate(BaseModel):
    comment_text: str


class EstimateStatusUpdate(BaseModel):
    status: str


# ===== Estimate Version Schema =====
class EstimateVersion(BaseModel):
    id: int
    version_number: int
    last_change_comment: str
    created_by_name: Optional[str] = None
    created_by_email: Optional[str] = None
    created_at: datetime
    estimate_data_json: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class EstimateFile(BaseModel):
    id: int
    estimate_id: int
    uploaded_by_user_id: Optional[int] = None
    uploaded_by_name: Optional[str] = None
    original_filename: str
    stored_filename: str
    file_path: str
    download_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EstimateComment(BaseModel):
    id: int
    estimate_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    comment_text: str
    file_id: Optional[int] = None
    file: Optional['EstimateFile'] = None
    is_read_by_estimator: bool = False
    created_at: datetime

    class Config:
        from_attributes = True



# ===== Calculation Breakdown (for frontend display) =====
class FeatureCalculation(BaseModel):
    feature_id: int
    feature_name: str
    base_hours: float
    quantity: float
    complexity: float
    stack_multiplier: float
    calculated_hours: float
    assigned_role: str
    hourly_rate: float
    is_billable: bool
    feature_cost: float


class ModuleBreakdown(BaseModel):
    module_id: int
    module_name: str
    feature_count: int
    total_hours: float
    total_cost: float
    features: List[FeatureCalculation] = []


class EstimateBreakdown(BaseModel):
    """Detailed breakdown of estimate calculation"""
    modules: List[ModuleBreakdown] = []
    subtotal_hours: float
    subtotal_cost: float
    qa_hours: float
    qa_cost: float
    pm_hours: float
    pm_cost: float
    risk_hours: float
    risk_cost: float
    total_hours: float
    total_fixed_cost: float


# Rebuild models to resolve forward references
ModuleCreate.model_rebuild()
EstimateComment.model_rebuild()
Estimate.model_rebuild()
