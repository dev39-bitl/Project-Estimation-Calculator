"""
Email service for Brainium Project Estimation Portal.

All SMTP settings are loaded exclusively from environment variables.
SMTP_PASSWORD is never logged or exposed in any output.
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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

    html_body = f"""
    <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto;
                background: #0B1B2E; color: #F4F8FF; border-radius: 16px; padding: 36px 32px;">
      <div style="margin-bottom: 28px;">
        <span style="font-size: 1.5rem; font-weight: 800; color: #00AEEF;">Brainium</span>
        <span style="font-size: 0.82rem; font-weight: 600; background: #7C3AED; color: #fff;
                     padding: 2px 8px; border-radius: 999px; margin-left: 10px;">
          Estimation Portal
        </span>
      </div>
      <h2 style="font-size: 1.4rem; font-weight: 700; color: #F4F8FF; margin-bottom: 12px;">
        Verify your email address
      </h2>
      <p style="color: #C9D6EA; font-size: 0.97rem; line-height: 1.65; margin-bottom: 8px;">
        Hi {full_name}, thank you for signing up.<br>
        Use the verification code below to activate your account.
        This code expires in {expiry} minutes.
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <span style="display: inline-block; background: #142B45; border: 1px solid #2B4564;
                     border-radius: 14px; padding: 18px 40px; font-size: 2.4rem;
                     font-weight: 800; letter-spacing: 0.28em; color: #00AEEF;">
          {code}
        </span>
      </div>
      <p style="color: #8FA6C4; font-size: 0.88rem; line-height: 1.6;">
        If you did not create a Brainium account, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #2B4564; margin: 28px 0;" />
      <p style="color: #8FA6C4; font-size: 0.78rem;">
        Brainium Project Estimation Portal
      </p>
    </div>
    """

    text_body = (
        f"Hi {full_name},\n\n"
        f"Your Brainium verification code is: {code}\n\n"
        f"This code expires in {expiry} minutes.\n\n"
        f"If you didn't sign up, please ignore this email.\n\n"
        f"– Brainium"
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
) -> None:
    """
    Send a notification email.

    - Silently logs failures (does NOT raise) so the main action is never blocked.
    - Respects the NOTIFICATION_EMAIL_ENABLED environment variable.
    - SMTP_PASSWORD is never logged.
    """
    if not _notification_enabled():
        return

    title_section = ""
    if estimate_title:
        title_section = (
            f'<div style="margin: 16px 0; padding: 12px 16px; background: #142B45; '
            f'border: 1px solid #2B4564; border-radius: 10px; '
            f'color: #C9D6EA; font-size: 0.92rem;">'
            f'Estimate: <strong style="color: #F4F8FF;">{estimate_title}</strong>'
            f'</div>'
        )

    html_body = f"""
    <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto;
                background: #0B1B2E; color: #F4F8FF; border-radius: 16px; padding: 36px 32px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 1.4rem; font-weight: 800; color: #00AEEF;">Brainium</span>
        <span style="font-size: 0.78rem; font-weight: 600; background: #7C3AED; color: #fff;
                     padding: 2px 8px; border-radius: 999px; margin-left: 10px;">
          Notification
        </span>
      </div>
      <h2 style="font-size: 1.18rem; font-weight: 700; color: #F4F8FF; margin-bottom: 10px;">
        {subject}
      </h2>
      {title_section}
      <p style="color: #C9D6EA; font-size: 0.95rem; line-height: 1.65;">{message}</p>
      <hr style="border: none; border-top: 1px solid #2B4564; margin: 28px 0;" />
      <p style="color: #8FA6C4; font-size: 0.78rem;">Brainium Project Estimation Portal</p>
    </div>
    """

    text_body = f"{subject}\n\n{message}\n\n– Brainium"

    try:
        send_email(to_email, subject, html_body, text_body)
    except Exception as exc:
        # Non-fatal: log but never crash the main request
        logger.warning(
            "[Notification] Email to %s failed (non-fatal): %s",
            to_email, str(exc),
        )
