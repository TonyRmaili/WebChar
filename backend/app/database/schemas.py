from pydantic import BaseModel


class SaveResponseRequest(BaseModel):
    campaign_name: str
    content: str
    file_name: str  # stem only, no extension
    folder_path: str = ""  # empty = campaign root

class CopyRequest(BaseModel):
    path: str

class MoveRequest(BaseModel):
    source_path: str
    target_folder: str  # must be a folder path

class RenameRequest(BaseModel):
    path: str
    new_name: str  # stem only, extension is preserved from original

class ChatMessage(BaseModel):
    role: str
    content: str

class DMAssistantRequest(BaseModel):
    messages: list[ChatMessage]
    instructions: str
    campaign_name: str
    active_files: list[str] = []


class UpdateFileRequest(BaseModel):
    path: str
    content: str

class CreateFileRequest(BaseModel):
    campaign_name: str
    file_name: str
    path: str

class DeleteFileRequest(BaseModel):
    file_name: str
    path: str

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

class ImportMinion(BaseModel):
    data: dict

class QuickClassPayload(BaseModel):
    prompt: str
    char_name: str