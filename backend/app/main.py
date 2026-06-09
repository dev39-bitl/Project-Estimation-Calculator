from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from .database import engine, Base, SessionLocal, migrate_sqlite_schema
from .routes import estimates, auth, admin, users, dashboard
from . import models, crud
from .email_service import get_email_debug_config

load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Project Estimation Calculator API",
    description="Fixed-cost project estimation tool with feature-based calculation and role-based internal rates",
    version="2.0.0",
)

# Configure CORS for frontend communication
CORS_ORIGINS = [
    # Local development - Vite dev server
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:3000",
    # Local development - IP address (127.0.0.1)
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:5176",
    "http://127.0.0.1:3000",
]

# Add production domain from environment variable or use default
PRODUCTION_DOMAIN = os.getenv("PRODUCTION_DOMAIN", "https://estimation-calculator.mydevfactory.com")
if os.getenv("ENVIRONMENT") == "production":
    CORS_ORIGINS.append(PRODUCTION_DOMAIN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(estimates.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(users.router)
app.include_router(dashboard.router)


@app.on_event("startup")
def startup_event():
    """Initialize default rate cards and tech stacks on startup"""
    # 1. create all ORM tables first
    Base.metadata.create_all(bind=engine)
    # 2. add any new SQLite columns introduced after initial table creation
    migrate_sqlite_schema()
    db = SessionLocal()
    try:
        crud.get_or_create_default_rate_cards(db)
        crud.get_or_create_default_tech_stacks(db)
        # Setup primary admin account.
        from .auth import get_password_hash

        # Ensure web.brainium@gmail.com exists as primary admin
        primary_admin = db.query(models.User).filter(models.User.email == 'web.brainium@gmail.com').first()
        if not primary_admin:
            primary_admin = models.User(
                full_name='Admin',
                email='web.brainium@gmail.com',
                hashed_password=get_password_hash('Admin@123'),
                role='admin',
                is_active=True,
                is_email_verified=True,
            )
            db.add(primary_admin)
            db.commit()
            print("[startup] Primary admin created: web.brainium@gmail.com / Admin@123")
        else:
            needs_commit = False
            if primary_admin.role != 'admin':
                primary_admin.role = 'admin'
                needs_commit = True
            if not primary_admin.is_active:
                primary_admin.is_active = True
                needs_commit = True
            if not primary_admin.is_email_verified:
                primary_admin.is_email_verified = True
                needs_commit = True
            if needs_commit:
                db.commit()
    finally:
        db.close()


@app.get("/")
def root():
    """Welcome endpoint"""
    return {
        "message": "Project Estimation Calculator API v2.0",
        "mode": "Fixed-Cost Estimation with Feature-Based Calculation",
        "docs": "/docs",
        "openapi_schema": "/openapi.json"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "2.0", "mode": "fixed-cost-estimation"}


@app.get("/api/health")
def api_health_check():
    """Health check endpoint under /api prefix (for frontend compatibility)"""
    return {"status": "healthy", "version": "2.0", "mode": "fixed-cost-estimation"}


@app.get("/api/debug/email-config")
def debug_email_config():
    """Development-only endpoint for safe email configuration diagnostics."""
    if os.getenv("ENVIRONMENT", "development").lower() != "development":
        raise HTTPException(status_code=404, detail="Not found")

    db = SessionLocal()
    try:
        return get_email_debug_config(db=db)
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", 8000)),
        reload=os.getenv("API_RELOAD", "true").lower() == "true"
    )
