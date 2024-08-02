from pydantic import BaseModel, Field, ConfigDict, EmailStr,constr
from enum import Enum
from datetime import datetime, timezone



class TokenPayload(BaseModel):
    sub: str = None
    exp: int = None

class UserSchema(BaseModel):
    name: str 
    email: str
    password: str 

class CharacterSchema(BaseModel):
    file_path: str 
    user_id: int
    name : str
  
class QueryRequest(BaseModel):
    question: str

# class GenderEnum(str, Enum):
#     Male = 'Male'
#     Female = 'Female'

# class AddTypeEnum(str,Enum):
#     Mate = 'mating'
#     Sell = 'sell'
#     Pet_sitting = 'pet_sitting'


# class FavoriteSchema(BaseModel):
#     pet_id: int
#     user_id: int
#     model_config = ConfigDict(from_attributes=True)

    
# class LikeSchema(BaseModel):
#     liked_id: int
#     liker_id: int
#     model_config = ConfigDict(from_attributes=True)



# # token
# class TokenSchema(BaseModel):
#     access_token: str
#     token_type: str
#     model_config = ConfigDict(from_attributes=True)


    
# class TokenData(BaseModel):
#     username: str | None = None



# # login
# class LoginData(BaseModel):
#     username: str
#     password: str



# # pictures
# class PictureSchema(BaseModel):
#     file_path: str
#     user_id: int | None = None
#     pet_id: int | None = None

# class PictureSchemaIn(BaseModel):
#     file_path: str

 
# # users
# class UserNewSettingsSchema(BaseModel):
#     user_name: str | None = None
#     phone_nr: str | None = None
#     first_name:str | None = None
#     last_name:str | None = None
#     email:EmailStr | None = None
#     adress:str | None = None

# class UserSchemaSlim(BaseModel):
#     user_name: str
#     password: str

# class UserOutSchema(BaseModel):
#     first_name:str
#     last_name:str
#     email:EmailStr
#     user_name: str
#     member_since: datetime
#     id: int

# class UserSchema(BaseModel):
#     # req fields
#     first_name: str = Field(..., min_length=1, max_length=50)
#     last_name: str = Field(..., min_length=1, max_length=50)
#     user_name: str = Field(..., min_length=1, max_length=50)
#     email: str = Field(..., min_length=1, max_length=50)
#     password: str = Field(..., min_length=1, max_length=1000)

#     # special fields
#     active: bool = True
#     adress: str | None = None
#     phone_nr : str | None = None
#     member_since : datetime = Field(..., description="Member since date and time in UTC timezone, format: YYYY-MM-DDTHH:MM:SSZ")

#     model_config = ConfigDict(from_attributes=True, json_schema_extra={
#         "example": {
#             "first_name": "Alan",
#             "last_name": "Grey",
#             "user_name": "Alonzo",
#             "active": True,
#             "password": "123",
#             "email" : "something@mail.com",
#             "member_since": "2022-01-01T00:00:00"      
#         }
#     })



# # pet
# class PetSchema(BaseModel):
#     animal: str = Field(..., min_length=1, max_length=50)
#     race: str = Field(..., min_length=1, max_length=50)
#     age: int = 0
#     name: str = Field(..., min_length=1, max_length=50)
#     text: str = Field(..., min_length=1, max_length=100)
#     user_id: int | None = None
#     gender: GenderEnum = Field(..., description="Gender of the pet")

#     # new entries
#     weight: str | None = None
#     listing_type: AddTypeEnum = Field(..., description="Type of listing")
#     spayed: bool | None = None
#     price: str | None = None

#     listing_description : str | None = None
#     listing_title: str | None = None


#     # model_config = ConfigDict(from_attributes=True, json_schema_extra={
#     #     "example": {
#     #         "animal": "Dog",
#     #         "race": "Pitbull",
#     #         "age": 5,
#     #         "name": "Rocky",
#     #         "text": "Pretty and virgin",
#     #         "gender": "Male",
#     #         "listing_type": "Mating",
#     #         "user_id": 23
#     #     }
#     # })

# class PetSchemaOut(BaseModel):
#     name: str
#     gender: str
#     age: int
#     race: str
    


# # post
# class PostSchema(BaseModel):
#     text: str = Field(..., min_length=1, max_length=50)
#     user_id: int | None = None
#     date: datetime = Field(..., description="Posted, format: YYYY-MM-DDTHH:MM:SSZ")

#     model_config = ConfigDict(from_attributes=True, json_schema_extra={
#         "example": {
#             "text": "Hello from textarea",
#             "date": "2024-01-01T00:00:00", 
#             "user_id": 1
#         }
#     })


# class MessageSchema(BaseModel):
#     text: str = Field(..., min_length=1, max_length=50)
#     sender_id: int | None = None
#     receiver_id: int | None = None

#     model_config = ConfigDict(from_attributes=True)



