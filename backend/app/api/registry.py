from datetime import date

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession, get_owned_account
from app.models import BalanceAdjustment
from app.schemas import BalanceAdjustmentCreate, BalanceAdjustmentRead, RegistryResponse
from app.services.registry import project_registry

router = APIRouter(prefix="/registry", tags=["registry"])


@router.get("/{account_id}", response_model=RegistryResponse)
def registry(
    account_id: int,
    start_date: date,
    end_date: date,
    db: DbSession,
    current_user: CurrentUser,
    description: str | None = None,
    row_type: str | None = None,
    grouping: str = "none",
    sort: str = "date_asc",
) -> RegistryResponse:
    account = get_owned_account(db, current_user, account_id)
    return project_registry(
        db=db,
        account=account,
        range_start=start_date,
        range_end=end_date,
        description=description,
        row_type=row_type,
        grouping=grouping,
        sort=sort,
    )


@router.get("/{account_id}/balance-adjustments", response_model=list[BalanceAdjustmentRead])
def list_balance_adjustments(
    account_id: int,
    db: DbSession,
    current_user: CurrentUser,
) -> list[BalanceAdjustment]:
    get_owned_account(db, current_user, account_id)
    return (
        db.query(BalanceAdjustment)
        .filter(BalanceAdjustment.account_id == account_id)
        .order_by(BalanceAdjustment.adjustment_date)
        .all()
    )


@router.post(
    "/{account_id}/balance-adjustments",
    response_model=BalanceAdjustmentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_balance_adjustment(
    account_id: int,
    payload: BalanceAdjustmentCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> BalanceAdjustment:
    get_owned_account(db, current_user, account_id)
    adjustment = BalanceAdjustment(account_id=account_id, **payload.model_dump())
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)
    return adjustment
