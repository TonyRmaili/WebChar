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

class CharacterIn(BaseModel):
    name : str
  
class QueryRequest(BaseModel):
    question: str

class DictData(BaseModel):
    form_data : dict

class HealthData(BaseModel):
    value : int
    name : str

class TakeRestData(BaseModel):
    rest_type: str
    name : str

class TakeRestAllData(BaseModel):
    rest_type: str
    characters : list

class GrantExperienceAll(BaseModel):
    delta : int

class MinionEffects(BaseModel):
    minion_effects: list
    target_ac: int
    target_save_mod: int
    target_roll_type: str
    minions_roll_type: str

