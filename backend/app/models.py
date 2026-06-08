from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base


class InternalRateCard(Base):
    """Predefined internal role-based rates for cost calculation"""
    __tablename__ = "internal_rate_cards"

    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(100), unique=True, index=True)  # Senior Dev, Junior Dev, QA Tester, Project Manager
    hourly_rate = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TechStack(Base):
    """Predefined tech stacks with complexity multipliers"""
    __tablename__ = "tech_stacks"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50))  # Frontend, Backend, Database, Platform/CMS
    name = Column(String(100))  # React, Vue, Python, Node.js, PostgreSQL, etc.
    stack_level = Column(String(20))  # Standard, Advanced, Complex
    multiplier = Column(Float)  # 1.0, 1.25, 1.5
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Estimate(Base):
    """Main estimate record - backward compatible with optional fixed-cost fields"""
    __tablename__ = "estimates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    project_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    client_name = Column(String(255), nullable=True)
    project_type = Column(String(255), nullable=True)
    primary_technology = Column(String(255), nullable=True)
    
    # Legacy fields (backward compatible)
    effort_hours = Column(Float, nullable=True)
    complexity_score = Column(Float, nullable=True)
    resource_cost = Column(Float, nullable=True)
    total_cost = Column(Float, nullable=True)
    
    # New fixed-cost estimation fields
    is_fixed_cost = Column(Boolean, default=True)
    tech_stack_json = Column(JSON, nullable=True)  # {frontend, backend, database, platform, stack_level}
    project_info = Column(JSON, nullable=True)  # {duration, team_size, etc.}
    proposal_summary = Column(Text, nullable=True)  # Client-facing auto-generated or manually edited
    total_fixed_cost = Column(Float, nullable=True)
    final_fixed_cost = Column(Float, nullable=True)
    total_estimated_hours = Column(Float, nullable=True)
    subtotal_hours = Column(Float, nullable=True)
    qa_hours = Column(Float, nullable=True)
    pm_hours = Column(Float, nullable=True)
    risk_buffer_hours = Column(Float, nullable=True)
    subtotal_cost = Column(Float, nullable=True)
    qa_cost = Column(Float, nullable=True)
    pm_cost = Column(Float, nullable=True)
    risk_buffer_cost = Column(Float, nullable=True)
    # Full payload / snapshot of estimate data for export/audit
    estimate_data_json = Column(JSON, nullable=True)
    # Currency for the fixed-cost estimate (e.g. USD)
    currency = Column(String(20), nullable=True)
    
    # Relationships
    modules = relationship("Module", back_populates="estimate", cascade="all, delete-orphan")
    settings = relationship("EstimateSettings", back_populates="estimate", cascade="all, delete-orphan", uselist=False)
    # Ownership / estimator tracking
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_by_name = Column(String(255), nullable=True)
    created_by_email = Column(String(255), nullable=True)
    version_number = Column(Integer, default=1)
    is_editable = Column(Boolean, default=True)
    status = Column(String(50), default="Estimation Initiation")
    last_change_comment = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="estimates")
    versions = relationship("EstimateVersion", back_populates="estimate", cascade="all, delete-orphan")
    comments = relationship("EstimateComment", back_populates="estimate", cascade="all, delete-orphan")
    files = relationship("EstimateFile", back_populates="estimate", cascade="all, delete-orphan")


class EstimateSettings(Base):
    """Overhead percentages for QA, PM, and Risk"""
    __tablename__ = "estimate_settings"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(Integer, ForeignKey("estimates.id"), unique=True)
    qa_percentage = Column(Float, default=15.0)  # 15%
    pm_percentage = Column(Float, default=10.0)  # 10%
    risk_percentage = Column(Float, default=10.0)  # 10%
    
    estimate = relationship("Estimate", back_populates="settings")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Module(Base):
    """Project modules - group related features"""
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(Integer, ForeignKey("estimates.id"))
    name = Column(String(255))
    description = Column(Text, nullable=True)
    order = Column(Integer, default=0)
    
    estimate = relationship("Estimate", back_populates="modules")
    features = relationship("Feature", back_populates="module", cascade="all, delete-orphan")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Feature(Base):
    """Features within modules - calculation happens at feature level"""
    __tablename__ = "features"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"))
    name = Column(String(255))
    feature_type = Column(String(100), nullable=True)  # API, UI, Integration, Database, etc.
    complexity = Column(Float)  # 1-10 scale
    base_hours = Column(Float)  # Estimated hours for 1x quantity at 1.0 complexity
    quantity = Column(Float, default=1.0)  # Multiplier for similar features
    assigned_role = Column(String(100))  # Role name (must match InternalRateCard.role_name)
    is_billable = Column(Boolean, default=True)  # Non-billable features count hours but not cost
    notes = Column(Text, nullable=True)
    order = Column(Integer, default=0)
    
    module = relationship("Module", back_populates="features")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class User(Base):
    """Application users (estimators)"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    role = Column(String(30), default="estimator")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    estimates = relationship("Estimate", back_populates="user")
    comments = relationship("EstimateComment", back_populates="user")


class EstimateVersion(Base):
    """Version history for estimate updates"""
    __tablename__ = "estimate_versions"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(Integer, ForeignKey("estimates.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    last_change_comment = Column(Text, nullable=False)
    estimate_data_json = Column(JSON, nullable=True)
    proposal_summary = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, nullable=True)
    created_by_name = Column(String(255), nullable=True)
    created_by_email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    estimate = relationship("Estimate", back_populates="versions")


class EstimateComment(Base):
    """Admin comments on individual estimates"""
    __tablename__ = "estimate_comments"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(Integer, ForeignKey("estimates.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(255), nullable=True)
    user_role = Column(String(50), nullable=True)
    comment_text = Column(Text, nullable=False)
    file_id = Column(Integer, ForeignKey("estimate_files.id"), nullable=True)
    is_read_by_estimator = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    estimate = relationship("Estimate", back_populates="comments")
    user = relationship("User", back_populates="comments")
    file = relationship("EstimateFile", back_populates="comments")


class EstimateFile(Base):
    """Files uploaded by admin and attached to estimate comments"""
    __tablename__ = "estimate_files"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(Integer, ForeignKey("estimates.id"), nullable=False, index=True)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_by_name = Column(String(255), nullable=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    estimate = relationship("Estimate", back_populates="files")
    comments = relationship("EstimateComment", back_populates="file")
