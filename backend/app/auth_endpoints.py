from fastapi import FastAPI, HTTPException, Depends, status, APIRouter,UploadFile,File
from app.db_setup import init_db,get_db
from contextlib import asynccontextmanager
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload, selectinload, load_only
from sqlalchemy import select, update, delete, insert
from sqlalchemy.exc import IntegrityError, NoResultFound
from app.security import hash_password, verify_password,create_access_token,get_current_user
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from datetime import timedelta, datetime
from dotenv import load_dotenv 
import os
from app.database.schemas import UserSchema,UserOutSchema,TokenSchema,PictureSchemaIn
from app.database.models import User, Pet,Picture
from pathlib import Path



FRONTEND_PUBLIC_DIR = Path(__file__).resolve().parent.parent.parent / 'frontend' / 'public' / 'pictures'


load_dotenv(override=True)

ALGORITHM = os.getenv("ALGORITHM")  
SECRET_KEY = os.getenv("SECRET_KEY")  
ACCESS_TOKEN_EXPIRE_MINUTES = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")  

router = APIRouter(tags=["auth"])

# @router.post("/user/create", status_code=status.HTTP_201_CREATED)
# def register_user(user: UserSchema, db: Session = Depends(get_db)) -> UserOutSchema:
#     hashed_password: str = hash_password(user.password)
#     user.password = hashed_password
#     try:
#         new_user = User(**user.model_dump())
#         db.add(new_user)
#         db.commit()
#     except IntegrityError:
#         raise HTTPException(detail="User already exists", status_code=status.HTTP_400_BAD_REQUEST) # ?Might not be secure?
    
#     return new_user



# @router.post("/user/login")
# def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)) -> TokenSchema:
#     user = db.scalars(select(User).where(User.email == form_data.username)).first()
   
#     if not user:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="User does not exist",
#             headers={"WWW-Authenticate": "Bearer"},
#         )
    
#     if not verify_password(form_data.password, user.password):
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Passwords do not match",
#             headers={"WWW-Authenticate": "Bearer"},
#         )
    
#     access_token_expires = timedelta(minutes=float(ACCESS_TOKEN_EXPIRE_MINUTES))
#     access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=access_token_expires)
    
#     return {"access_token": access_token, "token_type": "bearer"}



# @router.post("/user/upload_image")
# def upload_image(current_user: Annotated[User, Depends(get_current_user)],
#                  db:Session=Depends(get_db),
#                  userPic: UploadFile = File(...)):
#     os.makedirs(FRONTEND_PUBLIC_DIR, exist_ok=True)
#     file_path = FRONTEND_PUBLIC_DIR / userPic.filename
    
#     if len(current_user.pictures) <= 3:
#         with open(file_path, "wb") as buffer:
#             while True:
#                 chunk = userPic.file.read(1024)
#                 if not chunk:
#                     break
#                 buffer.write(chunk)

#         picture = Picture(file_path="/pictures/"+userPic.filename, user_id=current_user.id)
#         db.add(picture)
#         db.commit()
#         return current_user
    
#     else:
#         raise HTTPException(status_code=400, detail="Maximum number of pictures reached")



# @router.post("/pet/{pet_id}/upload_image")
# def upload_image(pet_id: int, 
#                 image: UploadFile = File(...),
#                 current_user: User = Depends(get_current_user), 
#                 db: Session = Depends(get_db)):
    
#     os.makedirs(FRONTEND_PUBLIC_DIR, exist_ok=True)
#     file_path = FRONTEND_PUBLIC_DIR / image.filename

#     pet = db.scalars(select(Pet).where(Pet.id == pet_id)).first()
#     if len(pet.pictures) <= 3:
#         with open(file_path, "wb") as buffer:
#             while True:
#                 chunk = image.file.read(1024)
#                 if not chunk:
#                     break
#                 buffer.write(chunk)

#         picture = Picture(file_path="/pictures/"+image.filename, pet_id=pet.id)
#         db.add(picture)
#         db.commit()
#         return pet
    
#     else:
#         raise HTTPException(status_code=400, detail="Maximum number of pictures reached")
    
    
   
# @router.get("/me")
# def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
#     return current_user