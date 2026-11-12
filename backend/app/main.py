from fastapi import FastAPI, HTTPException, Depends, status, Response
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated
from app.database.models import User
from app.security import hash_password, verify_password, create_access_token, get_current_user
from app.db_setup import init_db, get_db
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from dotenv import load_dotenv
import os
import shutil
from pathlib import Path

from app.combat_functions import damage_health, heal_health, on_longrest, on_shortrest, grant_experience
from app.character_files import edit_character, get_owned_character

from app.routers.minions import router as minions_router
from app.routers.campaigns import router as campaign_router
from app.routers.encounters import router as encounter_router
from app.routers.groups import router as group_router
from app.routers.templates import router as template_router
from app.routers.tables import router as table_router
from app.routers.dice import router as dice_router
from app.routers.catalogues import router as catalogue_router
from app.routers.characters import router as character_router

from app.database.schemas import (
    UserSchema,
    UserOut,

    HealthData,
    TakeRestData,
    TakeRestAllData,
    GrantExperienceAll,
)
# uvicorn app.main:app --reload



#------------------------Setup-----------------------------
load_dotenv(override=True)

ALGORITHM = os.getenv("ALGORITHM")
SECRET_KEY = os.getenv("SECRET_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")

savefiles_path = "./app/database/save_files/"
fiveEtools_path = os.path.join(os.path.dirname(__file__), "../AIdata/5etools_data/")

output_path = "./app/output/"

CurrentUser = Annotated[User, Depends(get_current_user)]

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    # PATCH is needed for saving characters (PATCH /character/{id}).
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    # allow_headers=["*"]
)

app.include_router(minions_router)
app.include_router(campaign_router)
app.include_router(encounter_router)
app.include_router(template_router)
app.include_router(group_router)
app.include_router(table_router)
app.include_router(dice_router)
app.include_router(catalogue_router)
app.include_router(character_router)


@app.middleware("http")
async def csp_middleware(request, call_next):
    resp = await call_next(request)
    if os.getenv("ENV", "development") == "development":
        resp.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-eval'; "       # ← allow eval in DEV
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' http://localhost:5173 http://localhost:8000 ws://localhost:5173;"
        )
    return resp


# ------------------------User-----------------------------
# response_model=UserOut: only id, name, email, selected campaign and the
# character list are sent back. Never the password hash.

@app.post("/create_account", status_code=status.HTTP_201_CREATED, tags=["user"], response_model=UserOut)
def create_account(user: UserSchema, db: Session = Depends(get_db)):
    hashed_password: str = hash_password(user.password)
    user.password = hashed_password
    try:
        new_user = User(**user.model_dump())
        db.add(new_user)
        db.commit()
        username = new_user.name
        profile_path = savefiles_path + username
        campaigns_path = os.path.join(profile_path,"campaigns")
        os.makedirs(profile_path,exist_ok=True)
        os.makedirs(campaigns_path,exist_ok=True)

    except IntegrityError:
        raise HTTPException(detail="User already exists", status_code=status.HTTP_400_BAD_REQUEST) # ?Might not be secure?

    return new_user

@app.delete("/delete_account",tags=["user"])
def delete_account(current_user: CurrentUser, db: Session = Depends(get_db)):

     # 1) Load the user (extra safety)
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    for ch in list(db_user.characters):   # ensure it's a list copy
        db.delete(ch)

    db.delete(db_user)
    db.commit()

    # 4) Delete any user-owned files on disk (ignore errors if not present)
    try:
        user_dir = Path(savefiles_path) / current_user.name
        if user_dir.exists():
            shutil.rmtree(user_dir)
    except Exception:
        # Don't fail the request if file cleanup has issues
        pass

    return Response(status_code=204)

@app.post("/login", tags=["user"])
def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(User.name == form_data.username)).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not exist",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Passwords do not match",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=float(ACCESS_TOKEN_EXPIRE_MINUTES))
    access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=access_token_expires)

    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", tags=["user"], response_model=UserOut)
def read_users_me(current_user: CurrentUser):
    return current_user


# ------------------------Combat-----------------------------
# Characters are found by their database id. Each change goes through
# edit_character, which reads the file, lets the rule change it and saves
# it, one request at a time per character (see app/character_files.py).

@app.post("/combat/health", tags=["combat"])
def change_health(form_data: HealthData, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, form_data.char_id)

    with edit_character(current_user.name, char.id) as data:
        if form_data.value < 0:
            damage_health(data, form_data.value)
        elif form_data.value > 0:
            heal_health(data, form_data.value)

    return {"health": data["health"]}

@app.post("/combat/rest", tags=["combat"])
def take_rest(form_data: TakeRestData, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, form_data.char_id)

    with edit_character(current_user.name, char.id) as data:
        if form_data.rest_type == "long":
            on_longrest(data)
        else:
            on_shortrest(data)

    # The rested character, so the sheet can show it without asking again.
    return data

@app.post("/combat/rest_all", tags=["combat"])
def take_rest_all(form_data: TakeRestAllData, current_user: CurrentUser, db: Session = Depends(get_db)):
    # Check every id first, so a wrong one rests nobody instead of half the party.
    chars = [get_owned_character(db, current_user, char_id) for char_id in form_data.char_ids]
    rest = on_longrest if form_data.rest_type == "long" else on_shortrest

    for char in chars:
        with edit_character(current_user.name, char.id) as data:
            rest(data)

    return {"ok": True, "rested": [char.id for char in chars]}

@app.post("/combat/experience", tags=["combat"])
def grant_all_exp(form_data: GrantExperienceAll, current_user: CurrentUser):
    # Known bug, to fix later: this gives XP to EVERY character of the
    # user, not only the active ones. The fix is to send char_ids, like
    # rest_all does.
    for character in current_user.characters:
        with edit_character(current_user.name, character.id) as data:
            grant_experience(data, form_data.delta)

    return {"ok": True}