from typing import Literal

from pydantic import BaseModel, ConfigDict


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


# ---------- what the server sends back about a user ----------
# /me and /create_account answer with these, so the password hash (and
# anything else on the database row) never leaves the server.
# from_attributes=True lets Pydantic read them straight off the
# SQLAlchemy objects.

class CharacterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    active: bool

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    selected_campaign: str | None = None
    characters: list[CharacterOut] = []


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


# ---------- combat (characters are found by their database id) ----------

class HealthData(BaseModel):
    value: int
    char_id: int

class TakeRestData(BaseModel):
    rest_type: Literal["short", "long"]
    char_id: int

class TakeRestAllData(BaseModel):
    rest_type: Literal["short", "long"]
    char_ids: list[int]

class GrantExperienceAll(BaseModel):
    delta: int


class MinionEffects(BaseModel):
    minion_effects: list
    target_ac: int
    target_save_mod: int
    target_roll_type: str
    minions_roll_type: str

class ImportMinion(BaseModel):
    data: dict