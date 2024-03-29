from fastapi import APIRouter,Depends
from app.db_setup import init_db,get_db
from sqlalchemy.orm import Session, joinedload, selectinload, load_only
from sqlalchemy import select, update, delete, insert
from sqlalchemy.exc import IntegrityError, NoResultFound
from typing import Annotated
from datetime import timedelta, datetime
from dotenv import load_dotenv 
import os
from app.database.schemas import UserSchema,UserOutSchema,TokenSchema
from app.database.models import User,Pet


filter_router = APIRouter(tags=["filter"])


# @filter_router.post("/cards/filter")
# def filter_cards(filter: dict, db: Session = Depends(get_db)):
#     query = select(Pet).options(selectinload(Pet.user),selectinload(Pet.pictures))

#     # Dynamically add conditions based on filter options
#     if filter["gender"] != "" :
#         query = query.where(Pet.gender == filter["gender"])
#     if filter["animal"] != "":
#         query = query.where(Pet.animal == filter["animal"])

#     pets = db.execute(query).scalars().all()
#     return pets






