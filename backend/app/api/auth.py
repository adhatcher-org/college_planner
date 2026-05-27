from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.core.security import hash_password, verify_password
from app.models import User, UserRole
from app.schemas import (
    AccountDelete,
    ForcedPasswordReset,
    LoginRequest,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenResponse,
    UserCreate,
    UserRead,
    UserUpdate,
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


@router.patch("/me", response_model=UserRead)
def update_me(payload: UserUpdate, db: DbSession, current_user: CurrentUser) -> User:
    updates = payload.model_dump(exclude_unset=True)
    requested_email = updates.pop("email", None)
    current_password = updates.pop("current_password", None)

    if requested_email is not None:
        normalized_email = requested_email.lower()
        if normalized_email != current_user.email:
            if not current_password or not verify_password(current_password, current_user.password_hash):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
            existing = db.query(User).filter(User.email == normalized_email, User.id != current_user.id).first()
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
            current_user.email = normalized_email

    for key, value in updates.items():
        setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=UserRead)
def change_password(payload: PasswordChange, db: DbSession, current_user: CurrentUser) -> User:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    current_user.force_password_reset = False
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(payload: AccountDelete, db: DbSession, current_user: CurrentUser) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    db.delete(current_user)
    db.commit()


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
