"""Code cleaner for spells: one resolved spell -> our shape.

    clean_spell(entry) -> (cleaned dict, problems)

Everything that 5etools already gives as data is done here: level, school,
casting time, range, components (with gold costs), duration, ritual, the
class lists (from spell_sources.json) and the search tags. The text, the
damage/save/heal numbers and upcasting are the LLM step's job.

Edition: spells have no `edition` key. common_cleaner.edition_of decides it
from the data (SRD and basic-rules flags, reprints, the book's other
entries, the book's publication date); anything undecided is reported.

Name: the SRD name wins ("Bigby's Hand" is "Arcane Hand"); the book name
stays as an alias and in the id.
"""

from pydantic import ValidationError

from ..data_files import RESOLVED_PATH, read_extra
from ..schemas.common_schema import dump
from ..schemas.spells_schema import Spell
from . import common_cleaner as c

HANDLED = {
    "name", "source", "edition", "srd", "srd52", "basicRules", "basicRules2024", "alias", "reprintedAs",
    "level", "school", "time", "range", "components", "duration", "meta", "entries", "entriesHigherLevel",
    "scalingLevelDice", "damageInflict", "conditionInflict", "savingThrow", "abilityCheck", "spellAttack",
    "areaTags", "affectsCreatureType", "damageResist", "damageImmune", "damageVulnerable", "conditionImmune",
    "miscTags",
}
DROPPED = {"page", "referenceSources", "otherSources", "additionalSources", "hasFluff", "hasFluffImages", "_file"}

ABILITY_NAMES = {"strength": "str", "dexterity": "dex", "constitution": "con",
                 "intelligence": "int", "wisdom": "wis", "charisma": "cha"}
AREA_TAGS = {
    "ST": "single_target", "MT": "multiple_targets", "S": "sphere", "C": "cube", "Y": "cylinder",
    "W": "wall", "N": "cone", "Q": "square", "L": "line", "R": "circle", "E": "emanation", "H": "hemisphere",
}
# 5etools' "miscellaneous" spell tags. Unknown codes are reported (and kept as the code).
MISC_TAGS = {
    "AAD": "additional_attack_damage", "ADV": "grants_advantage", "DFT": "difficult_terrain",
    "FMV": "forced_movement", "HL": "healing", "LGT": "creates_light", "LGTS": "creates_sunlight",
    "MAC": "modifies_ac", "OBJ": "affects_objects", "OBS": "obscures_vision", "PIR": "permanent_if_repeated",
    "PRM": "permanent_effects", "PS": "plane_shifting", "RO": "rollable_effects", "SCL": "scaling_effects",
    "SCT": "scaling_targets", "SGT": "requires_sight", "SMN": "summons_creature", "THP": "grants_temp_hp",
    "TP": "teleportation", "UBA": "uses_bonus_action", "UA": "uses_action",
    # Not defined in the data we have; named from the spells that carry them:
    "BO": "ignites_objects",      # Fire Bolt, Fireball, Burning Hands, Prestidigitation (lights a candle)
    "WLT": "targets_willing",     # Mage Armor, Fly, Haste, Guidance, Teleport ("a willing creature")
    "ALT": "affects_allies",      # Aura of Life, Aura of Purity, Circle of Power, Crusader's Mantle
}
AREA_RANGES = {"emanation", "cone", "radius", "line", "sphere", "cube", "hemisphere", "cylinder"}
TIME_UNITS = {"action": "action", "bonus": "bonus_action", "reaction": "reaction",
              "minute": "minute", "hour": "hour", "round": "round"}

_class_lists: dict | None = None


# ---------- class lists ----------

def class_lists() -> dict[tuple, list[str]]:
    """{(source, spell name): ["wizard-xphb", …]} from spell_sources.json:
    the normal lists (`class`) and the optional TCE ones (`classVariant`),
    merged."""
    global _class_lists
    if _class_lists is None:
        raw = read_extra(RESOLVED_PATH, "spells", "spell_sources") or {}
        # A class left out as a mere copy of another (WoW Mage -> 2024 Wizard):
        # its spells go on the real class's list. Written by the class resolver.
        moved = read_extra(RESOLVED_PATH, "classes", "_references") or {}
        out: dict[tuple, list[str]] = {}
        for source, spells_ in raw.items():
            if not isinstance(spells_, dict):
                continue
            for name, lists in spells_.items():
                ids = out.setdefault((source.lower(), name.lower()), [])
                for kind in ("class", "classVariant"):
                    for cl in (lists or {}).get(kind) or []:
                        if cl.get("name"):
                            cid = c.entry_id(cl["name"], cl.get("source") or c.DEFAULT_SOURCE)
                            cid = moved.get(cid, cid)
                            if cid not in ids:
                                ids.append(cid)
        _class_lists = out
    return _class_lists


# ---------- parts ----------

def _time(raw: list, problems: list) -> list[dict]:
    out = []
    for t in raw or []:
        unit = TIME_UNITS.get(t.get("unit"))
        if unit is None:
            problems.append(f"time: unknown unit '{t.get('unit')}'")
            continue
        d = {"number": t.get("number", 1), "unit": unit}
        if t.get("condition"):
            d["trigger"] = t["condition"]
        if t.get("note"):
            d["note"] = t["note"]
        out.append(d)
    return out


def _range(raw: dict, problems: list) -> dict:
    rtype = (raw or {}).get("type")
    dist = (raw or {}).get("distance") or {}
    if rtype == "point":
        d = {"type": dist.get("type")}
        if "amount" in dist:
            d["amount"] = dist["amount"]
        if d["type"] not in ("feet", "miles", "self", "touch", "sight", "unlimited"):
            problems.append(f"range: unknown distance '{d['type']}'")
            return {"type": "special"}
        return d
    if rtype in AREA_RANGES:
        return {"type": "self", "area": {"shape": rtype, "size": dist.get("amount"), "unit": dist.get("type", "feet")}}
    if rtype == "special":
        return {"type": "special"}
    problems.append(f"range: unknown type '{rtype}'")
    return {"type": "special"}


def _components(raw: dict, problems: list) -> dict:
    out = {k: True for k in ("v", "s", "r") if (raw or {}).get(k)}
    m = (raw or {}).get("m")
    if isinstance(m, str):
        out["m"] = m
    elif isinstance(m, dict):
        mat = {"text": m.get("text", "")}
        if m.get("cost"):
            mat["cost"] = c.cp_to_money(m["cost"])
        if m.get("consume"):
            mat["consumed"] = m["consume"] if m["consume"] == "optional" else True
        out["m"] = mat
    elif m is not None:
        problems.append(f"components: can't read m={m!r}")
    extra = set(raw or {}) - {"v", "s", "r", "m"}
    if extra:
        problems.append(f"components: can't read {sorted(extra)}")
    return out


def _duration(raw: list, problems: list) -> list[dict]:
    out = []
    for d in raw or []:
        o = {"type": d.get("type")}
        if d.get("duration"):
            o["amount"] = d["duration"].get("amount")
            o["unit"] = d["duration"].get("type")
            if d["duration"].get("upTo"):
                o["up_to"] = True
        if d.get("concentration"):
            o["concentration"] = True
        if d.get("ends"):
            o["ends"] = list(d["ends"])
        out.append(o)
    return out


def _filters(e: dict, problems: list) -> dict:
    f = {}

    def put(key, values):
        if values:
            f[key] = values

    put("damage", list(e.get("damageInflict") or []))
    put("conditions", list(e.get("conditionInflict") or []))
    put("saves", [ABILITY_NAMES.get(x, x) for x in e.get("savingThrow") or []])
    put("checks", [ABILITY_NAMES.get(x, x) for x in e.get("abilityCheck") or []])
    put("attack", [{"M": "melee", "R": "ranged"}.get(x, x) for x in e.get("spellAttack") or []])
    area = []
    for t in e.get("areaTags") or []:
        if t not in AREA_TAGS:
            problems.append(f"filters: unknown area tag '{t}'")
        area.append(AREA_TAGS.get(t, t.lower()))
    put("area", area)
    put("creature_types", list(e.get("affectsCreatureType") or []))
    put("gives_resist", list(e.get("damageResist") or []))
    put("gives_immune", list(e.get("damageImmune") or []))
    put("gives_vulnerable", list(e.get("damageVulnerable") or []))
    put("gives_condition_immune", list(e.get("conditionImmune") or []))
    tags = []
    for t in e.get("miscTags") or []:
        if t not in MISC_TAGS:
            problems.append(f"filters: unknown misc tag '{t}'")
        tags.append(MISC_TAGS.get(t, t.lower()))
    put("tags", tags)
    return f


# ---------- the spell ----------

def clean_spell(entry: dict) -> tuple[dict | None, list[str]]:
    problems: list[str] = []
    out = c.header(entry, "spell", problems, read_prerequisite=False)
    edition = c.edition_of(entry, problems, "spells")
    if edition is None:
        c.unhandled(entry, HANDLED, DROPPED, problems)
        return None, problems
    out["edition"] = edition

    out["level"] = entry.get("level")
    school = c.SCHOOLS.get(str(entry.get("school", "")).upper())
    if school is None:
        problems.append(f"unknown school '{entry.get('school')}'")
    out["school"] = school
    meta = entry.get("meta") or {}
    if meta.get("ritual"):
        out["ritual"] = True
    if set(meta) - {"ritual"}:
        problems.append(f"meta: can't read {sorted(set(meta) - {'ritual'})}")
    out["time"] = _time(entry.get("time"), problems)
    out["range"] = _range(entry.get("range"), problems)
    out["components"] = _components(entry.get("components"), problems)
    out["duration"] = _duration(entry.get("duration"), problems)

    classes = class_lists().get((str(entry.get("source", "")).lower(), str(entry.get("name", "")).lower()))
    if classes:
        out["classes"] = classes
    # No class list is normal for some books (EGW's dunamancy, WoW's class
    # spells): those lists live in the class/subclass data, linked later.
    out["filters"] = _filters(entry, problems)

    c.unhandled(entry, HANDLED, DROPPED, problems)
    try:
        return dump(Spell.model_validate(out)), problems
    except ValidationError as e:
        problems += [f"schema: {'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]
        return None, problems