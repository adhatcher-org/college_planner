from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession, get_owned_account
from app.models import DepositSchedule, ExpenseSchedule, ScheduleKind, ScheduleOccurrenceOverride
from app.schemas import (
    OccurrenceOverrideCreate,
    OccurrenceOverrideRead,
    ScheduleCreate,
    ScheduleRead,
    ScheduleUpdate,
)

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("/deposits", response_model=list[ScheduleRead])
def list_deposits(account_id: int, db: DbSession, current_user: CurrentUser) -> list[DepositSchedule]:
    get_owned_account(db, current_user, account_id)
    return db.query(DepositSchedule).filter(DepositSchedule.account_id == account_id).all()


@router.post("/deposits", response_model=ScheduleRead, status_code=status.HTTP_201_CREATED)
def create_deposit(payload: ScheduleCreate, db: DbSession, current_user: CurrentUser) -> DepositSchedule:
    get_owned_account(db, current_user, payload.account_id)
    schedule = DepositSchedule(**payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.patch("/deposits/{schedule_id}", response_model=ScheduleRead)
def update_deposit(
    schedule_id: int,
    payload: ScheduleUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> DepositSchedule:
    schedule = _get_deposit(db, current_user, schedule_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(schedule, key, value)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/deposits/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deposit(schedule_id: int, db: DbSession, current_user: CurrentUser) -> None:
    schedule = _get_deposit(db, current_user, schedule_id)
    db.delete(schedule)
    db.commit()


@router.get("/expenses", response_model=list[ScheduleRead])
def list_expenses(account_id: int, db: DbSession, current_user: CurrentUser) -> list[ExpenseSchedule]:
    get_owned_account(db, current_user, account_id)
    return db.query(ExpenseSchedule).filter(ExpenseSchedule.account_id == account_id).all()


@router.post("/expenses", response_model=ScheduleRead, status_code=status.HTTP_201_CREATED)
def create_expense(payload: ScheduleCreate, db: DbSession, current_user: CurrentUser) -> ExpenseSchedule:
    get_owned_account(db, current_user, payload.account_id)
    schedule = ExpenseSchedule(**payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.patch("/expenses/{schedule_id}", response_model=ScheduleRead)
def update_expense(
    schedule_id: int,
    payload: ScheduleUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> ExpenseSchedule:
    schedule = _get_expense(db, current_user, schedule_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(schedule, key, value)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/expenses/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(schedule_id: int, db: DbSession, current_user: CurrentUser) -> None:
    schedule = _get_expense(db, current_user, schedule_id)
    db.delete(schedule)
    db.commit()


@router.post(
    "/occurrence-overrides",
    response_model=OccurrenceOverrideRead,
    status_code=status.HTTP_201_CREATED,
)
def upsert_occurrence_override(
    payload: OccurrenceOverrideCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> ScheduleOccurrenceOverride:
    get_owned_account(db, current_user, payload.account_id)
    if payload.schedule_kind == ScheduleKind.DEPOSIT:
        _get_deposit(db, current_user, payload.schedule_id)
    else:
        _get_expense(db, current_user, payload.schedule_id)

    override = (
        db.query(ScheduleOccurrenceOverride)
        .filter(
            ScheduleOccurrenceOverride.account_id == payload.account_id,
            ScheduleOccurrenceOverride.schedule_kind == payload.schedule_kind,
            ScheduleOccurrenceOverride.schedule_id == payload.schedule_id,
            ScheduleOccurrenceOverride.original_date == payload.original_date,
        )
        .first()
    )
    if override:
        for key, value in payload.model_dump().items():
            setattr(override, key, value)
    else:
        override = ScheduleOccurrenceOverride(**payload.model_dump())
        db.add(override)
    db.commit()
    db.refresh(override)
    return override


def _get_deposit(db, current_user, schedule_id: int) -> DepositSchedule:
    schedule = db.get(DepositSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    get_owned_account(db, current_user, schedule.account_id)
    return schedule


def _get_expense(db, current_user, schedule_id: int) -> ExpenseSchedule:
    schedule = db.get(ExpenseSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    get_owned_account(db, current_user, schedule.account_id)
    return schedule
