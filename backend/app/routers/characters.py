"""Player characters: a database row (id, name, active) plus one JSON file.

    save_files/<user>/characters/<id>.json

The id is the database id and never changes, so the file, the minions
folder (minions/<id>/) and campaign exports all point at the id. The name
is plain data: renaming is an ordinary PATCH with {"name": ...}.

    POST   /character                  create (the Builder Wizard's payload)
    GET    /character/{id}             the whole character
    PATCH  /character/{id}             {"changes": {top-level key: new value, ...}}
    DELETE /character/{id}             row, file and minions folder
    POST   /character/{id}/active      show / hide it in Sheets
"""

import shutil
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fictional_names import name_generator
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.character_adjuster import CharacterAdjuster
from app.character_files import (
    SAVEFILES_PATH,
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
from app.security import get_current_user

router = APIRouter(prefix="/character", tags=["characters"])

CurrentUser = Annotated[User, Depends(get_current_user)]

# Keys the server owns. A PATCH that sends them is ignored for that key.
SERVER_KEYS = {"id"}


class CharacterPatch(BaseModel):
    # Top-level keys of the character and their new values, e.g.
    # {"effects": [...], "health": {...}}. Each key is replaced whole.
    changes: dict


# ---------------- create ----------------

@router.post("", status_code=status.HTTP_201_CREATED)
def create_char(payload: dict, current_user: CurrentUser, db: Session = Depends(get_db)):
    char_name = str(payload.get("name") or "").strip() or name_generator.generate_name()
    payload["name"] = char_name

    # The row comes first, so the file can be named after its id. flush()
    # gives the row its id without saving it for good yet: if building the
    # character fails below, rollback() takes the row back out.
    db_char = Character(user_id=current_user.id, name=char_name, file_path="", active=False)
    db.add(db_char)
    db.flush()

    path = character_path(current_user.name, db_char.id)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        adjuster = CharacterAdjuster(
            payload=payload,
            user_name=current_user.name,
            char_name=char_name,
            save_path=SAVEFILES_PATH,
        )
        # The adjuster names the file after the character. Point it at the
        # id instead (save_json adds the ".json" itself).
        adjuster.save_path = str(path.with_suffix(""))
        adjuster.run()

        # Stamp the id into the file, so the sheet always knows it.
        data = read_character(path)
        data["id"] = db_char.id
        data["name"] = char_name
        write_character(path, data)
    except Exception as e:
        db.rollback()
        path.unlink(missing_ok=True)
        detail = e.detail if isinstance(e, HTTPException) else str(e)
        raise HTTPException(status_code=500, detail=f"Couldn't create the character: {detail}")

    db_char.file_path = str(path)
    db.commit()
    return {"id": db_char.id, "name": char_name}


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