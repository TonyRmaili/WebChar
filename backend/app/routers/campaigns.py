from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.database.models import User
from app.security import get_current_user
from app.file_handler import FileHandler
from typing import Annotated, Literal
from sqlalchemy.orm import Session
from app.db_setup import get_db
from datetime import datetime, timezone
import json
import os
import shutil
from pathlib import Path
from app.open_ai_api import OpenAIApi
from app.database.schemas import (
    CreateFileRequest,
    DeleteFileRequest,
    UpdateFileRequest,
    DMAssistantRequest,
    RenameRequest,
    MoveRequest,
    CopyRequest,
    SaveResponseRequest,
)


SAVEFILES_PATH = "./app/database/save_files/"

DEFAULT_PROMPT_TEXT = FileHandler().load_md("app/default_campaign_instructions.md")

router = APIRouter(prefix="/campaign", tags=["campaign"])

CurrentUser = Annotated[User, Depends(get_current_user)]

BAD_NAME_CHARS = set('\\/:*?"<>|')


# ---------- campaign layout ----------
# A campaign folder looks like this:
#
#   <campaign>/
#     _files/     the DM's own notes: whatever files and folders they make
#     prompts/    assistant prompts (default.md is created for you)
#     party/      copies of player characters  (the app writes these)
#     npcs/       NPCs                         (the app writes these)
#     monsters/   the monster shelf: catalogue monsters kept ready (the app writes these)
#     encounters/ one file per encounter (routers/encounters.py)
#     groups/     saved packs of creatures (routers/groups.py)
#     templates/  this campaign's templates (routers/templates.py)
#     tables/     this campaign's tables to roll on (routers/tables.py)
#
# The DM can only create, rename, move or delete things inside _files and
# prompts ("user areas"). Everything else belongs to the app, so a DM folder
# called "npcs" lives at _files/npcs and never clashes with the real one.

FILES_DIR = "_files"
PROMPTS_DIR = "prompts"
USER_AREAS = (FILES_DIR, PROMPTS_DIR)
ENCOUNTERS_DIR = "encounters"
GROUPS_DIR = "groups"
TEMPLATES_DIR = "templates"  # also save_files/<user>/templates for "all campaigns"
TABLES_DIR = "tables"  # also save_files/<user>/tables for "all campaigns"
APP_FOLDERS = ("party", "npcs", "monsters", ENCOUNTERS_DIR, GROUPS_DIR, TEMPLATES_DIR, TABLES_DIR)


def _ensure_layout(campaign_path: Path) -> None:
    """Create any missing standard folders. Safe to call on every request."""
    files_path = campaign_path / FILES_DIR
    if not files_path.exists():
        files_path.mkdir(parents=True)
        # Campaigns made before _files existed kept the DM's notes at the top
        # level. Move them in once, so they show up in the tree again.
        for child in campaign_path.iterdir():
            if child.name not in (FILES_DIR, PROMPTS_DIR):
                shutil.move(str(child), str(files_path / child.name))

    prompts_path = campaign_path / PROMPTS_DIR
    if not prompts_path.exists():
        prompts_path.mkdir()
        (prompts_path / "default.md").write_text(DEFAULT_PROMPT_TEXT, encoding="utf-8")

    for name in APP_FOLDERS:
        (campaign_path / name).mkdir(exist_ok=True)


# ---------- path safety ----------
# Every path the browser sends must end up inside THIS user's campaigns,
# and inside a user area. Without these checks a request could use "../"
# (or a full path) to read, overwrite or delete files anywhere on the server.

def _user_dir(user: User) -> Path:
    """save_files/<user> — the folder holding characters, campaigns, minions…"""
    return (Path(SAVEFILES_PATH) / user.name).resolve()


def _campaigns_root(user: User) -> Path:
    root = _user_dir(user) / "campaigns"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _character_file(user: User, char_name: str) -> Path:
    """save_files/<user>/characters/<name>.json — the player's real sheet."""
    path = _user_dir(user) / "characters" / f"{_clean_name(char_name, 'character name')}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Character not found")
    return path


def _clean_name(name: str, what: str = "name") -> str:
    """A single file/folder name: no slashes, no '..', not empty."""
    name = (name or "").strip()
    if not name or name in (".", "..") or any(c in BAD_NAME_CHARS for c in name):
        raise HTTPException(status_code=400, detail=f"Invalid {what}")
    return name


def _campaign_dir(user: User, campaign_name: str, must_exist: bool = True) -> Path:
    path = _campaigns_root(user) / _clean_name(campaign_name, "campaign name")
    if must_exist:
        if not path.is_dir():
            raise HTTPException(status_code=404, detail="Campaign not found")
        _ensure_layout(path)
    return path


def _user_path(user: User, raw_path: str, allow_area_root: bool = False) -> tuple[Path, Path]:
    """Check a path sent by the browser.

    Returns (path, area_root), where area_root is the _files or prompts
    folder it sits in. Refuses anything outside a user area. The area root
    itself is only allowed when allow_area_root=True (e.g. "create a file
    at the top level"), so _files and prompts can't be renamed or deleted."""
    root = _campaigns_root(user)
    path = Path(raw_path).resolve()
    try:
        parts = path.relative_to(root).parts  # ("Saltmarsh", "_files", "notes.md")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    if len(parts) < 2 or parts[1] not in USER_AREAS:
        raise HTTPException(status_code=400, detail="Invalid path")
    if len(parts) == 2 and not allow_area_root:
        raise HTTPException(status_code=400, detail="Invalid path")

    return path, root / parts[0] / parts[1]


# ---------- campaigns ----------

@router.get("")
def get_campaigns(current_user: CurrentUser):
    # Only folders are campaigns; a new user simply has none yet.
    root = _campaigns_root(current_user)
    return sorted(p.name for p in root.iterdir() if p.is_dir())


@router.post("")
def create_campaign(current_user: CurrentUser, campaign_name: str):
    campaign_path = _campaign_dir(current_user, campaign_name, must_exist=False)
    campaign_path.mkdir(parents=True, exist_ok=True)
    _ensure_layout(campaign_path)
    return {"message": "Campaign created", "campaign_name": campaign_path.name}


@router.put("")
def select_campaign(
    current_user: CurrentUser,
    campaign_name: str,
    db: Session = Depends(get_db),
):
    campaign_path = _campaign_dir(current_user, campaign_name)
    try:
        current_user.selected_campaign = campaign_path.name
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
        return {
            "message": "Selected campaign updated",
            "selected_campaign": current_user.selected_campaign,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("")
def delete_campaign(current_user: CurrentUser, campaign_name: str):
    campaign_path = _campaign_dir(current_user, campaign_name)
    shutil.rmtree(campaign_path)
    return {"message": "Campaign deleted"}


@router.get("/data")
def get_campaign_data(current_user: CurrentUser, campaign_name: str):
    # The file tree starts at _files, so the DM sees their own notes only.
    files_path = _campaign_dir(current_user, campaign_name) / FILES_DIR
    data = FileHandler().build_dir_tree(files_path)
    return data.get("children", [])


@router.get("/prompts")
def get_campaign_prompts(current_user: CurrentUser, campaign_name: str):
    prompts_path = _campaign_dir(current_user, campaign_name) / PROMPTS_DIR
    data = FileHandler().build_dir_tree(prompts_path)
    return data.get("children", [])


# ---------- files and folders ----------

def _create_base(current_user: User, payload: CreateFileRequest) -> Path:
    """Where to create: the folder the browser named, or the top of _files."""
    if payload.path:
        base_path, _ = _user_path(current_user, payload.path, allow_area_root=True)
        if not base_path.is_dir():
            raise HTTPException(status_code=400, detail="Target is not a folder")
        return base_path
    return _campaign_dir(current_user, payload.campaign_name) / FILES_DIR


@router.post("/create_file")
def create_file(payload: CreateFileRequest, current_user: CurrentUser):
    base_path = _create_base(current_user, payload)
    target_path = base_path / f"{_clean_name(payload.file_name, 'file name')}.md"
    if target_path.exists():
        raise HTTPException(status_code=400, detail="File already exists")

    target_path.touch()
    return {"message": "File created", "path": str(target_path)}


@router.post("/create_folder")
def create_folder(payload: CreateFileRequest, current_user: CurrentUser):
    base_path = _create_base(current_user, payload)
    folder_path = base_path / _clean_name(payload.file_name, "folder name")
    folder_path.mkdir(exist_ok=True)
    return {"message": "Folder created", "path": str(folder_path)}


@router.delete("/delete_file")
def delete_file(payload: DeleteFileRequest, current_user: CurrentUser):
    path, _ = _user_path(current_user, payload.path)

    if path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)
    else:
        raise HTTPException(status_code=404, detail="Path not found")
    return {"message": "Deleted", "path": str(path)}


@router.put("/update_file")
def update_file(payload: UpdateFileRequest, current_user: CurrentUser):
    file_path, _ = _user_path(current_user, payload.path)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    file_path.write_text(payload.content, encoding="utf-8")
    return {"message": "File saved", "path": str(file_path)}


# ---------- assistant ----------

@router.post("/dm_assistant")
def handle_dm_assistant(payload: DMAssistantRequest, current_user: CurrentUser):
    # Only logged-in users may spend the OpenAI key, and only files from
    # their own campaigns may be sent along with the chat.
    files = [str(_user_path(current_user, p)[0]) for p in (payload.active_files or [])]
    messages = [m.model_dump() for m in payload.messages]

    return OpenAIApi().chat_log(
        instructions=payload.instructions,
        files=files,
        messages=messages,
    )


# ---------- rename / move / copy / save ----------

@router.put("/rename")
def rename_node(payload: RenameRequest, current_user: CurrentUser):
    src, _ = _user_path(current_user, payload.path)
    if not src.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    new_name = _clean_name(payload.new_name, "name")
    dest = src.parent / (f"{new_name}{src.suffix}" if src.is_file() else new_name)
    if dest.exists():
        raise HTTPException(status_code=400, detail="A file with that name already exists")

    src.rename(dest)
    return {"message": "Renamed", "path": str(dest), "name": dest.name}


@router.put("/move")
def move_node(payload: MoveRequest, current_user: CurrentUser):
    src, src_area = _user_path(current_user, payload.source_path)
    target_folder, target_area = _user_path(current_user, payload.target_folder, allow_area_root=True)

    if not src.exists():
        raise HTTPException(status_code=404, detail="Source not found")
    if not target_folder.is_dir():
        raise HTTPException(status_code=400, detail="Target is not a folder")

    # Same campaign, same area: no moving notes into prompts or across campaigns.
    if src_area != target_area:
        raise HTTPException(status_code=400, detail="Cannot move between prompts and campaign files")

    # Prevent moving a folder into itself or a descendant
    if src.is_dir() and (target_folder == src or src in target_folder.parents):
        raise HTTPException(status_code=400, detail="Cannot move a folder into itself")

    if src.parent == target_folder:
        return {"message": "Already in target folder", "path": str(src)}

    dest = FileHandler().unique_destination(target_folder / src.name)
    shutil.move(str(src), str(dest))
    return {"message": "Moved", "path": str(dest), "name": dest.name}


@router.post("/copy")
def copy_node(payload: CopyRequest, current_user: CurrentUser):
    src, _ = _user_path(current_user, payload.path)
    if not src.is_file():
        raise HTTPException(status_code=400, detail="Only files can be copied")

    dest = FileHandler().unique_destination(src.parent / src.name)
    shutil.copy2(src, dest)
    return {"message": "Copied", "path": str(dest), "name": dest.name}


@router.post("/save_response")
def save_response(payload: SaveResponseRequest, current_user: CurrentUser):
    file_handler = FileHandler()
    files_root = _campaign_dir(current_user, payload.campaign_name) / FILES_DIR

    if payload.folder_path:
        target_folder, area = _user_path(current_user, payload.folder_path, allow_area_root=True)
        if area != files_root or not target_folder.is_dir():
            raise HTTPException(status_code=400, detail="Target folder not found")
    else:
        target_folder = files_root

    name = payload.file_name.strip() or file_handler.slugify_response(payload.content)
    name = _clean_name(name, "file name")

    dest = file_handler.unique_destination(target_folder / f"{name}.md")
    dest.write_text(payload.content, encoding="utf-8")
    return {"message": "Saved", "path": str(dest), "name": dest.name}


# ---------- party and NPCs ----------
# Contract: claude/campaign-export-contract.md. The browser only says WHICH
# character; the server copies the real file from disk.

class ExportCharacterRequest(BaseModel):
    campaign_name: str
    character_id: int | None = None
    character_name: str
    # "as" is a reserved word in Python, so the field is called kind and
    # reads the "as" key from the JSON. Anything but party/npc → 422.
    kind: Literal["party", "npc"] = Field(alias="as")
    overwrite: bool = False


EXPORT_FOLDERS = {"party": "party", "npc": "npcs"}


@router.post("/export_character")
def export_character(payload: ExportCharacterRequest, current_user: CurrentUser):
    campaign_path = _campaign_dir(current_user, payload.campaign_name)
    source = _character_file(current_user, payload.character_name)

    try:
        data = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise HTTPException(status_code=500, detail="The character file could not be read")
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="The character file is not a character")

    dest = campaign_path / EXPORT_FOLDERS[payload.kind] / source.name
    if dest.exists() and not payload.overwrite:
        raise HTTPException(status_code=409, detail="A copy of this character is already there")

    data["_export"] = {
        "source_character_id": payload.character_id,
        "source_character_name": payload.character_name,
        "kind": payload.kind,
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    # Write to a temp file first, then swap it in, so a crash never leaves
    # a half-written copy behind (same trick as the minions router).
    dest.parent.mkdir(exist_ok=True)
    tmp = dest.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=4, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, dest)

    return {
        "path": str(dest.relative_to(campaign_path)),
        "name": payload.character_name,
        "as": payload.kind,
    }


# ---------- campaign copies: list / save / copy / remove ----------
# The same endpoints serve every kind of copy: characters in the party,
# characters kept as NPCs, and monsters added from the catalogue.

CampaignKind = Literal["party", "npc", "monster"]
KIND_FOLDERS = {"party": "party", "npc": "npcs", "monster": "monsters"}


def _write_json(path: Path, data: dict) -> None:
    """Temp file first, then swap it in, so a crash never leaves half a file."""
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=4, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def _copy_file(user: User, campaign_name: str, kind: str, file: str) -> Path:
    """One copy in a campaign, e.g. <campaign>/npcs/Thorin.json."""
    name = _clean_name(file, "file name")
    if not name.endswith(".json"):
        raise HTTPException(status_code=400, detail="Invalid file name")
    return _campaign_dir(user, campaign_name) / KIND_FOLDERS[kind] / name


@router.get("/characters")
def list_campaign_characters(current_user: CurrentUser, campaign_name: str, kind: CampaignKind):
    folder = _campaign_dir(current_user, campaign_name) / KIND_FOLDERS[kind]
    out = []
    for path in sorted(folder.glob("*.json"), key=lambda p: p.name.lower()):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue  # a broken file is skipped rather than failing the whole list
        if isinstance(data, dict):
            out.append({"file": path.name, "data": data})
    return out


class SaveCampaignCharacterRequest(BaseModel):
    campaign_name: str
    kind: CampaignKind
    file: str
    data: dict


@router.put("/characters")
def save_campaign_character(payload: SaveCampaignCharacterRequest, current_user: CurrentUser):
    path = _copy_file(current_user, payload.campaign_name, payload.kind, payload.file)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="That copy is not in the campaign any more")

    _write_json(path, payload.data)
    return {"file": path.name}


@router.delete("/characters")
def remove_campaign_character(current_user: CurrentUser, campaign_name: str, kind: CampaignKind, file: str):
    path = _copy_file(current_user, campaign_name, kind, file)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="That copy is not in the campaign any more")
    path.unlink()
    return {"file": path.name, "encounters": _drop_from_encounters(path.parents[1], kind, path.name)}


def _drop_from_encounters(campaign: Path, kind: str, file: str) -> int:
    """Encounters point at party members and NPCs; when one leaves the
    campaign, take them out of every encounter too. Returns how many changed."""
    changed = 0
    for enc_path in (campaign / ENCOUNTERS_DIR).glob("*.json"):
        try:
            data = json.loads(enc_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        members = data.get("members") or []
        kept = [m for m in members if not (m.get("kind") == kind and m.get("file") == file)]
        if len(kept) != len(members):
            _write_json(enc_path, {**data, "members": kept})
            changed += 1
    return changed


class CopyCampaignCharacterRequest(BaseModel):
    campaign_name: str
    kind: CampaignKind
    file: str


@router.post("/characters/copy")
def copy_campaign_character(payload: CopyCampaignCharacterRequest, current_user: CurrentUser):
    """A second copy next to the first: "Thorin (copy).json", named
    "Thorin (copy)" inside, so several of the same NPC or monster can be kept."""
    src = _copy_file(current_user, payload.campaign_name, payload.kind, payload.file)
    if not src.is_file():
        raise HTTPException(status_code=404, detail="That copy is not in the campaign any more")
    try:
        data = json.loads(src.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise HTTPException(status_code=500, detail="That copy could not be read")
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="That copy could not be read")

    name = f"{data.get('name') or src.stem} (copy)"
    dest = FileHandler().unique_destination(src.parent / f"{_clean_name(name, 'name')}.json")
    data["name"] = dest.stem

    _write_json(dest, data)
    return {"file": dest.name, "data": data}


# ---------- monsters from the catalogue ----------
# The browser already holds the catalogue entry (official or homebrew) and
# sends it, ready to use (ids on its rows, current HP…), like minions do.
# Each one becomes its own file in <campaign>/monsters/, so "add 3 goblins"
# gives Goblin.json plus two more with unique names.

class AddCampaignMonstersRequest(BaseModel):
    campaign_name: str
    monster: dict
    count: int = Field(default=1, ge=1, le=20)


@router.post("/monsters")
def add_campaign_monsters(payload: AddCampaignMonstersRequest, current_user: CurrentUser):
    folder = _campaign_dir(current_user, payload.campaign_name) / KIND_FOLDERS["monster"]
    folder.mkdir(exist_ok=True)

    raw_name = payload.monster.get("name")
    if not isinstance(raw_name, str) or not raw_name.strip():
        raise HTTPException(status_code=400, detail="A monster needs a name")
    base_name = _clean_name(raw_name, "monster name")
    added_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    out = []
    for _ in range(payload.count):
        dest = FileHandler().unique_destination(folder / f"{base_name}.json")
        data = {**payload.monster, "name": dest.stem, "_added": {"added_at": added_at}}
        _write_json(dest, data)
        out.append({"file": dest.name, "data": data})
    return out