from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pathlib import Path
from typing import Literal

from app.routers.campaigns import CurrentUser, _campaign_dir, _user_dir, _write_json
from app.routers.records import list_records, new_id, now, read_record, record_file


# ---------- records kept in one campaign or in all of them ----------
# Templates and tables work the same way, so their routers are made here.
# Two places to keep one:
#
#   scope "campaign"  <campaign>/<folder>/<id>.json    only in that campaign
#   scope "all"       save_files/<user>/<folder>/<id>.json
#                                                      in every campaign of yours
#
# Other things point at a record by id (a live link), so an id never
# changes, not even when the record moves between the two places.
#
#   GET    ?campaign_name=            both places, each record with its scope
#   POST   {campaign_name, scope, data}
#   PUT    /{id} {campaign_name, scope, data}
#   POST   /{id}/copy {campaign_name, scope, to_scope?}   "Name (copy)"
#   POST   /{id}/move {campaign_name, scope, to_scope}    same id, other place
#   DELETE /{id}?campaign_name=&scope=

Scope = Literal["campaign", "all"]


class CreateRequest(BaseModel):
    campaign_name: str
    scope: Scope = "campaign"
    data: dict = Field(default_factory=dict)


class SaveRequest(BaseModel):
    campaign_name: str
    scope: Scope
    data: dict


class WhereRequest(BaseModel):
    campaign_name: str
    scope: Scope
    to_scope: Scope | None = None


def scoped_router(prefix: str, folder: str, what: str, default_name: str) -> APIRouter:
    """A router for one kind of record. `what` names it in messages ("That table")."""
    router = APIRouter(prefix=prefix, tags=[prefix.strip("/")])

    def folder_for(user, campaign_name: str, scope: str) -> Path:
        if scope == "all":
            return _user_dir(user) / folder
        return _campaign_dir(user, campaign_name) / folder

    def file_for(user, campaign_name: str, scope: str, record_id: str) -> Path:
        return record_file(folder_for(user, campaign_name, scope), record_id)

    def stamp(data: dict, scope: str) -> dict:
        """What every record has, whatever the browser sent."""
        out = {**data, "scope": scope}
        out["name"] = (out.get("name") or "").strip() or default_name
        return out

    @router.get("")
    def list_all(current_user: CurrentUser, campaign_name: str):
        out = []
        for scope in ("campaign", "all"):
            out += [{**r, "scope": scope} for r in list_records(folder_for(current_user, campaign_name, scope))]
        return out

    @router.post("")
    def create(payload: CreateRequest, current_user: CurrentUser):
        when = now()
        data = stamp({**payload.data, "id": new_id(), "created_at": when, "updated_at": when}, payload.scope)
        _write_json(file_for(current_user, payload.campaign_name, payload.scope, data["id"]), data)
        return data

    @router.put("/{record_id}")
    def save(record_id: str, payload: SaveRequest, current_user: CurrentUser):
        path = file_for(current_user, payload.campaign_name, payload.scope, record_id)
        old = read_record(path, what)
        data = stamp({**payload.data, "id": old["id"], "created_at": old.get("created_at"), "updated_at": now()}, payload.scope)
        _write_json(path, data)
        return data

    @router.post("/{record_id}/copy")
    def copy(record_id: str, payload: WhereRequest, current_user: CurrentUser):
        old = read_record(file_for(current_user, payload.campaign_name, payload.scope, record_id), what)
        to = payload.to_scope or payload.scope
        when = now()
        data = stamp({**old, "id": new_id(), "name": f"{old.get('name') or default_name} (copy)", "created_at": when, "updated_at": when}, to)
        _write_json(file_for(current_user, payload.campaign_name, to, data["id"]), data)
        return data

    @router.post("/{record_id}/move")
    def move(record_id: str, payload: WhereRequest, current_user: CurrentUser):
        if not payload.to_scope or payload.to_scope == payload.scope:
            raise HTTPException(status_code=400, detail="Say where to move it")
        src = file_for(current_user, payload.campaign_name, payload.scope, record_id)
        old = read_record(src, what)
        dest = file_for(current_user, payload.campaign_name, payload.to_scope, record_id)
        if dest.exists():
            raise HTTPException(status_code=409, detail=f"{what} is already there")
        data = stamp({**old, "updated_at": now()}, payload.to_scope)
        _write_json(dest, data)
        src.unlink()
        return data

    @router.delete("/{record_id}")
    def delete(record_id: str, current_user: CurrentUser, campaign_name: str, scope: Scope):
        path = file_for(current_user, campaign_name, scope, record_id)
        if not path.is_file():
            raise HTTPException(status_code=404, detail=f"{what} is not there any more")
        path.unlink()
        return {"id": record_id}

    return router