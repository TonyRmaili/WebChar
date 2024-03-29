from fastapi import FastAPI, HTTPException, Depends, status,Request
from app.db_setup import init_db, get_db
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import select, update, delete, insert
from sqlalchemy.exc import IntegrityError
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated
from fastapi import Query

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db() 
    yield

app = FastAPI(lifespan=lifespan)



app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"]
)








# user endpoints
# @app.post("/user_login", tags=["user"])
# def validate_user(data:UserSchemaSlim,db:Session = Depends(get_db)):
#     users = db.scalars(select(User)).all()

#     for user in users:
#         if data.user_name == user.user_name and data.password == user.password:
#             print(user)
#             return {user}
#     return {"error, user not found"}


# @app.get("/user", status_code=200,tags=["user"])
# def list_users(db: Session = Depends(get_db)):
#     users = db.scalars(select(User)
#     .options(selectinload(User.pets),selectinload(User.pictures),selectinload(User.posts))).all()

#     if not users:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No users found")
#     return users


# @app.post("/user",tags=["user"])
# def add_user(user:UserSchema, db:Session= Depends(get_db)):
#     print(user)
#     try:
#         db_user = User(**user.model_dump())
#         db.add(db_user)
#         db.commit()
#     except IntegrityError:
#         raise HTTPException(status_code=400, detail="Database")
#     return db_user


# @app.get("/user/{id}",tags=["user"])
# def user_detail(id: int, db: Session = Depends(get_db)):

#     result = db.scalars(
#         select(User)
#         .where(User.id == id)
#     ).first()
#     if not result:
#         return HTTPException(status_code=404, detail="User not found")
#     return result


# @app.get("/other/{userName}",tags=["user"])
# def get_user_by_name(current_user: Annotated[User, Depends(get_current_user)],
#     userName: str, db: Session = Depends(get_db)):

#     result = db.scalars(
#         select(User).options(selectinload(User.posts))
#         .where(User.user_name == userName)
#     ).first()
#     if not result:
#         return HTTPException(status_code=404, detail="User not found")
#     return result




# @app.delete("/user/{user_id}",status_code=status.HTTP_204_NO_CONTENT,tags=["user"])
# def delete_user_id(user_id:int, db:Session = Depends(get_db)):
#     db_user = db.scalars(select(User).where(
#         User.id == user_id)).first()
#     if db_user is None:
#         raise HTTPException(status_code=404, detail="User not found")
#     db.delete(db_user)
#     db.commit()
#     return {}


# @app.get("/user/full/{id}",tags=["user"])
# def get_user_full(id: int, db: Session = Depends(get_db)):
#     """
   
#     We use joinedload for this (we could also use selectinload)
#     Both above are loading strategies when we work with relationships
#     """
#     result = db.scalars(
#         select(User)
#         .where(User.id == id)
#         .options(joinedload(User.pets))
#         .options(joinedload(User.pictures))
#     ).first()
    
#     return result

# @app.get("/check-username", tags=["user"])
# def get_username_check(username: str = Query(..., min_length=1), db: Session = Depends(get_db)):
#     user = db.query(User).filter(User.user_name == username).first()

#     if user:
#         return {"exists": True}
#     else: 
#         return {"exists": False}  




# # pet endpoints
# @app.get("/pet", status_code=200,tags=["pet"])
# def list_pets(db: Session = Depends(get_db)):
#     pets = db.scalars(select(Pet).options(selectinload(Pet.user),selectinload(Pet.pictures))).all()
#     if not pets:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pets found")
#     return pets


# @app.post("/pet",tags=["pet"])
# def add_pet(current_user: Annotated[User, Depends(get_current_user)],
#             pet:PetSchema, db:Session = Depends(get_db)): 
#     try:
#         db_pet = Pet(**pet.model_dump())
#         db.add(db_pet)
#         db.commit()
#     except IntegrityError:
#         raise HTTPException(status_code=400, detail="Database")
#     return db_pet.id



# @app.delete("/pet/{pet_id}",status_code=status.HTTP_204_NO_CONTENT,tags=["pet"])
# def delete_pet(pet_id:int, db:Session = Depends(get_db)):
#     db_pet = db.scalars(select(Pet).where(
#         Pet.id == pet_id)).first()
#     if db_pet is None:
#         raise HTTPException(status_code=404, detail="pet not found")
#     db.delete(db_pet)
#     db.commit()
#     return {}





# # picture endpoints 
# @app.get("/picture", status_code=200,tags=["pictures"])
# def list_pictures(db: Session = Depends(get_db)):
#     pics = db.scalars(select(Picture).options(joinedload(Picture.user))).all()
#     if not pics:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pictures found")
#     return pics


# @app.post("/picture",tags=["pictures"])
# def add_picture(pic_path:PictureSchema, db:Session = Depends(get_db)):
#     try:
#         db_pic = Picture(**pic_path.model_dump())
#         db.add(db_pic)
#         db.commit()
#     except IntegrityError:
#         raise HTTPException(status_code=400, detail="Database")
#     return db_pic


# @app.delete("/picture/{pic_id}",status_code=status.HTTP_204_NO_CONTENT,tags=["pictures"])
# def delete_picture(pic_id:int, db:Session = Depends(get_db)):
#     db_pic = db.scalars(select(Picture).where(
#         Picture.id == pic_id)).first()
#     if db_pic is None:
#         raise HTTPException(status_code=404, detail="Pic not found")
#     db.delete(db_pic)
#     db.commit()
#     return {}


# # post endpoints
# @app.post("/post", tags=["post"])
# def add_post(post:PostSchema, db:Session= Depends(get_db)):
#     try:
#         db_post = Post(**post.model_dump())
#         db.add(db_post)
#         db.commit()
#     except IntegrityError:
#         raise HTTPException(status_code=400, detail="Database")
#     return db_post

# @app.get("/post", status_code=200,tags=["post"])
# def list_posts(db: Session = Depends(get_db), current_user: UserSchema = Depends(get_current_user)):
#     posts = db.scalars(select(Post)
#             .where(Post.user_id == current_user.id)).all()

#     if not posts:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No posts found")
#     return posts


# @app.post("/favorites", tags=["social"])
# def add_favorite(ids: FavoriteSchema,
#     db: Session = Depends(get_db)):

#     user = db.scalars(select(User).where(User.id == ids.user_id)).first() 
#     pet = db.scalars(select(Pet).where(Pet.id == ids.pet_id)).first() 
#     favorite = Favorite(user=user, pet=pet)
    
#     db.add(favorite)
#     db.commit()
#     return favorite


# @app.post("/likes", tags=["social"])
# def add_favorite(ids: LikeSchema,
#     db: Session = Depends(get_db)):
#     try:
#         liker = db.scalars(select(User).where(User.id == ids.liker_id)).first() 
#         liked = db.scalars(select(User).where(User.id == ids.liked_id)).first() 
#         like = Like(liker=liker, liked=liked)
#         db.add(like)
#         db.commit()
#     except IntegrityError:
#         raise HTTPException(status_code=400, detail="Database")
#     return like

# @app.post("/messages", tags=["social"])
# def add_message(form_data: MessageSchema,
#     db: Session = Depends(get_db)):
#     try:

#         sender = db.scalars(select(User).where(User.id == form_data.sender_id)).first() 
#         receiver = db.scalars(select(User).where(User.id == form_data.receiver_id)).first()
        
#         message = Message(sender=sender, receiver=receiver,text=form_data.text)
#         db.add(message)
#         db.commit()

#     except IntegrityError:
#         raise HTTPException(status_code=400, detail="Database")
#     return message


