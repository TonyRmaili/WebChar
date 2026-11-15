"""Checks for a spell's LLM answer that come from 5etools' own tags.

5etools marks upcasting and cantrip scaling as data, so the numbers the
LLM writes can be checked instead of trusted:

  {@scaledamage 8d6|3-9|1d6}   8d6 at level 3, +1d6 per slot level (up to 9)
                               -> some damage part must have per_slot "1d6"
  {@scaledice 2d8|1-9|2d8}     the same for other dice (often healing)
                               -> allowed as a per_slot, not required
  scalingLevelDice             a cantrip's damage by character level
                               -> some damage must be exactly that table

A mismatch is a problem: the job counts as failed and is retried once with
the problem listed, like any other check.
"""

import json
import re

from .schemas.llm_schema import FeaturesLLM, Value

SCALE_TAG = re.compile(r"\{@(scaledamage|scaledice) ([^}]*)\}")


def _dice(text: str) -> str:
    return re.sub(r"\s+", "", str(text)).lower()


def spell_expectations(entry: dict) -> dict:
    text = json.dumps([entry.get("entries"), entry.get("entriesHigherLevel")], ensure_ascii=False)
    required, allowed = set(), set()
    for tag, body in SCALE_TAG.findall(text):
        parts = body.split("|")
        if len(parts) >= 3 and parts[2].strip():
            d = _dice(parts[2])
            allowed.add(d)
            if tag == "scaledamage":
                required.add(d)
    out = {}
    if required:
        out["per_slot_required"] = sorted(required)
    if allowed:
        out["per_slot_allowed"] = sorted(allowed)
    sld = entry.get("scalingLevelDice")
    if entry.get("level") == 0 and isinstance(sld, dict) and isinstance(sld.get("scaling"), dict):
        table = {str(k): _dice(v) for k, v in sld["scaling"].items()}
        if not any("{" in v for v in table.values()):
            out["cantrip_table"] = table
    return out


def _table(v: Value | None) -> dict | None:
    if v is None:
        return None
    t = {"1": _dice(v.value)}
    for s in v.steps:
        t[str(s.level)] = _dice(s.value)
    return t


def check_spell(answer: FeaturesLLM, expect: dict) -> list[str]:
    found, tables = set(), []
    for f in answer.features:
        a = f.action
        if not a:
            continue
        parts = list(a.damage) + (list(a.attack.damage) if a.attack else []) + (list(a.save.damage) if a.save else [])
        for p in parts:
            if p.per_slot:
                found.add(_dice(p.per_slot))
            tables.append(_table(p.dice))
        for x in (a.heal_per_slot, a.temp_hp_per_slot):
            if x:
                found.add(_dice(x))
    errs = []
    allowed = set(expect.get("per_slot_allowed", []))
    for d in expect.get("per_slot_required", []):
        if d not in found:
            errs.append(f"the higher-level text adds {d} per slot level, but no damage part has per_slot \"{d}\"")
    for d in sorted(found - allowed):
        errs.append(f"per_slot \"{d}\" isn't in the higher-level text"
                    + (f" (it says: {', '.join(sorted(allowed))})" if allowed else " (this spell doesn't upcast that way)"))
    want = expect.get("cantrip_table")
    if want and want not in tables:
        steps = ", ".join(f"{v} at level {k}" for k, v in want.items() if k != "1")
        errs.append(f"the cantrip's damage should be {want.get('1')}, then {steps} (as value + steps)")
    return errs
