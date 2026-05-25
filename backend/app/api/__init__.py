from fastapi import APIRouter

from app.api import auth, children, forecast, registry, schedules

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(children.router)
api_router.include_router(schedules.router)
api_router.include_router(registry.router)
api_router.include_router(forecast.router)
