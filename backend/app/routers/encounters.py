from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pathlib import Path

from app.routers.campaigns import CurrentUser, ENCOUNTERS_DIR, _campaign_dir, _write_json
from app.routers.records import list_records, new_id, now, read_record, record_file


# ---------- encounters ----------
# One file per encounter: <campaign>/encounters/<id>.json
#
#   {
#     "id", "created_at", "updated_at"        set by the server
#     "name", "notes"
#     "members":  [{ "kind": "party" | "npc", "file": "Mira.json" }]
#                 pointers to the campaign's own copies (shared state)
#     "monsters": [ full monster copies, one per creature ]
#                 each encounter has its own, so prepping two fights
#                 never mixes up their HP or uses
#     "xp":   { "override": null | number }
#     "loot": { "items": [...], "coins": { "gp": 35, ... }, "notes": "" }
#   }
#
# The browser owns the shape of members/monsters/xp/loot; the server keeps
# id and dates honest and makes sure every encounter has every part.

router = APIRouter(prefix="/campaign/encounters", tags=["encounters"])


def _blank(name: str) -> dict:
    return {
        "name": name,
        "notes": "",
        "members": [],
        "monsters": [],
        "xp": {"override": None},
        "loot": {"items": [], "coins": {}, "notes": ""},
    }


def _folder(user, campaign_name: str) -> Path:
    return _campaign_dir(user, campaign_name) / ENCOUNTERS_DIR


def _encounter_file(user, campaign_name: str, encounter_id: str) -> Path:
    return record_file(_folder(user, campaign_name), encounter_id)


def _read(path: Path) -> dict:
    return read_record(path, "That encounter")


def _complete(data: dict) -> dict:
    """Fill in any part that is missing, so the browser can rely on all of them."""
    out = {**_blank(data.get("name") or "Encounter"), **data}
    out["loot"] = {**_blank("")["loot"], **(out.get("loot") or {})}
    out["xp"] = {**_blank("")["xp"], **(out.get("xp") or {})}
    return out


@router.get("")
def list_encounters(current_user: CurrentUser, campaign_name: str):
    return [_complete(e) for e in list_records(_folder(current_user, campaign_name))]


class CreateEncounterRequest(BaseModel):
    campaign_name: str
    name: str = Field(default="New encounter", max_length=120)


@router.post("")
def create_encounter(payload: CreateEncounterRequest, current_user: CurrentUser):
    stamp = now()
    data = {"id": new_id(), "created_at": stamp, "updated_at": stamp, **_blank(payload.name.strip() or "New encounter")}
    _write_json(_encounter_file(current_user, payload.campaign_name, data["id"]), data)
    return data


class SaveEncounterRequest(BaseModel):
    campaign_name: str
    data: dict


@router.put("/{encounter_id}")
def save_encounter(encounter_id: str, payload: SaveEncounterRequest, current_user: CurrentUser):
    path = _encounter_file(current_user, payload.campaign_name, encounter_id)
    old = _read(path)
    data = _complete({**payload.data, "id": old["id"], "created_at": old.get("created_at"), "updated_at": now()})
    _write_json(path, data)
    return data


class CopyEncounterRequest(BaseModel):
    campaign_name: str


@router.post("/{encounter_id}/copy")
def copy_encounter(encounter_id: str, payload: CopyEncounterRequest, current_user: CurrentUser):
    old = _read(_encounter_file(current_user, payload.campaign_name, encounter_id))
    stamp = now()
    data = _complete({**old, "id": new_id(), "name": f"{old.get('name') or 'Encounter'} (copy)", "created_at": stamp, "updated_at": stamp})
    _write_json(_encounter_file(current_user, payload.campaign_name, data["id"]), data)
    return data


@router.delete("/{encounter_id}")
def delete_encounter(encounter_id: str, current_user: CurrentUser, campaign_name: str):
    path = _encounter_file(current_user, campaign_name, encounter_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="That encounter is not in the campaign any more")
    path.unlink()
    return {"id": encounter_id}