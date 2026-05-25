import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, token: str) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        logger.info("password reset token created; smtp disabled", extra={"email": to_email})
        return

    message = EmailMessage()
    message["Subject"] = "College Planner password reset"
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message.set_content(f"Use this password reset token: {token}")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
