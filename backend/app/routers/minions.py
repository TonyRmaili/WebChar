"""Minion storage: one JSON file per minion group.

Layout on disk:
    save_files/<user>/minions/<character name>/<minion id>.json

The shape of a minion is documented in claude/minion-contract.md in the
project. The server only owns `id` (stamped on create) and the file
location (plus `created_at`, used for ordering); everything else is stored as the frontend sends it.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status

from app.database.models import User
from app.security import get_current_user

# Same value as savefiles_path in main.py. Move both to one shared config
# module when main.py is split up further.
SAVEFILES_PATH = "./app/database/save_files/"

router = APIRouter(prefix="/minions", tags=["minions"])

CurrentUser = Annotated[User, Depends(get_current_user)]
CharName = Annotated[str, Query(min_length=1, max_length=120)]


# ---------- paths ----------

def _char_dir(user_name: str, char_name: str) -> Path:
    """Folder holding one character's minions.

    The character name comes from the browser, so it is checked to be a
    single folder name inside this user's minions folder. That blocks
    names like "../other_user" from reaching files outside it.
    """
    root = (Path(SAVEFILES_PATH) / user_name / "minions").resolve()
    folder = (root / char_name).resolve()
    if folder.parent != root:
        raise HTTPException(status_code=400, detail="Invalid character name")
    return folder


def _minion_file(user_name: str, char_name: str, minion_id: str) -> Path:
    # Only real UUIDs are accepted as ids, so they are always safe filenames.
    try:
        clean_id = str(uuid.UUID(minion_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid minion id")
    return _char_dir(user_name, char_name) / f"{clean_id}.json"


# ---------- file helpers ----------

def _write(path: Path, data: dict) -> None:
    """Write via a temp file and rename, so a crash mid-write never leaves
    a half-written minion behind."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    os.replace(tmp, path)


def _read(path: Path) -> dict | None:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    # Files from the old format have no id or monster; they are skipped
    # (clean slate) rather than breaking the whole list.
    if not isinstance(data, dict) or not data.get("id") or not isinstance(data.get("monster"), dict):
        return None
    return data


# ---------- endpoints ----------

@router.get("")
def list_minions(current_user: CurrentUser, char_name: CharName):
    folder = _char_dir(current_user.name, char_name)
    if not folder.is_dir():
        return []

    minions = []
    for path in sorted(folder.glob("*.json")):
        data = _read(path)
        if data is not None:
            minions.append(data)

    # Oldest first, so the order on screen is the order they were added.
    minions.sort(key=lambda m: m.get("created_at") or "")
    return minions


@router.post("", status_code=status.HTTP_201_CREATED)
def create_minion(current_user: CurrentUser, char_name: CharName, payload: dict = Body(...)):
    if not isinstance(payload.get("monster"), dict):
        raise HTTPException(status_code=400, detail="A minion needs a monster")

    payload["id"] = str(uuid.uuid4())
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    path = _minion_file(current_user.name, char_name, payload["id"])
    _write(path, payload)
    return payload


@router.put("/{minion_id}")
def update_minion(
    minion_id: str,
    current_user: CurrentUser,
    char_name: CharName,
    payload: dict = Body(...),
):
    path = _minion_file(current_user.name, char_name, minion_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Minion not found")
    if not isinstance(payload.get("monster"), dict):
        raise HTTPException(status_code=400, detail="A minion needs a monster")

    # The id and creation time are the server's; keep them whatever is sent.
    existing = _read(path) or {}
    payload["id"] = minion_id
    payload["created_at"] = existing.get("created_at") or payload.get("created_at")
    _write(path, payload)
    return payload


@router.delete("/{minion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_minion(minion_id: str, current_user: CurrentUser, char_name: CharName):
    path = _minion_file(current_user.name, char_name, minion_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Minion not found")
    path.unlink()
    return Response(status_code=status.HTTP_204_NO_CONTENT)