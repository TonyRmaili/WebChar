from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from app.database.models import User
from app.security import get_current_user

from typing import Annotated




SAVEFILES_PATH = "./app/database/save_files/"



router = APIRouter(prefix="/characters", tags=["characters"])

CurrentUser = Annotated[User, Depends(get_current_user)]
CharName = Annotated[str, Query(min_length=1, max_length=120)]



# ---------- endpoints ----------

