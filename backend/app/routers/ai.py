"""The AI settings (Settings → AI & API keys) and today's usage (the DM
Assistant shows it under the chat box). The budget itself: app/ai_usage.py."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app import ai_usage
from app.database.models import User
from app.security import get_current_user


router = APIRouter(prefix="/ai", tags=["ai"])

CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("/usage")
def get_usage(current_user: CurrentUser, utc_offset: int = Query(0, ge=-14 * 60, le=14 * 60)):
    """Today's tokens. The browser says what its clock is, so "today" is the user's."""
    ai_usage.set_offset(current_user.name, utc_offset)
    return ai_usage.usage(current_user.name)


class LimitRequest(BaseModel):
    daily_limit: int | None = Field(default=None, ge=0, le=100_000_000)  # None = no limit


@router.put("/limit")
def set_limit(payload: LimitRequest, current_user: CurrentUser):
    ai_usage.set_limit(current_user.name, payload.daily_limit)
    return ai_usage.usage(current_user.name)
