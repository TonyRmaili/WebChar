"""The assistant (the footer's Assistant window), with or without a campaign.

Every request says which campaign it's for: a campaign's name, or "" for
none. What changes:

                      a campaign                          no campaign ("")
  notes search        its notes (app/rag)                 none
  instructions        its ticked prompts (the browser     yours, Settings → AI
                      sends them)                         (assistant.json)
  chat                <campaign>/assistant_chat.json      save_files/<user>/assistant_chat.json
  pictures it paints  <campaign>/note_images/             save_files/<user>/assistant_images/
  "save" a picture    into the campaign's Files           save_files/<user>/pictures/
  "save" an answer    as a note (campaigns.py save_response)   (copy it instead)

Pictures it paints get a random name the server picks; ones no chat (and,
in a campaign, no note) shows any more are tidied away after a day.

save_files/<user>/assistant.json holds the window's own settings:
    {"campaign": "Salt" or "" (none), "instructions": "…" (none = the default)}
"""

import json
import logging
import time
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app import ai_usage, notes
from app.database.models import User
from app.database.schemas import DMAssistantRequest
from app.file_handler import FileHandler
from app.open_ai_api import OpenAIApi
from app.routers.campaigns import (
    CHAT_FILE,
    FILES_DIR,
    NOTE_IMAGE_NAME,
    NOTE_IMAGES_DIR,
    ORPHAN_AGE,
    CurrentUser,
    _campaign_dir,
    _campaigns_root,
    _clean_name,
    _files_folder,
    _image_response,
    _note_image_name,
    _user_dir,
    _write_json,
    chat_images,
)

router = APIRouter(prefix="/assistant", tags=["assistant"])

log = logging.getLogger("uvicorn.error.assistant")

DEFAULT_INSTRUCTIONS = FileHandler().load_md("app/default_assistant_instructions.md")
SETTINGS_FILE = "assistant.json"
IMAGES_DIR = "assistant_images"  # pictures painted without a campaign, not saved yet
PICTURES_DIR = "pictures"  # pictures saved without a campaign
MAX_INSTRUCTIONS = 20_000


# ---------- where things go ----------

class Place:
    """Where a campaign's assistant things live, or the user's own ("")."""

    def __init__(self, user: User, campaign_name: str):
        self.campaign = None
        if campaign_name:
            self.campaign = _campaign_dir(user, campaign_name)
            self.chat = self.campaign / CHAT_FILE
            self.images = self.campaign / NOTE_IMAGES_DIR
        else:
            home = _user_dir(user)
            self.chat = home / CHAT_FILE
            self.images = home / IMAGES_DIR
            self.images.mkdir(parents=True, exist_ok=True)

    def image(self, file: str) -> Path:
        if not NOTE_IMAGE_NAME.match(file):
            raise HTTPException(status_code=400, detail="Invalid picture name")
        return self.images / file


def _tidy_own_images(user: User) -> None:
    """Pictures painted without a campaign that the chat doesn't show any
    more, older than a day (in a campaign, campaigns.py tidies note_images)."""
    home = _user_dir(user)
    used = chat_images(home)
    now = time.time()
    for path in (home / IMAGES_DIR).glob("*"):
        if path.is_file() and path.name not in used and now - path.stat().st_mtime > ORPHAN_AGE:
            path.unlink(missing_ok=True)


# ---------- the window's settings ----------

def _settings_path(user: User) -> Path:
    return _user_dir(user) / SETTINGS_FILE


def _load_settings(user: User) -> dict:
    try:
        data = json.loads(_settings_path(user).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    return data if isinstance(data, dict) else {}


def _save_settings(user: User, change: dict) -> dict:
    data = {**_load_settings(user), **change}
    _settings_path(user).parent.mkdir(parents=True, exist_ok=True)
    _write_json(_settings_path(user), data)
    return data


def _campaign_names(user: User) -> list[str]:
    return sorted((p.name for p in _campaigns_root(user).iterdir() if p.is_dir()), key=str.lower)


def _instructions(user: User) -> str:
    own = _load_settings(user).get("instructions")
    return own if isinstance(own, str) and own.strip() else DEFAULT_INSTRUCTIONS


@router.get("/settings")
def get_settings(current_user: CurrentUser):
    """The campaign it's on ("" = none), the campaigns to pick from, and the
    instructions it uses without a campaign. Never picked yet: the campaign
    last opened on the Campaigns page."""
    names = _campaign_names(current_user)
    data = _load_settings(current_user)
    campaign = data.get("campaign") if "campaign" in data else current_user.selected_campaign
    own = data.get("instructions")
    return {
        "campaign": campaign if campaign in names else "",  # a deleted campaign: none
        "campaigns": names,
        "instructions": _instructions(current_user),
        "own_instructions": isinstance(own, str) and bool(own.strip()),
    }


class CampaignPick(BaseModel):
    campaign: str = ""  # "" = no campaign


@router.put("/campaign")
def pick_campaign(payload: CampaignPick, current_user: CurrentUser):
    if payload.campaign:
        _campaign_dir(current_user, payload.campaign)  # it must be theirs
    _save_settings(current_user, {"campaign": payload.campaign})
    return {"campaign": payload.campaign}


class InstructionsRequest(BaseModel):
    instructions: str = Field(default="", max_length=MAX_INSTRUCTIONS)  # "" = back to the default


@router.put("/instructions")
def set_instructions(payload: InstructionsRequest, current_user: CurrentUser):
    own = payload.instructions.strip()
    _save_settings(current_user, {"instructions": own or None})
    return {"instructions": _instructions(current_user), "own_instructions": bool(own)}


# ---------- asking ----------
# With a campaign, each question searches its notes (app/rag) and sends the
# pieces that fit it, after the ticked prompts. The answer is streamed: the
# browser gets it piece by piece while the model writes, as lines of JSON
# ("NDJSON", one object a line):
#   {"type": "notes", "notes": "none"|"all"|"search"|"failed", "sources": [...],
#    "why": what went wrong when "failed"}                                        first
#   {"type": "text", "text": "…"}                                                many
#   {"type": "error", "message": "…"}                                            if it broke off
#   {"type": "done"}                                                             last
# Things that stop it before it starts (tokens used up…) are ordinary HTTP
# errors. main.py keeps compression off this route, so nothing is held back.

NOTES_PREFACE = (
    "\n\n# The DM's campaign notes\n"
    "The pieces below come from the DM's own notes for this campaign, picked for the latest question. "
    "Use them when they help and leave out any that don't fit. When you use one, say which note it is from."
)
QUESTION_TURNS = 3  # the last few questions together, so a follow-up keeps its topic
NO_SEARCH = {"mode": "none", "pieces": [], "sources": [], "spent": 0}


def _search_notes(user: User, campaign: Path, question: str, api: OpenAIApi) -> dict:
    try:
        from app.rag.index import find_notes  # here, so a missing lancedb only stops the search

        return find_notes(user.name, campaign.name, campaign / FILES_DIR, campaign.parent, question, api.embed)
    except Exception as e:  # the notes search must never stop the answer
        log.warning("notes search failed: %s", e)
        why = f"{type(e).__name__}: {e}"
        if isinstance(e, ImportError):
            why += " (is lancedb installed in the Python that runs the backend?)"
        return {**NO_SEARCH, "mode": "failed", "why": why}


@router.post("/ask")
def ask(payload: DMAssistantRequest, current_user: CurrentUser):
    # Only logged-in users may spend the OpenAI key, and only their own
    # campaign's notes are searched.
    place = Place(current_user, payload.campaign_name)
    messages = [m.model_dump() for m in payload.messages]
    question = "\n".join([m["content"] for m in messages if m["role"] == "user"][-QUESTION_TURNS:])

    ai_usage.check(current_user.name)  # today's tokens not used up yet
    api = OpenAIApi()
    if place.campaign:
        found = _search_notes(current_user, place.campaign, question, api)
        ai_usage.record(current_user.name, "search", found["spent"])
        instructions = payload.instructions + (NOTES_PREFACE if found["pieces"] else "")
        files_root = place.campaign / FILES_DIR
        sources = [{**s, "path": str(files_root / s["path"])} for s in found["sources"]]
    else:
        found, sources = NO_SEARCH, []
        instructions = _instructions(current_user)

    words = api.chat_log_stream(
        instructions=instructions,
        files=[(p["name"], p["text"]) for p in found["pieces"]],
        messages=messages,
    )
    user_name = current_user.name

    def lines():
        yield _line({"type": "notes", "notes": found["mode"], "sources": sources, "why": found.get("why", "")})
        try:
            for piece in words:
                yield _line({"type": "text", "text": piece})
        except Exception as e:  # the model or the network broke off
            log.warning("assistant answer broke off: %s", e)
            yield _line({"type": "error", "message": f"The answer broke off: {e}"})
        finally:
            # Also when stop was pressed (the browser hung up): what was
            # spent by then is known only if the model got to its end.
            ai_usage.record(user_name, "words", api.last_tokens)
        yield _line({"type": "done"})

    return StreamingResponse(lines(), media_type="application/x-ndjson", headers={"Cache-Control": "no-cache"})


def _line(event: dict) -> str:
    return json.dumps(event, ensure_ascii=False) + "\n"


# ---------- the chat ----------
# Kept on the server, so it is still there after going elsewhere, reloading,
# or on another computer. Two threads, like two tabs: "words" (the text
# assistant) and "pictures" (the painter), plus what's half typed in each
# box. Each campaign has its own chat, and so does "no campaign".

CHAT_KEEP = 300  # messages per thread


class ChatPicture(BaseModel):
    file: str
    prompt: str = Field(default="", max_length=4000)


class ChatSource(BaseModel):
    """A note an answer was found in (see ask)."""

    note: str
    path: str
    sections: list[str] = Field(default_factory=list)
    score: float | None = None  # how close in meaning; None when all notes were sent
    words: bool = False  # it also had the question's words


class StoredMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(default="", max_length=200_000)
    image: ChatPicture | None = None  # a picture made
    picture: bool = False  # the words a picture was asked with
    failed: bool = False  # it didn't work: the reason is the content
    edited: bool = False
    saved: bool = False  # saved into the Files (or your pictures) already
    sources: list[ChatSource] = Field(default_factory=list)  # the notes an answer read
    notes: str = ""  # "all" when every note was sent, "failed" when the search didn't work
    stopped: str = ""  # an answer cut short: why ("stopped", or what broke)
    search_error: str = ""  # why the notes search failed, when it did


class ChatState(BaseModel):
    campaign_name: str = ""
    words: list[StoredMessage] = Field(default_factory=list)
    pictures: list[StoredMessage] = Field(default_factory=list)
    drafts: dict[Literal["words", "pictures"], str] = Field(default_factory=dict)


@router.get("/chat")
def get_chat(current_user: CurrentUser, campaign_name: str = ""):
    place = Place(current_user, campaign_name)
    try:
        data = json.loads(place.chat.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    if not place.campaign:
        _tidy_own_images(current_user)
    return {"words": data.get("words", []), "pictures": data.get("pictures", []), "drafts": data.get("drafts", {})}


@router.put("/chat")
def save_chat(payload: ChatState, current_user: CurrentUser):
    place = Place(current_user, payload.campaign_name)
    for thread in (payload.words, payload.pictures):
        for m in thread:
            if m.image and not NOTE_IMAGE_NAME.match(m.image.file):
                m.image = None  # only names the server gave its own pictures
    data = {
        "words": [m.model_dump(exclude_defaults=True) for m in payload.words[-CHAT_KEEP:]],
        "pictures": [m.model_dump(exclude_defaults=True) for m in payload.pictures[-CHAT_KEEP:]],
        "drafts": {k: v[:20_000] for k, v in payload.drafts.items() if v},
    }
    _write_json(place.chat, data)
    return {"message": "Saved"}


# ---------- pictures ----------
# The Pictures tab (and "paint a picture here" in a note, with its
# campaign). The words go to the image model as they are
# (OpenAIApi.image_gen): no notes, no prompts, no chat.

class PaintRequest(BaseModel):
    campaign_name: str = ""
    prompt: str = Field(min_length=1, max_length=4000)


@router.post("/paint")
def paint(payload: PaintRequest, current_user: CurrentUser):
    place = Place(current_user, payload.campaign_name)
    name = _note_image_name(".png")
    path = place.images / name
    ai_usage.check(current_user.name)  # today's tokens not used up yet
    api = OpenAIApi()
    try:
        api.image_gen(prompt=payload.prompt.strip(), savepath=path)
    except Exception as e:  # refused prompt, no key, network…
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=502, detail=f"The picture couldn't be made: {e}")
    if notes.image_suffix(FileHandler().load_bytes(path)[:16]) is None:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=502, detail="The image model sent something that isn't a picture")
    ai_usage.record(current_user.name, "pictures", api.last_tokens)
    return {"file": name}


@router.get("/picture/{file}")
def get_picture(current_user: CurrentUser, file: str, campaign_name: str = ""):
    path = Place(current_user, campaign_name).image(file)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Picture not found")
    return _image_response(path)


class SavePictureRequest(BaseModel):
    campaign_name: str = ""
    file: str  # the painted picture's name
    file_name: str = ""  # stem; empty = "picture"
    folder_path: str = ""  # in a campaign's Files; empty = the top


@router.post("/save_picture")
def save_picture(payload: SavePictureRequest, current_user: CurrentUser):
    """A painted picture as a file of its own: into the campaign's Files, or
    without a campaign into save_files/<user>/pictures."""
    place = Place(current_user, payload.campaign_name)
    src = place.image(payload.file)
    if not src.is_file():
        raise HTTPException(status_code=404, detail="That picture is not there any more")
    if place.campaign:
        target = _files_folder(current_user, payload.campaign_name, payload.folder_path)
    else:
        target = _user_dir(current_user) / PICTURES_DIR
        target.mkdir(parents=True, exist_ok=True)
    stem = _clean_name(payload.file_name.strip()[:80] or "picture", "file name")
    dest = FileHandler().unique_destination(target / f"{stem}{src.suffix}")
    FileHandler().save_bytes(dest, FileHandler().load_bytes(src))
    return {"message": "Saved", "name": dest.name}
