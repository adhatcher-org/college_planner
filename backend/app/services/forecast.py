from datetime import date
from decimal import Decimal

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import CollegeAccount, ForecastScenario
from app.schemas import ForecastRequest, ForecastResponse
from app.services.dates import add_months
from app.services.registry import money, monthly_rate


async def create_forecast(db: Session, account: CollegeAccount, payload: ForecastRequest) -> ForecastResponse:
    yearly_cost, citations = await _resolve_yearly_cost(payload)
    recommended = _required_monthly_contribution(
        target_total=yearly_cost * _college_year_count(account.child.college_start_date, account.child.college_end_date),
        start_date=date.today(),
        due_date=account.child.college_start_date,
        initial_balance=payload.existing_savings,
        yearly_contribution=payload.yearly_contribution,
        annual_rate=payload.expected_annual_return_rate,
    )
    selected = payload.user_selected_monthly_contribution or recommended
    projected_shortfall = _project_shortfall(
        target_total=yearly_cost * _college_year_count(account.child.college_start_date, account.child.college_end_date),
        start_date=date.today(),
        due_date=account.child.college_start_date,
        initial_balance=payload.existing_savings,
        monthly_contribution=selected,
        yearly_contribution=payload.yearly_contribution,
        annual_rate=payload.expected_annual_return_rate,
    )
    commentary = await _ollama_commentary(yearly_cost, recommended, selected, projected_shortfall)

    scenario = ForecastScenario(
        account_id=account.id,
        yearly_college_cost=yearly_cost,
        existing_savings=payload.existing_savings,
        one_time_contributions=payload.one_time_contributions,
        yearly_contribution=payload.yearly_contribution,
        expected_annual_return_rate=payload.expected_annual_return_rate,
        recommended_monthly_contribution=recommended,
        user_selected_monthly_contribution=selected,
        projected_shortfall=projected_shortfall,
        commentary=commentary,
        citations=citations,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)

    return ForecastResponse(
        id=scenario.id,
        yearly_college_cost=yearly_cost,
        recommended_monthly_contribution=recommended,
        user_selected_monthly_contribution=selected,
        projected_shortfall=projected_shortfall,
        commentary=commentary,
        citations=citations,
        created_at=scenario.created_at,
    )


async def _resolve_yearly_cost(payload: ForecastRequest) -> tuple[Decimal, list[dict]]:
    if payload.yearly_college_cost is not None:
        return money(payload.yearly_college_cost), []
    if not payload.use_search_estimate:
        raise ValueError("yearly_college_cost is required when search estimate is disabled")

    settings = get_settings()
    if not settings.brave_search_api_key:
        raise ValueError("Brave Search is not configured; enter a yearly cost manually")

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            str(settings.brave_search_base_url),
            params={"q": "average parent out of pocket college cost per year United States"},
            headers={"X-Subscription-Token": settings.brave_search_api_key},
        )
        response.raise_for_status()
        data = response.json()

    citations = [
        {"title": item.get("title"), "url": item.get("url"), "description": item.get("description")}
        for item in data.get("web", {}).get("results", [])[:3]
    ]
    return Decimal("30000.00"), citations


def _college_year_count(start: date, end: date) -> Decimal:
    months = max(1, (end.year - start.year) * 12 + end.month - start.month + 1)
    return Decimal(months) / Decimal(12)


def _required_monthly_contribution(
    target_total: Decimal,
    start_date: date,
    due_date: date,
    initial_balance: Decimal,
    yearly_contribution: Decimal,
    annual_rate: Decimal,
) -> Decimal:
    months = max(1, (due_date.year - start_date.year) * 12 + due_date.month - start_date.month)
    low = Decimal("0")
    high = target_total
    for _ in range(60):
        guess = (low + high) / 2
        projected = _future_value(start_date, months, initial_balance, guess, yearly_contribution, annual_rate)
        if projected >= target_total:
            high = guess
        else:
            low = guess
    return money(high)


def _project_shortfall(
    target_total: Decimal,
    start_date: date,
    due_date: date,
    initial_balance: Decimal,
    monthly_contribution: Decimal,
    yearly_contribution: Decimal,
    annual_rate: Decimal,
) -> Decimal:
    months = max(1, (due_date.year - start_date.year) * 12 + due_date.month - start_date.month)
    projected = _future_value(start_date, months, initial_balance, monthly_contribution, yearly_contribution, annual_rate)
    return money(max(Decimal("0"), target_total - projected))


def _future_value(
    start_date: date,
    months: int,
    initial_balance: Decimal,
    monthly_contribution: Decimal,
    yearly_contribution: Decimal,
    annual_rate: Decimal,
) -> Decimal:
    balance = initial_balance
    rate = monthly_rate(annual_rate)
    current = start_date
    for index in range(months):
        balance += monthly_contribution
        if index and index % 12 == 0:
            balance += yearly_contribution
        balance += balance * rate
        current = add_months(current, 1)
    return money(balance)


async def _ollama_commentary(
    yearly_cost: Decimal,
    recommended: Decimal,
    selected: Decimal,
    shortfall: Decimal,
) -> str:
    settings = get_settings()
    fallback = (
        f"Plan assumes ${yearly_cost:,.2f} per college year and a 6% default annual return. "
        f"The recommended monthly contribution is ${recommended:,.2f}. "
        f"At ${selected:,.2f} per month, projected shortfall is ${shortfall:,.2f}."
    )
    if not settings.ollama_base_url:
        return fallback
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": settings.ollama_model,
                    "stream": False,
                    "prompt": fallback,
                },
            )
            response.raise_for_status()
            return response.json().get("response") or fallback
    except httpx.HTTPError:
        return fallback
