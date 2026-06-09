"""
Email service for Brainium Project Estimation Portal.

All SMTP settings are loaded exclusively from environment variables.
SMTP_PASSWORD is never logged or exposed in any output.
"""

import logging
import os
import smtplib
from html import escape
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_smtp_config() -> dict:
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "username": os.getenv("SMTP_USERNAME", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from_email": os.getenv("SMTP_FROM_EMAIL", ""),
        "from_name": os.getenv("SMTP_FROM_NAME", "Brainium Project Estimation Portal"),
        "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() == "true",
        "use_ssl": os.getenv("SMTP_USE_SSL", "false").lower() == "true",
    }


def _notification_enabled() -> bool:
    return os.getenv("NOTIFICATION_EMAIL_ENABLED", "false").lower() == "true"


def _is_smtp_configured() -> bool:
    cfg = _get_smtp_config()
    return bool(cfg["username"] and cfg["password"] and cfg["from_email"])


def get_admin_notification_email(db: Session | None = None) -> str:
    """
    Resolve admin notification recipient with fallback chain:
    1) ADMIN_NOTIFICATION_EMAIL env
    2) Active admin email from DB (excluding legacy local admin)
    3) web.brainium@gmail.com
    """
    configured = os.getenv("ADMIN_NOTIFICATION_EMAIL", "").strip()
    if configured and not configured.lower().endswith("@brainium.local"):
        return configured

    if db is not None:
        try:
            from . import models

            active_admin = (
                db.query(models.User)
                .filter(
                    models.User.role == "admin",
                    models.User.is_active == True,  # noqa: E712
                    ~models.User.email.like("%@brainium.local"),
                )
                .order_by(models.User.id.asc())
                .first()
            )
            if active_admin and active_admin.email:
                return active_admin.email
        except Exception as exc:
            logger.warning("[Email] Failed resolving admin email from DB: %s", str(exc))

    return "web.brainium@gmail.com"


def _get_frontend_url() -> str:
    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    return frontend_url or "http://localhost:5173"


def _get_app_logo_url() -> str | None:
    logo_url = os.getenv("APP_LOGO_URL", "").strip()
    if logo_url:
        return logo_url
    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if frontend_url:
        return f"{frontend_url}/brainium-logo.png"
    return None


def _build_email_template(
    title: str,
    message: str,
    details: dict[str, str] | None = None,
    cta_text: str = "Please login to the portal to review details.",
) -> tuple[str, str]:
    logo_url = _get_app_logo_url()
    safe_title = escape(title)
    safe_message = escape(message).replace("\n", "<br>")

    rows_html = ""
    text_rows = []
    if details:
        for key, value in details.items():
            safe_key = escape(str(key))
            safe_value = escape(str(value))
            rows_html += (
                f"<tr>"
                f"<td style='padding:8px 10px;border:1px solid #e5e7eb;background:#f8fafc;font-weight:600;color:#1f2937;'>{safe_key}</td>"
                f"<td style='padding:8px 10px;border:1px solid #e5e7eb;color:#111827;'>{safe_value}</td>"
                f"</tr>"
            )
            text_rows.append(f"- {key}: {value}")

    details_table_html = ""
    if rows_html:
        details_table_html = (
            "<table style='width:100%;border-collapse:collapse;margin:14px 0 18px;'>"
            f"{rows_html}"
            "</table>"
        )

        logo_block = (
                f"<img src='{escape(logo_url)}' alt='Brainium' width='180' "
                "style='display:block;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;'>"
                if logo_url
                else "<div style='font-size:22px;font-weight:800;color:#10243a;letter-spacing:0.2px;'>Brainium</div>"
        )

        html_body = f"""
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid #e5e7eb;background:#ffffff;text-align:left;">
                    {logo_block}
        </div>
        <div style="padding:22px 20px;">
          <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">{safe_title}</h2>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#374151;">{safe_message}</p>
          {details_table_html}
          <p style="margin:0;font-size:13px;line-height:1.6;color:#111827;font-weight:600;">{escape(cta_text)}</p>
        </div>
        <div style="padding:14px 20px;border-top:1px solid #e5e7eb;background:#f8fafc;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">Brainium Project Estimation Portal</p>
        </div>
      </div>
    </div>
    """

    text_body = f"{title}\n\n{message}\n"
    if text_rows:
        text_body += "\nDetails:\n" + "\n".join(text_rows) + "\n"
    text_body += f"\n{cta_text}\n\nBrainium Project Estimation Portal"
    return html_body, text_body


# ---------------------------------------------------------------------------
# Core send function
# ---------------------------------------------------------------------------

def send_email(to_email: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    """
    Send an HTML (with optional plain-text fallback) email via SMTP.

    Raises RuntimeError on any failure so the caller can decide whether
    to surface the error or swallow it.

    SMTP_PASSWORD is NEVER included in any log message.
    """
    cfg = _get_smtp_config()

    if not cfg["username"] or not cfg["password"]:
        logger.error(
            "[Email] SMTP_USERNAME or SMTP_PASSWORD not set – cannot send email. "
            "Add them to backend/.env (see SMTP_SETUP.md)."
        )
        raise RuntimeError(
            "Email service not configured. "
            "Set SMTP_USERNAME and SMTP_PASSWORD in backend/.env."
        )

    if not cfg["from_email"]:
        logger.error("[Email] SMTP_FROM_EMAIL not configured.")
        raise RuntimeError("SMTP_FROM_EMAIL not configured in backend/.env.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{cfg['from_name']} <{cfg['from_email']}>"
    msg["To"] = to_email

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        smtp = smtplib.SMTP(cfg["host"], cfg["port"], timeout=20)
        smtp.ehlo()
        if cfg["use_tls"]:
            smtp.starttls()
            smtp.ehlo()
        smtp.login(cfg["username"], cfg["password"])
        smtp.sendmail(cfg["from_email"], [to_email], msg.as_string())
        smtp.quit()
        logger.info(
            "[Email] Sent '%s' to %s via %s:%s",
            subject, to_email, cfg["host"], cfg["port"],
        )
    except smtplib.SMTPAuthenticationError:
        logger.error(
            "[Email] SMTP authentication failed for user %s – "
            "check SMTP_PASSWORD in backend/.env (never logged here).",
            cfg["username"],
        )
        raise RuntimeError(
            "SMTP authentication failed. "
            "Verify SMTP_USERNAME / SMTP_PASSWORD in backend/.env."
        )
    except smtplib.SMTPException as exc:
        logger.error("[Email] SMTP error sending to %s: %s", to_email, str(exc))
        raise RuntimeError(f"SMTP error: {exc}")
    except Exception as exc:
        logger.error("[Email] Unexpected error sending email to %s: %s", to_email, str(exc))
        raise RuntimeError(f"Email send failed: {exc}")


# ---------------------------------------------------------------------------
# Signup verification email
# ---------------------------------------------------------------------------

def send_verification_code_email(to_email: str, full_name: str, code: str) -> None:
    """
    Send a 6-digit verification code to a newly registered user.
    Raises on failure – signup should surface the error.
    """
    expiry = int(os.getenv("EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES", "10"))
    subject = "Verify your Brainium account"

    html_body, text_body = _build_email_template(
        title="Verify your email address",
        message=(
            f"Hi {full_name}, thank you for signing up. "
            f"Use this verification code to activate your account. "
            f"This code expires in {expiry} minutes."
        ),
        details={
            "Verification code": code,
            "Expires in": f"{expiry} minutes",
        },
    )

    send_email(to_email, subject, html_body, text_body)


# ---------------------------------------------------------------------------
# Notification emails
# ---------------------------------------------------------------------------

def send_notification_email(
    to_email: str,
    subject: str,
    message: str,
    estimate_title: str | None = None,
    details: dict[str, str] | None = None,
    event_type: str = "generic",
) -> None:
    """
    Send a notification email.

    - Silently logs failures (does NOT raise) so the main action is never blocked.
    - Respects the NOTIFICATION_EMAIL_ENABLED environment variable.
    - SMTP_PASSWORD is never logged.
    """
    if not _notification_enabled():
        return

    merged_details = dict(details or {})
    if estimate_title:
        merged_details.setdefault("Project", estimate_title)

    html_body, text_body = _build_email_template(
        title=subject,
        message=message,
        details=merged_details,
    )

    logger.info(
        "[Notification] event=%s recipient=%s subject=%s app_logo_url_configured=%s smtp_configured=%s",
        event_type,
        to_email,
        subject,
        "yes" if bool(_get_app_logo_url()) else "no",
        "yes" if _is_smtp_configured() else "no",
    )

    try:
        send_email(to_email, subject, html_body, text_body)
    except Exception as exc:
        # Non-fatal: log but never crash the main request
        logger.warning(
            "[Notification] Email to %s failed (non-fatal): %s",
            to_email, str(exc),
        )


def send_admin_notification_email(
    subject: str,
    title: str,
    message: str,
    details: dict[str, str] | None = None,
    db: Session | None = None,
    event_type: str = "admin_notification",
) -> None:
    if not _notification_enabled():
        return
    try:
        html_body, text_body = _build_email_template(
            title=title,
            message=message,
            details=details,
        )
        recipient = get_admin_notification_email(db)
        logger.info(
            "[Admin Notification] event=%s recipient=%s subject=%s app_logo_url_configured=%s smtp_configured=%s",
            event_type,
            recipient,
            subject,
            "yes" if bool(_get_app_logo_url()) else "no",
            "yes" if _is_smtp_configured() else "no",
        )
        send_email(recipient, subject, html_body, text_body)
    except Exception as exc:
        logger.warning("[Admin Notification] Failed to send '%s': %s", subject, str(exc))


def get_email_debug_config(db: Session | None = None) -> dict:
    """Safe email configuration diagnostics for development/debugging."""
    return {
        "smtp_configured": _is_smtp_configured(),
        "notification_email_enabled": _notification_enabled(),
        "admin_notification_email": get_admin_notification_email(db),
        "frontend_url": _get_frontend_url(),
        "app_logo_url": _get_app_logo_url() or "",
        "app_logo_url_configured": bool(_get_app_logo_url()),
    }


def send_account_created_email(to_email: str, full_name: str, temp_password: str) -> None:
    """Send account creation details to newly created user by admin."""
    if not _notification_enabled():
        return
    try:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
        html_body, text_body = _build_email_template(
            title="Your Brainium Estimation Portal account has been created",
            message="An admin has created an account for you. Please use the credentials below to login and change your password from your Profile.",
            details={
                "Full name": full_name,
                "Email": to_email,
                "Temporary password": temp_password,
                "Login URL": frontend_url,
            },
            cta_text="Visit the portal to login and change your password.",
        )
        send_email(to_email, "Your Brainium account has been created", html_body, text_body)
    except Exception as exc:
        logger.warning("[Account Created Email] Failed to send to %s: %s", to_email, str(exc))
