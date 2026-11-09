from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.dice.engine import MAX_DICE, MAX_TIMES, DiceError, dice_in, parse, resolve_attacks, resolve_saves, roll
from app.routers.campaigns import CurrentUser, _user_dir, _write_json
from app.routers.records import list_records, new_id, now, read_record, record_file


# ---------- the dice tower ----------
# Every roll in WebChar goes through here; the engine is app/dice/engine.py.
# Nothing is saved except loadouts — the roll log lives in the browser
# while the app is open.
#
#   POST /dice/roll      free rolls: [{label, expression, times, mode, against}]
#   POST /dice/saves     many targets save against one effect
#   POST /dice/attacks   volleys of attacks against an AC
#
#   GET    /dice/loadouts        your saved sets of rolls (all campaigns)
#   POST   /dice/loadouts        {data}
#   PUT    /dice/loadouts/{id}   {data}
#   DELETE /dice/loadouts/{id}

router = APIRouter(prefix="/dice", tags=["dice"])

Mode = Literal["normal", "advantage", "disadvantage"]
CritRule = Literal["double_dice", "max_plus_roll"]
LOADOUTS_DIR = "dice_loadouts"


def _rolled(fn, *args):
    """Run the engine; anything it can't roll comes back as a 400 with its reason."""
    try:
        return fn(*args)
    except DiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------- free rolls ----------

class RollLine(BaseModel):
    label: str = ""
    expression: str = Field(max_length=200)
    times: int = Field(default=1, ge=1, le=MAX_TIMES)
    mode: Mode = "normal"
    against: int | None = Field(default=None, ge=-100, le=1000)  # count how many reach this (an AC, a DC)


class RollRequest(BaseModel):
    rolls: list[RollLine] = Field(min_length=1, max_length=50)


@router.post("/roll")
def roll_dice(payload: RollRequest, current_user: CurrentUser):
    def run():
        dice = sum(dice_in(parse(line.expression)) * line.times for line in payload.rolls)
        if dice > MAX_DICE:
            raise DiceError(f"That's more than {MAX_DICE:,} dice in one go")
        out = []
        for line in payload.rolls:
            results = [roll(line.expression, mode=line.mode) for _ in range(line.times)]
            out.append({**line.model_dump(), "results": results, "total": sum(r["total"] for r in results)})
        return {"rolls": out}

    return _rolled(run)


# ---------- saves and attacks ----------

class DamagePart(BaseModel):
    dice: str = Field(default="0", max_length=100)
    type: str = Field(default="untyped", max_length=40)
    given: int | None = Field(default=None, ge=0, le=100_000)  # what the real dice showed


class Defenses(BaseModel):
    resistances: list[str] = []
    immunities: list[str] = []
    vulnerabilities: list[str] = []


class SaveTarget(BaseModel):
    key: str
    name: str = ""
    save_bonus: int = Field(default=0, ge=-30, le=50)
    mode: Mode = "normal"
    given: int | None = Field(default=None, ge=1, le=20)
    defenses: Defenses = Defenses()


class SaveRequest(BaseModel):
    dc: int = Field(ge=1, le=60)
    on_success: Literal["half", "none"] = "half"
    damage: list[DamagePart] = Field(default=[], max_length=10)
    damage_roll: Literal["once", "each"] = "once"
    targets: list[SaveTarget] = Field(min_length=1, max_length=MAX_TIMES)


@router.post("/saves")
def roll_saves(payload: SaveRequest, current_user: CurrentUser):
    return _rolled(resolve_saves, payload.model_dump())


class Volley(BaseModel):
    key: str = ""
    name: str = ""
    count: int = Field(default=1, ge=1, le=MAX_TIMES)
    to_hit: int = Field(default=0, ge=-30, le=50)
    mode: Mode = "normal"
    crit_on: int = Field(default=20, ge=2, le=20)
    damage: list[DamagePart] = Field(default=[], max_length=10)
    ac: int = Field(default=10, ge=0, le=60)
    defenses: Defenses = Defenses()


class AttackRequest(BaseModel):
    crit_rule: CritRule = "double_dice"
    volleys: list[Volley] = Field(min_length=1, max_length=MAX_TIMES)


@router.post("/attacks")
def roll_attacks(payload: AttackRequest, current_user: CurrentUser):
    return _rolled(resolve_attacks, payload.model_dump())


# ---------- loadouts ----------
# A loadout is a named set of rolls you keep using:
#   { id, name, notes, rolls: [{ id, label, expression, times, mode }] }
# Kept on your profile (save_files/<user>/dice_loadouts/<id>.json), so
# every campaign has them.

class LoadoutBody(BaseModel):
    data: dict = Field(default_factory=dict)


def _loadouts(user):
    return _user_dir(user) / LOADOUTS_DIR


def _check(data: dict):
    """Only rolls the engine can read are kept."""
    for line in data.get("rolls") or []:
        expression = str(line.get("expression") or "").strip()
        if expression:
            _rolled(parse, expression)


@router.get("/loadouts")
def list_loadouts(current_user: CurrentUser):
    return list_records(_loadouts(current_user))


@router.post("/loadouts")
def create_loadout(payload: LoadoutBody, current_user: CurrentUser):
    _check(payload.data)
    when = now()
    data = {"rolls": [], **payload.data, "id": new_id(), "created_at": when, "updated_at": when}
    data["name"] = (data.get("name") or "").strip() or "New loadout"
    _write_json(record_file(_loadouts(current_user), data["id"]), data)
    return data


@router.put("/loadouts/{loadout_id}")
def save_loadout(loadout_id: str, payload: LoadoutBody, current_user: CurrentUser):
    path = record_file(_loadouts(current_user), loadout_id)
    old = read_record(path, "That loadout")
    _check(payload.data)
    data = {**payload.data, "id": old["id"], "created_at": old.get("created_at"), "updated_at": now()}
    data["name"] = (data.get("name") or "").strip() or "New loadout"
    _write_json(path, data)
    return data


@router.delete("/loadouts/{loadout_id}")
def delete_loadout(loadout_id: str, current_user: CurrentUser):
    path = record_file(_loadouts(current_user), loadout_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="That loadout is not there any more")
    path.unlink()
    return {"id": loadout_id}