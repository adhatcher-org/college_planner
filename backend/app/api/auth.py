from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.core.security import hash_password, verify_password
from app.models import User, UserRole
from app.schemas import (
    ForcedPasswordReset,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenResponse,
    UserCreate,
    UserRead,
)
from app.services.auth import (
    authenticate,
    create_password_reset_token,
    issue_token,
    reset_password_with_token,
)
from app.services.email import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: DbSession) -> User:
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=payload.email.lower(),
        first_name=payload.first_name,
        last_name=payload.last_name,
        password_hash=hash_password(payload.password),
        role=UserRole.USER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    user = authenticate(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return TokenResponse(access_token=issue_token(user), force_password_reset=user.force_password_reset)


@router.get("/me", response_model=UserRead)
def me(current_user: CurrentUser) -> User:
    return current_user


@router.post("/force-password-reset", response_model=UserRead)
def force_password_reset(payload: ForcedPasswordReset, db: DbSession, current_user: CurrentUser) -> User:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    current_user.force_password_reset = False
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def request_password_reset(payload: PasswordResetRequest, db: DbSession) -> dict[str, str]:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user:
        token = create_password_reset_token(db, user)
        send_password_reset_email(user.email, token)
    return {"detail": "If the account exists, a reset email has been sent."}


@router.post("/password-reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirm, db: DbSession) -> dict[str, str]:
    if not reset_password_with_token(db, payload.token, payload.password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
    return {"detail": "Password reset complete"}
