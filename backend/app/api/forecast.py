from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession, get_owned_account
from app.schemas import ForecastRequest, ForecastResponse
from app.services.forecast import create_forecast

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.post("", response_model=ForecastResponse)
async def forecast(payload: ForecastRequest, db: DbSession, current_user: CurrentUser) -> ForecastResponse:
    account = get_owned_account(db, current_user, payload.account_id)
    try:
        return await create_forecast(db, account, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
