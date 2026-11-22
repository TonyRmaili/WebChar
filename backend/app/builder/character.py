"""From the wizard's payload to a saved character (claude/character-plan.md).

    make(payload, cat, rng)  -> {character, open, problems, derived}
        `character` is the save file. With `random` on, every gap is
        filled first (autofill.complete); with it off the character keeps
        whatever is still open, and the sheet can flag it later.

    preview(payload, cat, rng) -> what the wizard shows while picking:
        the layers with their picks, what's still open (with the choice to
        draw), problems and the derived numbers. Nothing is saved.

    unique_name(folder, name) -> "Thaldrin", "Thaldrin 2", "Thaldrin 3"…

The payload (BuildWizard):

    {"name", "random": bool, "target_level": None | 5 | "random",
     "abilities": {"method", "base": {str: 15 | None, …}},
     "hp": {"mode": "average" | "roll" | "manual", "manual", "rolls"},
     "layers": [{"from": "race:elf-xphb", "picks": {…}}, …],
     "destinations": {"character": true, "npc": false, "party": false, "campaign": "Saltmarsh"}}
"""

import random
import uuid
from copy import deepcopy

try:
    from app.builder.autofill import _have, complete
    from app.builder.build import build
    from app.builder.derive import _table, ability_scores, class_levels, derive, words
    from app.formulas import evaluate
    from app.builder.options import described
    from app.builder.prereqs import state_of
except ImportError:  # run from this folder
    from autofill import _have, complete
    from build import build
    from derive import _table, ability_scores, class_levels, derive, words
    from formulas import evaluate
    from options import described
    from prereqs import state_of

FILE_VERSION = 2

EMPTY_PROFILE = {
    "alignment": {"prefix": "", "suffix": ""}, "size": "",
    "appearance": "", "age": "", "height": "", "weight": "",
    "personality_traits": "", "ideals": "", "bonds": "", "flaws": "", "backstory": "",
}

# The player's own layer: what they add or change by hand on the sheet
# (derive.py reads it). Rebuilding the other layers never touches it.
EMPTY_MANUAL = {
    "from": "manual", "label": "Your changes",
    "grants": {}, "removes": {}, "modifiers": [], "custom_skills": {},
    "features": [], "spells": [],
    "slot_overrides": {}, "pact_overrides": {}, "resources": [], "spell_ability": None,
}

# What the sheet keeps of a class or subclass record: enough to work out
# HP, slots, resources and formula words without the catalogue (a copy,
# like features and items, so a deleted homebrew class can't break it).
CLASS_COPY_KEYS = ("id", "kind", "class_id", "name", "short_name", "source", "edition", "hit_die", "hp",
                   "saves", "columns", "resources", "spellcasting", "subclass")

# Live values. "used" counts (not "left") so a level up or a new max never
# has to touch them: nothing used = everything is there.
EMPTY_STATE = {
    "hp_current": None,          # None = at max
    "hp_temp": 0,
    "hp_barrier": 0,             # takes damage before temp HP (Arcane Ward)
    "hit_dice_used": {},         # {"d10": 1}
    "slots_used": {},            # {"1": 2} by spell level
    "pact_slots_used": {},       # {"3": 1} by slot level
    "resources_used": {},        # {"focus_points": 3}
    "uses_used": {},             # {"<layer from>#<feature or spell id>": 1}
    "conditions": [],
    "exhaustion": 0,
    "death_saves": {"ok": 0, "fail": 0},
    "concentration": None,
}


def _new_id():
    return uuid.uuid4().hex[:12]


def class_records(layers, cat):
    """The class and subclass records a character uses, by id (for derive)."""
    out = {}
    for cid, _, sub in class_levels({"layers": layers}):
        out[cid] = cat.get("classes", cid)
        if sub:
            out[sub] = cat.get("subclasses", sub)
    return {k: v for k, v in out.items() if v}


def class_copies(layers, cat):
    """The `classes` block of the save file: each class record cut down to
    CLASS_COPY_KEYS."""
    return {k: {f: deepcopy(v[f]) for f in CLASS_COPY_KEYS if f in v} for k, v in class_records(layers, cat).items()}


def prepared_max(ch, cid, lvl):
    """How many spells class `cid` at `lvl` may have prepared, or None
    when it has no limit (a 2014 known caster: every known spell is ready)."""
    rec = (ch.get("classes") or {}).get(cid) or {}
    sc = rec.get("spellcasting") or {}
    if sc.get("known") is not None or sc.get("prepared") is None:
        return None
    t = sc["prepared"]
    if isinstance(t, dict):
        v = _table(t, lvl)
    else:
        v = evaluate(t, words(ch, ability_scores(ch), rec, lvl, sc.get("ability")), lvl)
    return v if isinstance(v, int) else None


def settle_prepared(ch, fresh):
    """New class spells (ids of the copies in `fresh`) land prepared while
    the class has room (its prepared count at its level), the rest
    unprepared: a Wizard's spellbook holds more than it prepares. Spells
    the character already had keep their state and count first.
    Cantrips and spells the class didn't pick (a subclass's) aren't counted."""
    levels = {c: l for c, l, _ in class_levels(ch)}
    used = {}
    later = []
    for layer in ch.get("layers") or []:
        for s in layer.get("spells") or []:
            cid = (s.get("granted") or {}).get("class")
            if cid not in levels or not s.get("level"):
                continue
            if id(s) in fresh:
                later.append((cid, s))
            elif s.get("prepared") is not False:
                used[cid] = used.get(cid, 0) + 1
    limits = {}
    for cid, s in later:
        if cid not in limits:
            limits[cid] = prepared_max(ch, cid, levels[cid])
        room = limits[cid] is None or used.get(cid, 0) < limits[cid]
        s["prepared"] = bool(room)
        if room:
            used[cid] = used.get(cid, 0) + 1


def _settle(payload, cat, rng):
    """The picks to save (randomized when asked) and the build made from them."""
    data = {
        "layers": deepcopy(payload.get("layers") or []),
        "abilities": deepcopy(payload.get("abilities") or {"method": "standard", "base": {}}),
        "hp": deepcopy(payload.get("hp") or {"mode": "average"}),
        "target_level": payload.get("target_level") if payload.get("random") else None,
    }
    if payload.get("random"):
        out = complete(data, cat, rng or random.Random())
        return out["layers"], out["abilities"], out["hp"], out["built"]
    built = build(data["layers"], cat, (data["abilities"] or {}).get("base"))
    return data["layers"], data["abilities"], data["hp"], built


def make(payload, cat, rng=None):
    layers_in, abilities, hp, built = _settle(payload, cat, rng)
    items = []
    for it in built["items"]:
        row = dict(it, id=_new_id())
        items.append(row)
    character = {
        "version": FILE_VERSION,
        "name": str(payload.get("name") or "").strip(),
        "profile": dict(EMPTY_PROFILE),
        "abilities": abilities,
        "hp": hp,
        "layers": built["layers"] + [deepcopy(EMPTY_MANUAL)],
        "classes": class_copies(built["layers"], cat),
        "inventory": {"items": items, "currency": dict(built["currency"])},
        "state": deepcopy(EMPTY_STATE),
        "exp": 0,
        "lore": {"notes": []},
    }
    settle_prepared(character, {id(s) for l in character["layers"] for s in l.get("spells") or []})
    sheet = {"abilities": abilities, "hp": hp, "layers": built["layers"], "inventory": character["inventory"]}
    return {
        "character": character,
        "open": built["open"],
        "problems": built["problems"],
        "derived": derive(sheet, class_records(built["layers"], cat)),
        "picks": layers_in,
        "built": built,
    }


def preview(payload, cat, rng=None):
    """What the wizard draws: compact layers (no feature or spell copies),
    every open choice with the choice itself, problems, derived numbers."""
    made = make(payload, cat, rng)
    ch = made["character"]
    built = made["built"]
    have = _have(built)
    state = state_of(built, (ch["abilities"] or {}).get("base"), cat)
    missing = {(o["from"], o["path"]): o["missing"] for o in built["open"]}
    return {
        "choices": [_choice_view(c, missing, cat, have, state) for c in built["choices"]],
        "layers": [{k: l.get(k) for k in ("from", "via", "label", "picks", "grants") if l.get(k) is not None} for l in ch["layers"]],
        "abilities": ch["abilities"],
        "hp": ch["hp"],
        "open": made["open"],
        "problems": made["problems"],
        "derived": made["derived"],
        "spells": [{"id": s.get("id"), "name": s.get("name"), "level": s.get("level"), "from": l["from"],
                    "class": (s.get("granted") or {}).get("class"), "prepared": s.get("prepared")}
                   for l in ch["layers"] for s in l.get("spells") or []],
        # What each layer gives, for the "What you get" column.
        "features": [{"from": l["from"], "id": f.get("id"), "name": f.get("name"), "level": f.get("level"),
                      "text": f.get("text") or "", "category": f.get("category")}
                     for l in ch["layers"] for f in l.get("features") or []],
        "items": [{"name": i.get("name"), "qty": i.get("qty"), "equipped": bool(i.get("equipped"))} for i in ch["inventory"]["items"]],
        "currency": ch["inventory"]["currency"],
    }


def _choice_view(c, missing, cat, have, state):
    """One choice as the wizard draws it."""
    ch = c["choice"]
    kind = ch.get("type") or ("bundle" if ch.get("options") else "ability" if ch.get("bonus_sets") else "pool")
    view = {
        "from": c["from"], "path": c["path"], "id": ch.get("id"), "type": kind,
        "label": ch.get("label"), "grant": ch.get("grant"), "count": ch.get("count") or 1,
        "picked": c["picked"], "missing": missing.get((c["from"], c["path"]), 0),
    }
    if kind == "bundle":
        view["options"] = [{"value": o.get("id"), "label": o.get("label") or o.get("name") or o.get("id")} for o in ch.get("options") or []]
    elif kind == "ability":
        view["from_abilities"] = ch.get("from") or ["str", "dex", "con", "int", "wis", "cha"]
        view["bonus_sets"] = ch.get("bonus_sets") or [[1]]
    else:
        picked = c["picked"] if isinstance(c["picked"], list) else ([c["picked"]] if c["picked"] else [])
        view["options"] = described(ch, cat, have, state, picked)
    return view


def unique_name(folder, name):
    """A name not used by a .json file in `folder` yet: "Thaldrin", "Thaldrin 2", …"""
    taken = {p.stem.lower() for p in folder.glob("*.json")} if folder.exists() else set()
    if name.lower() not in taken:
        return name
    n = 2
    while f"{name} {n}".lower() in taken:
        n += 1
    return f"{name} {n}"
