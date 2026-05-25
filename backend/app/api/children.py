from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.models import Child, CollegeAccount
from app.schemas import ChildCreate, ChildRead, ChildUpdate
from app.services.dates import default_college_end_date

router = APIRouter(prefix="/children", tags=["children"])


@router.get("", response_model=list[ChildRead])
def list_children(db: DbSession, current_user: CurrentUser) -> list[Child]:
    return db.query(Child).filter(Child.owner_id == current_user.id).order_by(Child.first_name).all()


@router.post("", response_model=ChildRead, status_code=status.HTTP_201_CREATED)
def create_child(payload: ChildCreate, db: DbSession, current_user: CurrentUser) -> Child:
    child = Child(
        owner_id=current_user.id,
        first_name=payload.first_name,
        college_start_date=payload.college_start_date,
        college_end_date=payload.college_end_date or default_college_end_date(payload.college_start_date),
    )
    child.account = CollegeAccount(
        initial_balance=payload.initial_balance,
        expected_annual_return_rate=payload.expected_annual_return_rate,
    )
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


@router.patch("/{child_id}", response_model=ChildRead)
def update_child(
    child_id: int,
    payload: ChildUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> Child:
    child = db.get(Child, child_id)
    if not child or child.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
    updates = payload.model_dump(exclude_unset=True)
    account_updates = {}
    for key in ("initial_balance", "expected_annual_return_rate"):
        if key in updates:
            account_updates[key] = updates.pop(key)
    for key, value in updates.items():
        setattr(child, key, value)
    if child.college_end_date is None:
        child.college_end_date = default_college_end_date(child.college_start_date)
    for key, value in account_updates.items():
        setattr(child.account, key, value)
    db.commit()
    db.refresh(child)
    return child


@router.delete("/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_child(child_id: int, db: DbSession, current_user: CurrentUser) -> None:
    child = db.get(Child, child_id)
    if not child or child.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
    db.delete(child)
    db.commit()
