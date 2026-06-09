from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

# For SQLite with local file
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    # For PostgreSQL or other databases
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def migrate_sqlite_schema():
    """Best-effort SQLite migration for newly introduced estimate/versioning fields."""
    if not DATABASE_URL.startswith("sqlite"):
        return

    estimate_columns = {
        "project_name": "TEXT",
        "project_type": "TEXT",
        "primary_technology": "TEXT",
        "final_fixed_cost": "FLOAT",
        "subtotal_hours": "FLOAT",
        "qa_hours": "FLOAT",
        "pm_hours": "FLOAT",
        "risk_buffer_hours": "FLOAT",
        "subtotal_cost": "FLOAT",
        "qa_cost": "FLOAT",
        "pm_cost": "FLOAT",
        "risk_buffer_cost": "FLOAT",
        "version_number": "INTEGER DEFAULT 1",
        "is_editable": "BOOLEAN DEFAULT 1",
        "status": "VARCHAR(50) DEFAULT 'Estimation Initiation'",
        "is_draft": "BOOLEAN DEFAULT 0",
        "auto_saved_at": "DATETIME",
        "last_change_comment": "TEXT",
    }

    user_columns = {
        "is_email_verified": "BOOLEAN DEFAULT 0",
        "email_verified_at": "DATETIME",
    }

    with engine.begin() as conn:
        existing_cols = {
            row[1] for row in conn.execute(text("PRAGMA table_info(estimates)"))
        }
        for col_name, col_type in estimate_columns.items():
            if col_name not in existing_cols:
                conn.execute(text(f"ALTER TABLE estimates ADD COLUMN {col_name} {col_type}"))

        # Users table additions
        user_existing_cols = {
            row[1] for row in conn.execute(text("PRAGMA table_info(users)"))
        }
        for col_name, col_type in user_columns.items():
            if col_name not in user_existing_cols:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))

        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS email_verifications (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                email VARCHAR(255) NOT NULL,
                code_hash VARCHAR(255) NOT NULL,
                expires_at DATETIME NOT NULL,
                is_used BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        ))

        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS estimate_versions (
                id INTEGER PRIMARY KEY,
                estimate_id INTEGER NOT NULL,
                version_number INTEGER NOT NULL,
                last_change_comment TEXT NOT NULL,
                estimate_data_json JSON,
                proposal_summary TEXT,
                created_by_user_id INTEGER,
                created_by_name VARCHAR(255),
                created_by_email VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(estimate_id) REFERENCES estimates(id)
            )
            """
        ))
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS estimate_comments (
                id INTEGER PRIMARY KEY,
                estimate_id INTEGER NOT NULL,
                user_id INTEGER,
                user_name VARCHAR(255),
                user_role VARCHAR(50),
                comment_text TEXT NOT NULL,
                file_id INTEGER,
                is_read_by_estimator BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(estimate_id) REFERENCES estimates(id),
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(file_id) REFERENCES estimate_files(id)
            )
            """
        ))

        comment_cols = {
            row[1] for row in conn.execute(text("PRAGMA table_info(estimate_comments)"))
        }
        if "file_id" not in comment_cols:
            conn.execute(text("ALTER TABLE estimate_comments ADD COLUMN file_id INTEGER"))

        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS estimate_files (
                id INTEGER PRIMARY KEY,
                estimate_id INTEGER NOT NULL,
                uploaded_by_user_id INTEGER,
                uploaded_by_name VARCHAR(255),
                original_filename VARCHAR(255) NOT NULL,
                stored_filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(512) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(estimate_id) REFERENCES estimates(id),
                FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id)
            )
            """
        ))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
