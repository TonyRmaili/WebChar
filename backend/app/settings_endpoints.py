# from fastapi import APIRouter,Depends
# from typing import Annotated
# from app.database.models import User
# from app.security import get_current_user
# from sqlalchemy.orm import Session, joinedload, selectinload
# from sqlalchemy import select
# from app.db_setup import get_db
# from app.database.schemas import UserNewSettingsSchema

# router = APIRouter(tags=["settings"])




# @router.post("/settings")
# def change_user_settings(form_data:UserNewSettingsSchema,
#                         current_user: Annotated[User, Depends(get_current_user)],
#                         db:Session = Depends(get_db)):
#     print("valid user",current_user.user_name)
    
#     if form_data.first_name is not None and form_data.first_name != '':
#         change_first_name(form_data.first_name,current_user.id,db)

#     if form_data.last_name is not None and form_data.last_name != '':
#         change_last_name(form_data.last_name,current_user.id,db)

#     if form_data.user_name is not None and form_data.user_name != '':
#         change_user_name(form_data.user_name,current_user.id,db)

#     if form_data.email is not None and form_data.email != '':
#         change_email(form_data.email,current_user.id,db)

#     if form_data.adress is not None and form_data.adress != '':
#         change_adress(form_data.adress,current_user.id,db)

#     if form_data.phone_nr is not None and form_data.phone_nr != '':
#         change_phone_nr(form_data.phone_nr,current_user.id,db)


#     return {"ok"}


# def change_first_name(new_first_name,user_id,db):
#     user = db.scalars(
#         select(User)
#         .where(User.id == user_id)
#     ).first()
    
#     if user:
#         user.first_name = new_first_name
#         db.commit()
#         return ("First name updated successfully")
#     else:
#         return ("User not found")
    
# def change_last_name(new_last_name,user_id,db):
#     user = db.scalars(
#         select(User)
#         .where(User.id == user_id)
#     ).first()
    
#     if user:
#         user.last_name = new_last_name
#         db.commit()
#         return ("Last name updated successfully")
#     else:
#         return ("User not found")
    
# def change_user_name(new_user_name,user_id,db):
#     user = db.scalars(
#         select(User)
#         .where(User.id == user_id)
#     ).first()
    
#     if user:
#         user.user_name = new_user_name
#         db.commit()
#         return ("Last name updated successfully")
#     else:
#         return ("User not found")
    
# def change_email(new_email,user_id,db):
#     user = db.scalars(
#         select(User)
#         .where(User.id == user_id)
#     ).first()
    
#     if user:
#         user.email = new_email
#         db.commit()
#         return ("Last name updated successfully")
#     else:
#         return ("User not found")
    
# def change_adress(new_adress,user_id,db):
#     user = db.scalars(
#         select(User)
#         .where(User.id == user_id)
#     ).first()
    
#     if user:
#         user.adress = new_adress
#         db.commit()
#         return ("Last name updated successfully")
#     else:
#         return ("User not found")
    
# def change_phone_nr(new_phone_nr,user_id,db):
#     user = db.scalars(
#         select(User)
#         .where(User.id == user_id)
#     ).first()
    
#     if user:
#         user.phone_nr = new_phone_nr
#         db.commit()
#         return ("Last name updated successfully")
#     else:
#         return ("User not found")


