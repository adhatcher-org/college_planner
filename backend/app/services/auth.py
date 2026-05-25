import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import PasswordResetToken, User, UserRole


def bootstrap_admin(db: Session) -> None:
    settings = get_settings()
    existing = db.query(User).filter(User.email == settings.admin_email.lower()).first()
    if existing:
        return
    db.add(
        User(
            email=settings.admin_email.lower(),
            first_name="Default",
            last_name="Admin",
            password_hash=hash_password(settings.admin_initial_password),
            role=UserRole.ADMIN,
            force_password_reset=True,
        )
    )
    db.commit()


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email.lower()).first()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def issue_token(user: User) -> str:
    return create_access_token(str(user.id))


def create_password_reset_token(db: Session, user: User) -> str:
    settings = get_settings()
    raw_token = secrets.token_urlsafe(32)
    token = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_password(raw_token),
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.password_reset_minutes),
    )
    db.add(token)
    db.commit()
    return raw_token


def reset_password_with_token(db: Session, raw_token: str, new_password: str) -> bool:
    tokens = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.used_at.is_(None), PasswordResetToken.expires_at > datetime.now(UTC))
        .all()
    )
    for token in tokens:
        if verify_password(raw_token, token.token_hash):
            user = db.get(User, token.user_id)
            if not user:
                return False
            user.password_hash = hash_password(new_password)
            user.force_password_reset = False
            token.used_at = datetime.now(UTC)
            db.commit()
            return True
    return False
