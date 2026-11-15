"""Code cleaner for races: one resolved race (with its subraces) -> our shape.

    clean_race(entry) -> (cleaned dict, problems)

The resolver has already put every subrace (raw subraces and _versions)
inside the race under `subraces`. Races and subraces share one grants
reader, `_grants()`, because a subrace can change the same things a race
has (speed, darkvision, resistances, spells…).

`text` and `features` are added later by the LLM step.
"""

from pydantic import ValidationError

from ..schemas.common_schema import dump
from ..schemas.races_schema import Race
from . import common_cleaner as c

SIZES = {"T": "tiny", "S": "small", "M": "medium", "L": "large", "H": "huge", "G": "gargantuan", "V": "varies"}

# Keys both races and subraces may have, read by _grants().
GRANT_KEYS = {
    "ability", "lineage", "skillProficiencies", "toolProficiencies", "languageProficiencies",
    "weaponProficiencies", "armorProficiencies", "skillToolLanguageProficiencies", "feats",
    "additionalSpells", "speed", "darkvision", "blindsight", "tremorsense", "truesight",
    "resist", "immune", "vulnerable", "conditionImmune",
}
SHARED_HANDLED = GRANT_KEYS | {
    "name", "source", "edition", "srd", "srd52", "reprintedAs", "prerequisite",
    "alias", "traitTags", "creatureTypeTags", "size", "entries",
}
DROPPED = {
    "page", "hasFluff", "hasFluffImages", "basicRules", "basicRules2024", "otherSources",
    "additionalSources", "soundClip", "age", "heightAndWeight", "sizeEntry", "_file",
}
RACE_HANDLED = SHARED_HANDLED | {"creatureTypes", "subraces"}
SUBRACE_HANDLED = SHARED_HANDLED | {"raceName", "raceSource", "overwrite", "entriesRemoved", "fromVersion"}

# Raw key a subrace overwrites -> our grant key (for `replaces`).
REPLACES = {
    "ability": "ability", "lineage": "ability",
    "skillProficiencies": "skills", "toolProficiencies": "tools", "languageProficiencies": "languages",
    "weaponProficiencies": "weapons", "armorProficiencies": "armor", "feats": "feats",
    "additionalSpells": "spells", "speed": "speed", "size": "size",
    "darkvision": "senses", "blindsight": "senses", "tremorsense": "senses", "truesight": "senses",
    "resist": "defenses", "immune": "defenses", "vulnerable": "defenses", "conditionImmune": "defenses",
}
# Overwrites of keys that carry no mechanics: nothing to replace.
REPLACES_IGNORED = {"traitTags", "creatureTypeTags", "otherSources", "page", "reprintedAs", "srd", "srd52",
                    "basicRules", "basicRules2024", "hasFluff", "hasFluffImages", "soundClip", "age",
                    "heightAndWeight", "alias", "sizeEntry", "entries"}


def _sizes(raw, problems: list) -> list[str] | None:
    if raw is None:
        return None
    out = []
    for s in raw:
        if s not in SIZES:
            problems.append(f"size: unknown '{s}'")
        else:
            out.append(SIZES[s])
            if s == "V":
                problems.append("size: 'varies' (check the text)")
    return out


def _speed(raw, problems: list) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, int):
        return {"walk": raw}
    if isinstance(raw, dict):
        out = {}
        for k, v in raw.items():
            if v is True:
                out[k] = "walk"
            elif isinstance(v, int):
                out[k] = v
            else:
                problems.append(f"speed: can't read {k}={v!r}")
        return out
    problems.append(f"speed: can't read {raw!r}")
    return {}


def _grants(entry: dict, problems: list) -> tuple[dict, list]:
    """Everything a race or subrace grants or lets you pick."""
    grants: dict = {}
    choices: list = []

    # lineage "VRGR" = the custom-origin +2/+1 or +1/+1/+1. lineage true only
    # marks a race as a custom lineage (TCE Custom Lineage has its own `ability`).
    if entry.get("lineage") == "VRGR":
        if entry.get("ability"):
            problems.append("has both 'lineage' and 'ability'")
        choices.append(c.lineage_ability())
    elif entry.get("lineage") not in (None, True):
        problems.append(f"lineage: unknown value {entry['lineage']!r}")

    parts = [
        c.ability_scores(entry.get("ability"), problems),
        c.proficiencies(entry.get("skillProficiencies"), "skills", problems),
        c.proficiencies(entry.get("toolProficiencies"), "tools", problems),
        c.proficiencies(entry.get("languageProficiencies"), "languages", problems),
        c.proficiencies(entry.get("weaponProficiencies"), "weapons", problems),
        c.proficiencies(entry.get("armorProficiencies"), "armor", problems),
        c.mixed_proficiencies(entry.get("skillToolLanguageProficiencies"), problems),
        c.feats(entry.get("feats"), problems),
        c.spells(entry.get("additionalSpells"), problems),
        c.defenses(entry, problems),
    ]
    for g, ch in parts:
        c.add_grants(grants, g)
        choices += ch

    speed = _speed(entry.get("speed"), problems)
    if speed:
        grants["speed"] = speed
    senses = {k: entry[k] for k in ("darkvision", "blindsight", "tremorsense", "truesight")
              if isinstance(entry.get(k), int)}
    if senses:
        grants["senses"] = senses
    return grants, choices


def subrace_id(sub: dict, race: dict) -> str:
    """"elf-drow-lineage-xphb", "dragonborn-red-phb" (the race name isn't repeated)."""
    race_slug = c.slug(race["name"])
    sub_slug = c.slug(sub.get("name") or "Standard")
    if sub_slug.startswith(race_slug + "-"):          # "Dragonborn (Red)" -> "red"
        sub_slug = sub_slug[len(race_slug) + 1:]
    return f"{race_slug}-{sub_slug}-{str(sub.get('source') or race['source']).lower()}"


def _subrace(sub: dict, race: dict, race_id: str, problems: list) -> dict:
    p: list = []
    named = sub.get("name") or "Standard"
    out = c.header({**sub, "name": named}, "subrace", p)
    out["id"] = subrace_id(sub, race)
    out["edition"] = sub.get("edition") or race.get("edition") or "classic"
    if not sub.get("name") and out.get("srd"):
        # A nameless "Standard" subrace is the race itself in the SRD.
        out["srd"] = {v: (race["name"] if n == named else n) for v, n in out["srd"].items()}

    size = _sizes(sub.get("size"), p)
    if size:
        out["size"] = size
    grants, choices = _grants(sub, p)
    c.assign_ids(choices)
    out["grants"] = grants
    out["choices"] = choices

    replaces = []
    for k in (sub.get("overwrite") or {}):
        if k in REPLACES:
            if REPLACES[k] not in replaces:
                replaces.append(REPLACES[k])
        elif k not in REPLACES_IGNORED:
            p.append(f"overwrite: unknown key '{k}'")
    if replaces:
        out["replaces"] = replaces
    if sub.get("entriesRemoved"):
        out["replaces_text"] = list(sub["entriesRemoved"])

    c.unhandled(sub, SUBRACE_HANDLED, DROPPED, p)
    problems += [f"subrace {named}: {x}" for x in p]
    return out


def clean_race(entry: dict) -> tuple[dict | None, list[str]]:
    problems: list[str] = []
    out = c.header(entry, "race", problems)
    out["size"] = _sizes(entry.get("size"), problems) or []
    if not out["size"]:
        problems.append("no size")
    if entry.get("creatureTypes"):
        out["creature_types"] = list(entry["creatureTypes"])

    grants, choices = _grants(entry, problems)
    c.assign_ids(choices)
    out["grants"] = grants
    out["choices"] = choices

    subs = [_subrace(s, entry, out["id"], problems) for s in entry.get("subraces") or []]
    if subs:
        ids = [s["id"] for s in subs]
        for dup in {i for i in ids if ids.count(i) > 1}:
            problems.append(f"two subraces with id '{dup}'")
        out["subraces"] = subs

    c.unhandled(entry, RACE_HANDLED, DROPPED, problems)

    try:
        return dump(Race.model_validate(out)), problems
    except ValidationError as e:
        problems += [f"schema: {'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]
        return None, problems
