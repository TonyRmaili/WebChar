from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
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
import re
import secrets
import shutil
import time
from pathlib import Path
from app import notes
from app.character_files import character_path, get_owned_character, read_character
from app.database.schemas import (
    CreateFileRequest,
    DeleteFileRequest,
    UpdateFileRequest,
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
#     _files/     the DM's own notes (<name>.json) and pictures, in their own folders
#     note_images/ pictures shown inside notes (random names; see "pictures")
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
NOTE_IMAGES_DIR = "note_images"
APP_FOLDERS = ("party", "npcs", "monsters", ENCOUNTERS_DIR, GROUPS_DIR, TEMPLATES_DIR, TABLES_DIR, NOTE_IMAGES_DIR)


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
def delete_campaign(current_user: CurrentUser, campaign_name: str, db: Session = Depends(get_db)):
    campaign_path = _campaign_dir(current_user, campaign_name)
    shutil.rmtree(campaign_path)

    # Forget it as the last opened campaign, so the page never asks for it again.
    user = db.get(User, current_user.id)
    if user is not None and user.selected_campaign == campaign_path.name:
        user.selected_campaign = None
        db.commit()

    return {"message": "Campaign deleted"}


@router.get("/data")
def get_campaign_data(current_user: CurrentUser, campaign_name: str):
    # The file tree starts at _files, so the DM sees their own notes only.
    campaign_path = _campaign_dir(current_user, campaign_name)
    _tidy_note_images(campaign_path)
    tree = _tree(campaign_path / FILES_DIR)
    return {"root": tree["path"], "children": tree["children"]}


@router.get("/prompts")
def get_campaign_prompts(current_user: CurrentUser, campaign_name: str):
    tree = _tree(_campaign_dir(current_user, campaign_name) / PROMPTS_DIR, prompts=True)
    return {"root": tree["path"], "children": tree["children"]}


# ---------- the file tree ----------
# _files holds notes (<name>.json, see app/notes.py) and pictures
# (<name>.png/.jpg/.gif/.webp); prompts holds plain-text .md files. The tree
# only says what is where ("kind"): a note is fetched when it is opened, and
# a picture is fetched as an image. Prompts are small and the assistant
# needs them all at hand, so their text comes along.
# GET /data and GET /prompts answer { root, children }: root is the folder
# itself, for "create / move to the top level".

NOTE_SUFFIX = ".json"
PROMPT_SUFFIX = ".md"


def _kind(path: Path, prompts: bool) -> str | None:
    suffix = path.suffix.lower()
    if prompts:
        return "prompt" if suffix == PROMPT_SUFFIX else None
    if suffix == NOTE_SUFFIX:
        return "note"
    if suffix in notes.IMAGE_SUFFIXES or suffix == ".jpeg":
        return "image"
    return None


def _tree(path: Path, prompts: bool = False) -> dict:
    children = []
    for child in sorted(path.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
        if child.is_dir():
            children.append(_tree(child, prompts))
            continue
        kind = _kind(child, prompts)
        if kind is None:
            continue  # anything else in the folder is not shown
        node = {"name": child.name, "type": "file", "kind": kind, "path": str(child)}
        if kind == "prompt":
            node["content"] = child.read_text(encoding="utf-8")
        children.append(node)
    return {"name": path.name, "type": "folder", "path": str(path), "children": children}


# ---------- search ----------
# The Files tree's search box: notes whose name or text holds the words
# (any case), pictures whose name does. Each match brings a short piece of
# the text around the first hit, so the DM sees why it matched.

SNIPPET_BEFORE = 40
SNIPPET_AFTER = 70


def _snippet(text: str, at: int, length: int) -> str:
    start = max(0, at - SNIPPET_BEFORE)
    end = min(len(text), at + length + SNIPPET_AFTER)
    piece = " ".join(text[start:end].split())
    return ("…" if start > 0 else "") + piece + ("…" if end < len(text) else "")


def _note_text(path: Path) -> str:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("text", "") if isinstance(data, dict) else ""
    except (OSError, json.JSONDecodeError):
        return ""


@router.get("/search")
def search_files(current_user: CurrentUser, campaign_name: str, q: str = Query(max_length=200)):
    needle = q.strip().lower()
    if not needle:
        return {"matches": []}
    matches = []
    for path in sorted((_campaign_dir(current_user, campaign_name) / FILES_DIR).rglob("*")):
        kind = _kind(path, prompts=False) if path.is_file() else None
        if kind is None:
            continue
        name = path.stem if kind == "note" else path.name
        text = _note_text(path) if kind == "note" else ""
        hit = text.lower().find(needle)
        if hit >= 0:
            matches.append({"path": str(path), "snippet": _snippet(text, hit, len(needle))})
        elif needle in name.lower():
            matches.append({"path": str(path), "snippet": ""})
    return {"matches": matches}


# ---------- files and folders ----------

def _create_base(current_user: User, payload: CreateFileRequest) -> Path:
    """Where to create: the folder the browser named, or the top of _files."""
    if payload.path:
        base_path, _ = _user_path(current_user, payload.path, allow_area_root=True)
        if not base_path.is_dir():
            raise HTTPException(status_code=400, detail="Target is not a folder")
        return base_path
    return _campaign_dir(current_user, payload.campaign_name) / FILES_DIR


def _in_prompts(area: Path) -> bool:
    return area.name == PROMPTS_DIR


@router.post("/create_file")
def create_file(payload: CreateFileRequest, current_user: CurrentUser):
    """A new empty note in _files, or a new empty prompt in prompts."""
    base_path = _create_base(current_user, payload)
    _, area = _user_path(current_user, str(base_path), allow_area_root=True)
    prompt = _in_prompts(area)
    name = _clean_name(payload.file_name, "file name")
    target_path = base_path / f"{name}{PROMPT_SUFFIX if prompt else NOTE_SUFFIX}"
    if target_path.exists():
        raise HTTPException(status_code=400, detail="File already exists")

    if prompt:
        target_path.write_text("", encoding="utf-8")
    else:
        _write_json(target_path, notes.note_file(notes.EMPTY_DOC))
    return {"message": "File created", "path": str(target_path), "name": target_path.name, "kind": "prompt" if prompt else "note"}


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


def _prompt_path(user: User, raw_path: str) -> Path:
    path, area = _user_path(user, raw_path)
    if not _in_prompts(area) or path.suffix != PROMPT_SUFFIX:
        raise HTTPException(status_code=400, detail="Not a prompt")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="That prompt is not there any more")
    return path


@router.get("/prompt")
def get_prompt(current_user: CurrentUser, path: str):
    return {"content": _prompt_path(current_user, path).read_text(encoding="utf-8")}


@router.put("/update_file")
def update_file(payload: UpdateFileRequest, current_user: CurrentUser):
    """Saves a prompt (plain text). Notes are saved with PUT /note."""
    file_path = _prompt_path(current_user, payload.path)
    file_path.write_text(payload.content, encoding="utf-8")
    return {"message": "File saved", "path": str(file_path)}


# ---------- notes ----------

class SaveNoteRequest(BaseModel):
    path: str
    doc: dict


def _note_path(user: User, raw_path: str) -> Path:
    path, area = _user_path(user, raw_path)
    if _in_prompts(area) or path.suffix != NOTE_SUFFIX:
        raise HTTPException(status_code=400, detail="Not a note")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="That note is not there any more")
    return path


def _read_note(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise HTTPException(status_code=500, detail="That note could not be read")
    if not isinstance(data, dict) or not isinstance(data.get("doc"), dict):
        raise HTTPException(status_code=500, detail="That note could not be read")
    return data


@router.get("/note")
def get_note(current_user: CurrentUser, path: str):
    data = _read_note(_note_path(current_user, path))
    return {"doc": data["doc"], "text": data.get("text", "")}


@router.put("/note")
def save_note(payload: SaveNoteRequest, current_user: CurrentUser):
    """The editor sends the document; the plain text is made here."""
    if payload.doc.get("type") != "doc":
        raise HTTPException(status_code=400, detail="Not a document")
    path = _note_path(current_user, payload.path)
    data = notes.note_file(payload.doc)
    _write_json(path, data)
    return {"message": "Saved", "path": str(path), "text": data["text"]}


# ---------- pictures ----------
# Two kinds, the same checks:
#   - pictures inside notes live in <campaign>/note_images/ under a random
#     name the server picks; the note's image only holds that name.
#   - picture files in the tree live in _files like notes, named by the DM.
# An upload is only kept if its first bytes say it is a PNG, JPEG, GIF or
# WebP (the file's name and the browser's "type" are easy to fake), and if
# it is at most 10 MB. SVG is not accepted: it can carry scripts.

NOTE_IMAGE_NAME = re.compile(r"^[0-9a-f]{32}\.(png|jpg|gif|webp)$")
ORPHAN_AGE = 24 * 60 * 60  # seconds


def _note_image_name(suffix: str) -> str:
    """A random name nobody can guess or choose: 32 hex letters + suffix."""
    return f"{secrets.token_hex(16)}{suffix}"


def _files_folder(user: User, campaign_name: str, folder: str) -> Path:
    """A folder of the campaign's Files ("" = the top), checked."""
    files_root = _campaign_dir(user, campaign_name) / FILES_DIR
    if not folder:
        return files_root
    target, area = _user_path(user, folder, allow_area_root=True)
    if area != files_root or not target.is_dir():
        raise HTTPException(status_code=400, detail="Target folder not found")
    return target


async def _read_image(upload: UploadFile) -> tuple[bytes, str]:
    data = await upload.read(notes.MAX_IMAGE_BYTES + 1)
    if len(data) > notes.MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Pictures can be at most 10 MB")
    suffix = notes.image_suffix(data)
    if suffix is None:
        raise HTTPException(status_code=400, detail="That file is not a PNG, JPEG, GIF or WebP picture")
    return data, suffix


def _image_response(path: Path) -> FileResponse:
    suffix = ".jpg" if path.suffix.lower() == ".jpeg" else path.suffix.lower()
    return FileResponse(
        path,
        media_type=notes.MEDIA_TYPES[suffix],
        # nosniff: the browser must treat it as the picture type we say, never guess "page".
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"},
    )


@router.post("/note_images")
async def upload_note_image(current_user: CurrentUser, campaign_name: Annotated[str, Form()], file: UploadFile):
    folder = _campaign_dir(current_user, campaign_name) / NOTE_IMAGES_DIR
    data, suffix = await _read_image(file)
    name = _note_image_name(suffix)
    FileHandler().save_bytes(folder / name, data)
    return {"file": name}


@router.get("/note_images/{file}")
def get_note_image(current_user: CurrentUser, campaign_name: str, file: str):
    if not NOTE_IMAGE_NAME.match(file):
        raise HTTPException(status_code=400, detail="Invalid picture name")
    path = _campaign_dir(current_user, campaign_name) / NOTE_IMAGES_DIR / file
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Picture not found")
    return _image_response(path)


def _tidy_note_images(campaign_path: Path) -> None:
    """Delete note pictures no note and no assistant chat shows any more.
    Only ones older than a day: a picture removed a minute ago may come back
    with undo."""
    folder = campaign_path / NOTE_IMAGES_DIR
    files = list(folder.glob("*"))
    if not files:
        return
    used: set[str] = chat_images(campaign_path)
    for note in (campaign_path / FILES_DIR).rglob(f"*{NOTE_SUFFIX}"):
        try:
            used |= notes.images_in(json.loads(note.read_text(encoding="utf-8")).get("doc"))
        except (OSError, json.JSONDecodeError, AttributeError):
            return  # a note we can't read might use any of them: keep all
    now = time.time()
    for path in files:
        if path.is_file() and path.name not in used and now - path.stat().st_mtime > ORPHAN_AGE:
            path.unlink(missing_ok=True)


@router.post("/image_file")
async def upload_image_file(
    current_user: CurrentUser,
    campaign_name: Annotated[str, Form()],
    file: UploadFile,
    folder: Annotated[str, Form()] = "",
):
    """A picture as a file of its own in the tree, named after the upload."""
    target = _files_folder(current_user, campaign_name, folder)
    data, suffix = await _read_image(file)
    stem = Path(file.filename or "").stem.strip()
    if not stem or stem in (".", "..") or any(c in BAD_NAME_CHARS for c in stem):
        stem = "picture"
    dest = FileHandler().unique_destination(target / f"{stem[:80]}{suffix}")
    FileHandler().save_bytes(dest, data)
    return {"message": "Uploaded", "path": str(dest), "name": dest.name, "kind": "image"}


@router.get("/image_file")
def get_image_file(current_user: CurrentUser, path: str):
    file_path, area = _user_path(current_user, path)
    if _in_prompts(area) or _kind(file_path, prompts=False) != "image" or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Picture not found")
    return _image_response(file_path)


# ---------- assistant chat pictures ----------
# The assistant (routers/assistant.py) keeps a campaign's chat in
# <campaign>/assistant_chat.json, and the pictures it paints in note_images.
# The tidy-up above keeps the ones the chat still shows.

CHAT_FILE = "assistant_chat.json"


def chat_images(folder: Path) -> set[str]:
    """The pictures the assistant chat kept in `folder` shows."""
    try:
        data = json.loads((folder / CHAT_FILE).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()
    return {
        m["image"]["file"]
        for thread in ("words", "pictures")
        for m in data.get(thread, [])
        if isinstance(m, dict) and isinstance(m.get("image"), dict) and m["image"].get("file")
    }


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
    # A copied note shows the same pictures; they stay while any note uses them.
    src, _ = _user_path(current_user, payload.path)
    if not src.is_file():
        raise HTTPException(status_code=400, detail="Only files can be copied")

    dest = FileHandler().unique_destination(src.parent / src.name)
    shutil.copy2(src, dest)
    return {"message": "Copied", "path": str(dest), "name": dest.name}


@router.post("/save_response")
def save_response(payload: SaveResponseRequest, current_user: CurrentUser):
    """An assistant answer (Markdown) saved as a note."""
    file_handler = FileHandler()
    target_folder = _files_folder(current_user, payload.campaign_name, payload.folder_path)

    name = payload.file_name.strip() or file_handler.slugify_response(payload.content)
    name = _clean_name(name, "file name")

    dest = file_handler.unique_destination(target_folder / f"{name}{NOTE_SUFFIX}")
    _write_json(dest, notes.note_file(notes.markdown_to_doc(payload.content)))
    return {"message": "Saved", "path": str(dest), "name": dest.name}


# ---------- party and NPCs ----------
# Contract: claude/campaign-export-contract.md. The browser only says WHICH
# character (by its database id); the server copies the real file from
# disk. Inside the campaign the copy is named after the character
# ("Thorin.json"), since the DM works with names there.

class ExportCharacterRequest(BaseModel):
    campaign_name: str
    character_id: int
    # Still sent by the browser, but the name is read from the file.
    character_name: str | None = None
    # "as" is a reserved word in Python, so the field is called kind and
    # reads the "as" key from the JSON. Anything but party/npc → 422.
    kind: Literal["party", "npc"] = Field(alias="as")
    overwrite: bool = False


EXPORT_FOLDERS = {"party": "party", "npc": "npcs"}


@router.post("/export_character")
def export_character(payload: ExportCharacterRequest, current_user: CurrentUser, db: Session = Depends(get_db)):
    campaign_path = _campaign_dir(current_user, payload.campaign_name)
    char = get_owned_character(db, current_user, payload.character_id)
    data = read_character(character_path(current_user.name, char.id))

    name = _clean_name(str(data.get("name") or char.name), "character name")
    dest = campaign_path / EXPORT_FOLDERS[payload.kind] / f"{name}.json"
    if dest.exists() and not payload.overwrite:
        raise HTTPException(status_code=409, detail="A copy of this character is already there")

    # The copy is its own thing now: it keeps where it came from in
    # _export, not the player's id at the top (which belongs to the sheet).
    data.pop("id", None)
    data["_export"] = {
        "source_character_id": char.id,
        "source_character_name": name,
        "kind": payload.kind,
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    dest.parent.mkdir(exist_ok=True)
    _write_json(dest, data)

    return {
        "path": str(dest.relative_to(campaign_path)),
        "name": name,
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