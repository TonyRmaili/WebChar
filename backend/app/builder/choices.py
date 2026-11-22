"""The builder's core: an entry's grants and choices + the player's picks
-> what the character gets, and what is still open.

Every catalogue entry (race, subrace, background, feat, class level…)
has `grants` (you have this) and `choices` (you pick), data-model §2:

    pool     {"type": "pool", "id", "grant", "count", "from"}
             pick: a list of values                    ["insight", "religion"]
    ability  {"type": "ability", "id", "from", "bonus_sets": [[2, 1], [1, 1, 1]]}
             pick: {ability: amount}                    {"wis": 2, "cha": 1}
    bundle   {"type": "bundle", "id", "options": [{id, grants, choices, features}]}
             pick: an option id                         "a"

Picks are kept per layer (see claude/character-plan.md), keyed by the
choice's own id. A choice inside a bundle option or a feature uses a
path: "equipment/a/tools", "feature:keen-senses/skill".

resolve(part, picks, level) gives back
    grants    everything given, picks included, merged into one grants dict
    choices   every choice met on the way, {path, choice, picked} (the wizard draws these)
    open      the choices still without a (full) answer: {path, choice, missing}
    problems  picks that don't fit their choice (wrong value, wrong count…)

Nothing is randomized here and nothing is read from other catalogues: a
pick naming a spell, feat or item id is taken as it is (the builder
checks ids against the catalogue). `{"choice": "<id>"}` inside a grant
("the spellcasting ability you picked") is replaced by that pick.
"""

from copy import deepcopy

# Pools whose `from` is a named group (or contains one) can't be checked
# here: the group's members live in another table or catalogue.
GROUP_NAMES = {
    "all", "all_skills", "all_tools", "all_languages", "all_feats", "standard_languages", "rare_languages",
    "artisans_tools", "gaming_sets", "musical_instruments", "simple_weapons", "martial_weapons",
}
SKILLS = {
    "acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
    "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion",
    "sleight_of_hand", "stealth", "survival",
}
ABILITIES = ("str", "dex", "con", "int", "wis", "cha")

# How each grant kind merges.
SET_KINDS = {"skills", "saves", "tools", "languages", "weapons", "armor", "expertise", "weapon_masteries",
             "optional_features", "spell_lists"}
APPEND_KINDS = {"spells", "feats", "items"}
ADD_KINDS = {"ability", "currency"}
HIGHER_KINDS = {"speed", "senses"}


# ─── merging grants ───────────────────────────────────────────────

def _union(old, new):
    out = list(old or [])
    for v in new or []:
        if v not in out:
            out.append(v)
    return out


def merge_grants(into: dict, add: dict) -> dict:
    """Add one grants dict to another (in place, and returned)."""
    for kind, value in (add or {}).items():
        if value is None or value == [] or value == {}:
            continue
        if kind in SET_KINDS:
            into[kind] = _union(into.get(kind), value)
        elif kind in APPEND_KINDS:
            into[kind] = list(into.get(kind) or []) + deepcopy(list(value))
        elif kind in ADD_KINDS:
            cur = dict(into.get(kind) or {})
            for k, n in value.items():
                cur[k] = cur.get(k, 0) + n if isinstance(n, (int, float)) else n
            into[kind] = cur
        elif kind in HIGHER_KINDS:
            cur = dict(into.get(kind) or {})
            for k, n in value.items():
                old = cur.get(k)
                cur[k] = n if not (isinstance(old, (int, float)) and isinstance(n, (int, float))) else max(old, n)
            into[kind] = cur
        elif kind == "defenses":
            cur = dict(into.get(kind) or {})
            for k, types in value.items():
                cur[k] = _union(cur.get(k), types)
            into[kind] = cur
        else:  # spell_ability, hp, ac, subclass, …: the latest wins
            into[kind] = deepcopy(value)
    return into


# ─── one pick -> grants ───────────────────────────────────────────

def _pool_grant(choice: dict, value) -> dict:
    """The grants one picked value of a pool gives."""
    kind = choice.get("grant")
    if isinstance(kind, list):  # "skills or tools": the value says which
        kind = "skills" if value in SKILLS else next((k for k in kind if k != "skills"), kind[0])
    if kind == "spells":
        spell = {"spell": value}
        for key in ("how", "at", "uses", "ability", "cast_at", "class"):
            if choice.get(key) is not None:
                spell[key] = deepcopy(choice[key])
        return {"spells": [spell]}
    if kind == "feats":
        return {"feats": [{"feat": value}]}
    if kind == "items":
        return {"items": [{"item": value, "qty": 1}]}
    if isinstance(kind, str) and kind.startswith("defenses."):
        return {"defenses": {kind.split(".", 1)[1]: [value]}}
    if kind in SET_KINDS:
        return {kind: [value]}
    return {kind: value}  # spell_ability, subclass, size, …


def _checkable(frm) -> bool:
    return isinstance(frm, list) and not any(
        isinstance(v, str) and (v in GROUP_NAMES or v.startswith(("all_", "martial_weapons", "simple_weapons")))
        for v in frm
    )


def _pick_pool(choice, pick, path, out):
    count = choice.get("count") or 1
    values = pick if isinstance(pick, list) else ([] if pick is None else [pick])
    if len(values) > count:
        out["problems"].append({"path": path, "problem": f"{len(values)} picked, {count} allowed"})
        values = values[:count]
    if len(set(map(str, values))) < len(values):
        out["problems"].append({"path": path, "problem": "the same value picked twice"})
    frm = choice.get("from")
    good = 0
    for v in values:
        if _checkable(frm) and v not in frm:
            out["problems"].append({"path": path, "problem": f"{v!r} is not one of the options"})
            continue
        merge_grants(out["grants"], _pool_grant(choice, v))
        good += 1
    if good < count:
        out["open"].append({"path": path, "choice": choice, "missing": count - good})


def _pick_ability(choice, pick, path, out):
    if not pick:
        out["open"].append({"path": path, "choice": choice, "missing": 1})
        return
    allowed = choice.get("from") or list(ABILITIES)
    amounts = sorted((n for n in pick.values()), reverse=True)
    sets = [sorted(s, reverse=True) for s in choice.get("bonus_sets") or []]
    if any(a not in allowed for a in pick) or (sets and amounts not in sets):
        out["problems"].append({"path": path, "problem": f"{pick} doesn't fit {allowed} with {choice.get('bonus_sets')}"})
        out["open"].append({"path": path, "choice": choice, "missing": 1})
        return
    merge_grants(out["grants"], {"ability": dict(pick)})


def _pick_bundle(choice, picks, path, level, out):
    pick = picks.get(path)
    option = next((o for o in choice.get("options") or [] if o.get("id") == pick), None)
    if pick is not None and option is None:
        out["problems"].append({"path": path, "problem": f"no option {pick!r}"})
    if option is None:
        out["open"].append({"path": path, "choice": choice, "missing": 1})
        return
    _walk(option, picks, f"{path}/{option['id']}", level, out)


# ─── walking an entry ─────────────────────────────────────────────

def _walk(part, picks, prefix, level, out):
    merge_grants(out["grants"], part.get("grants"))
    for choice in part.get("choices") or []:
        path = f"{prefix}/{choice['id']}" if prefix else choice["id"]
        out["choices"].append({"path": path, "choice": choice, "picked": picks.get(path)})
        kind = choice.get("type") or ("bundle" if choice.get("options") else "ability" if choice.get("bonus_sets") else "pool")
        if kind == "bundle":
            _pick_bundle(choice, picks, path, level, out)
        elif kind == "ability":
            _pick_ability(choice, picks.get(path), path, out)
        else:
            _pick_pool(choice, picks.get(path), path, out)
    # A feature's own grants and choices count once its level is reached.
    for feature in part.get("features") or []:
        if level is not None and (feature.get("level") or 1) > level:
            continue
        if feature.get("grants") or feature.get("choices"):
            fprefix = f"{prefix}/feature:{feature.get('id')}" if prefix else f"feature:{feature.get('id')}"
            _walk({"grants": feature.get("grants"), "choices": feature.get("choices")}, picks, fprefix, level, out)


def _fill_refs(value, picks):
    """{"choice": "spell_ability"} -> what was picked there (when it was)."""
    if isinstance(value, dict):
        if set(value) == {"choice"}:
            got = picks.get(value["choice"])
            if isinstance(got, list):
                got = got[0] if got else None
            return got if got is not None else value
        return {k: _fill_refs(v, picks) for k, v in value.items()}
    if isinstance(value, list):
        return [_fill_refs(v, picks) for v in value]
    return value


def resolve(part: dict, picks: dict | None = None, level: int | None = None) -> dict:
    """See the module notes. `level` hides features above it (None = all)."""
    picks = picks or {}
    out = {"grants": {}, "open": [], "problems": [], "choices": []}
    _walk(part or {}, picks, "", level, out)
    out["grants"] = _fill_refs(out["grants"], picks)
    return out


def open_choices(part: dict, picks: dict | None = None, level: int | None = None) -> list:
    """Only the open choices (for the wizard's "still to pick" and the randomizer)."""
    return resolve(part, picks, level)["open"]
