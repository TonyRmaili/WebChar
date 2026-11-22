"""Player characters: a database row (id, name, active) plus one JSON file.

    save_files/<user>/characters/<id>.json

The id is the database id and never changes, so the file, the minions
folder (minions/<id>/) and campaign exports all point at the id. The name
is plain data: renaming is an ordinary PATCH with {"name": ...}.

    POST   /character/preview          the wizard's picks -> what's open, numbers (nothing saved)
    POST   /character                  create (the Builder Wizard's payload), see below
    GET    /character/{id}             the whole character
    PATCH  /character/{id}             {"changes": {top-level key: new value, ...}}
    DELETE /character/{id}             row, file and minions folder
    POST   /character/{id}/active      show / hide it in Sheets

Play (app/builder/play.py; these used to be /combat/* in main.py):

    POST   /character/{id}/hp          {"delta": -7}  damage (< 0) or healing (> 0) -> {"state"}
    POST   /character/{id}/rest        {"kind": "short" | "long"}  -> the whole character
    POST   /character/rest             {"kind", "ids": [...]}  every listed character rests
    POST   /character/experience       {"delta", "ids": [...]}  XP for the listed characters only

Leveling (app/builder/level.py; the General tab):

    POST   /character/{id}/level/preview   {"class_id", "layers", "random", "hp"} -> the level-up form
    POST   /character/{id}/level           same body -> {"character", "open", "problems"} (saved)
    POST   /character/{id}/level/down      {"class_id"} -> the whole character (saved)

Swapping race or background (app/builder/origin.py; the Biography tab):

    POST   /character/{id}/origin/preview  {"kind", "layers", "random", "seed", "gear"} -> the swap form
    POST   /character/{id}/origin          same body -> {"character", "open", "problems"} (saved)

Creating (app/builder, claude/character-plan.md): the payload says what
the player picked; with "random" on, everything left open is filled
first. "destinations" says where it goes, any combination:

    {"character": true, "npc": false, "party": false, "campaign": "Saltmarsh"}

    character   saved to the player's characters, as before
    npc, party  a copy straight into that campaign's npcs/ or party/ folder;
                a name already there gets a number ("Thaldrin 2")

With character off, nothing is saved to the profile.
"""

import random
import shutil
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fictional_names import name_generator
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.builder.catalogue import Catalogue
from app.builder.character import make, preview, unique_name
from app.builder.level import apply_level, level_down, preview_level
from app.builder.origin import apply_swap, preview_swap
from app.builder.play import change_hp, grant_experience, rest
from app.character_files import (
    character_lock,
    character_path,
    edit_character,
    get_owned_character,
    minions_dir,
    read_character,
    write_character,
)
from app.database.models import Character, User
from app.db_setup import get_db
from app.routers.campaigns import EXPORT_FOLDERS, _campaign_dir, _clean_name, _write_json
from app.security import get_current_user

router = APIRouter(prefix="/character", tags=["characters"])

CurrentUser = Annotated[User, Depends(get_current_user)]

# Keys the server owns. A PATCH that sends them is ignored for that key.
SERVER_KEYS = {"id"}


class CharacterPatch(BaseModel):
    # Top-level keys of the character and their new values, e.g.
    # {"layers": [...], "state": {...}}. Each key is replaced whole.
    changes: dict


# ---------------- build ----------------

def _destinations(payload: dict) -> dict:
    d = payload.get("destinations") or {"character": True}
    out = {k: bool(d.get(k)) for k in ("character", "npc", "party")}
    if not any(out.values()):
        raise HTTPException(status_code=400, detail="Pick at least one place for the character: character, NPC or party")
    out["campaign"] = (d.get("campaign") or "").strip() or None
    if (out["npc"] or out["party"]) and not out["campaign"]:
        raise HTTPException(status_code=400, detail="Pick the campaign the NPC or party copy goes to")
    return out


@router.post("/preview")
def preview_char(payload: dict, current_user: CurrentUser):
    """For the wizard while picking: what's still open (with the choices
    to draw), problems, and the numbers so far. With "random" on it also
    shows what the randomizer would fill in (send "seed" to repeat it)."""
    seed = payload.get("seed")
    rng = random.Random(seed) if seed is not None else None
    return preview(payload, Catalogue(current_user.name), rng)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_char(payload: dict, current_user: CurrentUser, db: Session = Depends(get_db)):
    dest = _destinations(payload)
    char_name = str(payload.get("name") or "").strip() or name_generator.generate_name()
    payload["name"] = char_name

    # Check the campaign before building anything.
    campaign_path = _campaign_dir(current_user, dest["campaign"]) if dest["campaign"] and (dest["npc"] or dest["party"]) else None

    # The wizard sends the seed its random preview used, so what was shown is what's saved.
    seed = payload.get("seed")
    try:
        made = make(payload, Catalogue(current_user.name), random.Random(seed) if seed is not None else None)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Couldn't build the character: {e}")
    data = made["character"]
    data["name"] = char_name
    result = {"id": None, "name": char_name, "campaign": [], "open": len(made["open"]), "problems": made["problems"]}

    # The player's own character: the row comes first, so the file can be
    # named after its id. flush() gives the row its id without saving it
    # for good yet: if writing fails below, rollback() takes it back out.
    if dest["character"]:
        db_char = Character(user_id=current_user.id, name=char_name, file_path="", active=False)
        db.add(db_char)
        db.flush()
        path = character_path(current_user.name, db_char.id)
        try:
            write_character(path, {"id": db_char.id, **data})
        except Exception as e:
            db.rollback()
            path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f"Couldn't save the character: {e}")
        db_char.file_path = str(path)
        db.commit()
        result["id"] = db_char.id

    # Copies straight into the campaign (same shape as "export to campaign").
    for kind in ("npc", "party"):
        if not dest[kind]:
            continue
        folder = campaign_path / EXPORT_FOLDERS[kind]
        folder.mkdir(exist_ok=True)
        name = unique_name(folder, _clean_name(char_name, "character name"))
        copy = {**data, "name": name}
        copy["_export"] = {
            "source_character_id": result["id"],
            "source_character_name": char_name,
            "kind": kind,
            "from_builder": True,
            "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        dest_path = folder / f"{name}.json"
        _write_json(dest_path, copy)
        result["campaign"].append({"as": kind, "path": str(dest_path.relative_to(campaign_path)), "name": name})

    return result


# ---------------- play: HP, rests, XP ----------------
# Each change goes through edit_character, which reads the file, lets the
# rule change it and saves it, one request at a time per character.

class HpChange(BaseModel):
    delta: int


class RestRequest(BaseModel):
    kind: str = "short"


class PartyRest(BaseModel):
    kind: str = "short"
    ids: list[int]


class PartyExperience(BaseModel):
    delta: int
    ids: list[int]


@router.post("/rest")
def rest_party(body: PartyRest, current_user: CurrentUser, db: Session = Depends(get_db)):
    # Every id is checked first, so a wrong one rests nobody instead of half the party.
    chars = [get_owned_character(db, current_user, i) for i in body.ids]
    for char in chars:
        with edit_character(current_user.name, char.id) as data:
            rest(data, body.kind)
    return {"ok": True, "rested": [c.id for c in chars]}


@router.post("/experience")
def experience_party(body: PartyExperience, current_user: CurrentUser, db: Session = Depends(get_db)):
    chars = [get_owned_character(db, current_user, i) for i in body.ids]
    for char in chars:
        with edit_character(current_user.name, char.id) as data:
            grant_experience(data, body.delta)
    return {"ok": True, "given": [c.id for c in chars]}


@router.post("/{char_id}/hp")
def change_char_hp(char_id: int, body: HpChange, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, char_id)
    with edit_character(current_user.name, char.id) as data:
        change_hp(data, body.delta)
    return {"state": data["state"]}


@router.post("/{char_id}/rest")
def rest_char(char_id: int, body: RestRequest, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, char_id)
    with edit_character(current_user.name, char.id) as data:
        rest(data, body.kind)
    # The rested character, so the sheet can show it without asking again.
    return data


# ---------------- leveling ----------------

class LevelRequest(BaseModel):
    class_id: str
    layers: list[dict] = []
    random: bool = False
    hp: dict | None = None
    seed: int | None = None


class LevelDown(BaseModel):
    class_id: str


@router.post("/{char_id}/level/preview")
def preview_char_level(char_id: int, body: LevelRequest, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, char_id)
    data = read_character(character_path(current_user.name, char.id))
    rng = random.Random(body.seed) if body.seed is not None else None
    return preview_level(data, body.class_id, body.model_dump(), Catalogue(current_user.name), rng)


@router.post("/{char_id}/level")
def level_up_char(char_id: int, body: LevelRequest, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, char_id)
    cat = Catalogue(current_user.name)
    if not cat.get("classes", body.class_id):
        raise HTTPException(status_code=404, detail="That class isn't in your catalogue")
    rng = random.Random(body.seed) if body.seed is not None else None
    with edit_character(current_user.name, char.id) as data:
        out = apply_level(data, body.class_id, body.model_dump(), cat, rng)
        data.clear()
        data.update(out["character"])
    return {"character": data, "open": out["open"], "problems": out["problems"]}


@router.post("/{char_id}/level/down")
def level_down_char(char_id: int, body: LevelDown, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, char_id)
    with edit_character(current_user.name, char.id) as data:
        out = level_down(data, body.class_id, Catalogue(current_user.name))
        data.clear()
        data.update(out)
    return data


# ---------------- race / background swap ----------------

class SwapRequest(BaseModel):
    kind: str  # "race" | "background"
    layers: list[dict] = []
    random: bool = False
    seed: int | None = None
    gear: bool = False


def _check_kind(kind: str):
    if kind not in ("race", "background"):
        raise HTTPException(status_code=400, detail="kind must be 'race' or 'background'")


@router.post("/{char_id}/origin/preview")
def preview_char_origin(char_id: int, body: SwapRequest, current_user: CurrentUser, db: Session = Depends(get_db)):
    _check_kind(body.kind)
    char = get_owned_character(db, current_user, char_id)
    data = read_character(character_path(current_user.name, char.id))
    rng = random.Random(body.seed) if body.seed is not None else None
    return preview_swap(data, body.kind, body.model_dump(), Catalogue(current_user.name), rng)


@router.post("/{char_id}/origin")
def swap_char_origin(char_id: int, body: SwapRequest, current_user: CurrentUser, db: Session = Depends(get_db)):
    _check_kind(body.kind)
    char = get_owned_character(db, current_user, char_id)
    rng = random.Random(body.seed) if body.seed is not None else None
    with edit_character(current_user.name, char.id) as data:
        out = apply_swap(data, body.kind, body.model_dump(), Catalogue(current_user.name), rng)
        data.clear()
        data.update(out["character"])
    return {"character": data, "open": out["open"], "problems": out["problems"]}


# ---------------- read ----------------

@router.get("/{char_id}")
def get_char(char_id: int, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, char_id)
    return read_character(character_path(current_user.name, char.id))


# ---------------- change ----------------

@router.patch("/{char_id}")
def patch_char(char_id: int, body: CharacterPatch, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, char_id)
    changes = {k: v for k, v in body.changes.items() if k not in SERVER_KEYS}

    if "name" in changes:
        name = changes["name"].strip() if isinstance(changes["name"], str) else ""
        if not name:
            raise HTTPException(status_code=400, detail="A character needs a name")
        changes["name"] = name

    if not changes:
        return {"ok": True}

    with edit_character(current_user.name, char.id) as data:
        data.update(changes)

    # The name is also on the database row, for lists like /me.
    if "name" in changes and changes["name"] != char.name:
        char.name = changes["name"]
        db.commit()

    return {"ok": True}


# ---------------- delete ----------------

@router.delete("/{char_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_char(char_id: int, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, char_id)

    for picture in list(char.pictures):
        db.delete(picture)
    db.delete(char)
    db.commit()

    with character_lock(char_id):
        character_path(current_user.name, char_id).unlink(missing_ok=True)
    shutil.rmtree(minions_dir(current_user.name, char_id), ignore_errors=True)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------- show in Sheets ----------------

@router.post("/{char_id}/active")
def toggle_active_char(char_id: int, current_user: CurrentUser, db: Session = Depends(get_db)):
    char = get_owned_character(db, current_user, char_id)
    char.active = not char.active
    db.commit()
    return {"id": char.id, "active": char.active}
