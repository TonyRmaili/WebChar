"""One place for finding, reading and writing a player's character file.

Characters are keyed by their database id, which never changes:

    save_files/<user>/characters/<id>.json     the character sheet
    save_files/<user>/minions/<id>/            that character's minions

The name is plain data inside the file (and copied onto the database row,
so lists like /me can show it without opening every file).

Typical use in an endpoint:

    char = get_owned_character(db, current_user, char_id)    # 404 if not yours
    with edit_character(current_user.name, char.id) as data:
        data["exp"] = data.get("exp", 0) + 100
    # leaving the `with` block saves the file; an error inside it saves nothing
"""

import json
import os
import threading
from collections import defaultdict
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import Character, User

# Same value as savefiles_path in main.py and the routers. Move them all
# to one shared config module when main.py is split up further.
SAVEFILES_PATH = "./app/database/save_files/"


# ---------- paths ----------
# char_id is always an int (FastAPI checks that before the endpoint runs),
# so it is always a safe file or folder name.

def character_path(user_name: str, char_id: int) -> Path:
    return Path(SAVEFILES_PATH) / user_name / "characters" / f"{int(char_id)}.json"


def minions_dir(user_name: str, char_id: int) -> Path:
    return Path(SAVEFILES_PATH) / user_name / "minions" / str(int(char_id))


# ---------- ownership ----------

def get_owned_character(db: Session, user: User, char_id: int) -> Character:
    """The database row of one of this user's characters, or a 404.

    Asking for someone else's id gives the same 404 as a missing one, so
    nobody can find out which ids exist."""
    char = db.scalar(select(Character).where(Character.id == char_id, Character.user_id == user.id))
    if char is None:
        raise HTTPException(status_code=404, detail="Character not found")
    return char


# ---------- reading and writing ----------

def read_character(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="The character file is missing")
    except (OSError, json.JSONDecodeError):
        raise HTTPException(status_code=500, detail="The character file could not be read")
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="The character file is not a character")
    return data


def write_character(path: Path, data: dict) -> None:
    """Write to a temp file, then swap it in, so a crash mid-write never
    leaves half a character behind (same trick as the minions router)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=4, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


# ---------- one change at a time per character ----------
# FastAPI runs several requests at once. Without a lock, a save and a
# damage click arriving together could both read the file, and the one
# that writes last would wipe out the other's change. The lock makes
# them take turns, one character at a time.

_locks: dict[int, threading.Lock] = defaultdict(threading.Lock)
_locks_guard = threading.Lock()


def character_lock(char_id: int) -> threading.Lock:
    with _locks_guard:
        return _locks[int(char_id)]


@contextmanager
def edit_character(user_name: str, char_id: int):
    """Read a character, let the caller change it, then save it.

    Check ownership first (get_owned_character): this only knows paths."""
    path = character_path(user_name, char_id)
    with character_lock(char_id):
        data = read_character(path)
        yield data
        write_character(path, data)