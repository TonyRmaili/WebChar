from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pathlib import Path

from app.routers.campaigns import CurrentUser, GROUPS_DIR, _campaign_dir, _write_json
from app.routers.records import list_records, new_id, now, read_record, record_file


# ---------- groups ----------
# A saved pack of creatures to drop into encounters in one go:
# <campaign>/groups/<id>.json
#
#   { "id", "created_at", "updated_at",
#     "name", "notes",
#     "monsters":  [{ "shelf": "Goblin.json", "count": 4 }],   from the monster shelf
#     "npcs":      [{ "file": "Captain Vos.json" }],
#     "templates": ["<template id>", …] }                       given to everyone in it

router = APIRouter(prefix="/campaign/groups", tags=["groups"])


def _blank(name: str) -> dict:
    return {"name": name, "notes": "", "monsters": [], "npcs": [], "templates": []}


def _complete(data: dict) -> dict:
    return {**_blank(data.get("name") or "Group"), **data}


def _folder(user, campaign_name: str) -> Path:
    return _campaign_dir(user, campaign_name) / GROUPS_DIR


def _file(user, campaign_name: str, group_id: str) -> Path:
    return record_file(_folder(user, campaign_name), group_id)


@router.get("")
def list_groups(current_user: CurrentUser, campaign_name: str):
    return [_complete(g) for g in list_records(_folder(current_user, campaign_name))]


class CreateGroupRequest(BaseModel):
    campaign_name: str
    name: str = Field(default="New group", max_length=120)


@router.post("")
def create_group(payload: CreateGroupRequest, current_user: CurrentUser):
    stamp = now()
    data = {"id": new_id(), "created_at": stamp, "updated_at": stamp, **_blank(payload.name.strip() or "New group")}
    _write_json(_file(current_user, payload.campaign_name, data["id"]), data)
    return data


class SaveGroupRequest(BaseModel):
    campaign_name: str
    data: dict


@router.put("/{group_id}")
def save_group(group_id: str, payload: SaveGroupRequest, current_user: CurrentUser):
    path = _file(current_user, payload.campaign_name, group_id)
    old = read_record(path, "That group")
    data = _complete({**payload.data, "id": old["id"], "created_at": old.get("created_at"), "updated_at": now()})
    _write_json(path, data)
    return data


class CopyGroupRequest(BaseModel):
    campaign_name: str


@router.post("/{group_id}/copy")
def copy_group(group_id: str, payload: CopyGroupRequest, current_user: CurrentUser):
    old = read_record(_file(current_user, payload.campaign_name, group_id), "That group")
    stamp = now()
    data = _complete({**old, "id": new_id(), "name": f"{old.get('name') or 'Group'} (copy)", "created_at": stamp, "updated_at": stamp})
    _write_json(_file(current_user, payload.campaign_name, data["id"]), data)
    return data


@router.delete("/{group_id}")
def delete_group(group_id: str, current_user: CurrentUser, campaign_name: str):
    path = _file(current_user, campaign_name, group_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="That group is not there any more")
    path.unlink()
    return {"id": group_id}