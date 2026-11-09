from fastapi import HTTPException
from datetime import datetime, timezone
from pathlib import Path
import json
import uuid


# ---------- one-file-per-record folders ----------
# Encounters, groups and templates are each kept as <folder>/<id>.json,
# where id is a UUID the server makes. These helpers are shared by their
# routers so the rules are the same everywhere.


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id() -> str:
    return str(uuid.uuid4())


def record_file(folder: Path, record_id: str) -> Path:
    """The file for an id. Only real UUIDs, so an id can never point outside the folder."""
    try:
        clean = str(uuid.UUID(record_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id")
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{clean}.json"


def read_record(path: Path, what: str = "That record") -> dict:
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"{what} is not there any more")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise HTTPException(status_code=500, detail=f"{what} could not be read")


def list_records(folder: Path) -> list:
    """Every record in the folder, oldest first; unreadable files are skipped."""
    out = []
    if folder.is_dir():
        for path in folder.glob("*.json"):
            try:
                out.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
    out.sort(key=lambda r: r.get("created_at") or "")
    return out