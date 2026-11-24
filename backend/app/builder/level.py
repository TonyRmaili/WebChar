"""The class leveler: one class level up or down on a saved character
(the sheet's General tab).

    preview_level(ch, class_id, payload, cat, rng) -> what the level-up form draws
    apply_level(ch, class_id, payload, cat, rng)   -> the character with the level
    level_down(ch, class_id, cat)                  -> the character without its top level

`payload` (the level-up form):

    {"layers": [{"from": "class:wizard-xphb@4", "picks": {…}},
                {"from": "feat:alert-xphb", "via": "class:wizard-xphb@4", "picks": {…}}],
     "random": false,                 fill whatever is still open
     "hp": {"how": "average" | "roll" | "set", "value": 7}}

Leveling never rebuilds the character from scratch in a way the player
would notice: the layers are built again from their picks (so a first
class that changes, or a race spell reached at the new character level,
come out right), then every feature and spell copy the old layers already
had is kept as it was (edits, hidden, prepared, notes). Only what is new
is added, and on the way down only what the level gave goes. The manual
layer, the inventory and everything in `state` but the removed level's
used counts stay.

Requirements (multiclass ability scores) only warn: the sheet never blocks.
"""

import random
import re
from copy import deepcopy

try:
    from app.builder.autofill import _Filler, _have
    from app.builder.build import build
    from app.builder.character import class_copies, settle_prepared, _choice_view, _new_id
    from app.builder.derive import ability_scores, class_levels, derive
    from app.builder.prereqs import state_of
    from app.builder.randomize import priority
except ImportError:  # run from this folder
    from autofill import _Filler, _have
    from build import build
    from character import class_copies, settle_prepared, _choice_view, _new_id
    from derive import ability_scores, class_levels, derive
    from prereqs import state_of
    from randomize import priority

_CLASS = re.compile(r"^class:([^@/]+)@(\d+)$")
BUILT = ("race:", "background:", "feat:", "class:")
ABILITY_NAMES = {"str": "Str", "dex": "Dex", "con": "Con", "int": "Int", "wis": "Wis", "cha": "Cha"}


def _built(layer):
    return str(layer.get("from") or "").startswith(BUILT)


def recipe(ch):
    """The picks the character was built from: every layer the builder
    makes, as {from, via?, picks, entry?}."""
    out = []
    for l in ch.get("layers") or []:
        if _built(l):
            r = {"from": l["from"], "picks": deepcopy(l.get("picks") or {})}
            if l.get("via"):
                r["via"] = l["via"]
            if l.get("entry"):
                r["entry"] = deepcopy(l["entry"])   # the player's own version of the feat (feat_edit)
            out.append(r)
    return out


def _levels(ch):
    return {cid: lvl for cid, lvl, _ in class_levels(ch)}


def next_from(ch, class_id):
    return f"class:{class_id}@{_levels(ch).get(class_id, 0) + 1}"


def _new_froms(layers, root):
    """`root` (one from, or several) and every layer that came through it
    (feats `via` it, feats via those)."""
    out = {root} if isinstance(root, str) else set(root)
    grew = True
    while grew:
        grew = False
        for l in layers:
            if l.get("via") in out and l["from"] not in out:
                out.add(l["from"])
                grew = True
    return out


def _skeleton(ch, class_id, payload):
    root = next_from(ch, class_id)
    new = [dict(l) for l in (payload or {}).get("layers") or [] if l.get("from")]
    if not any(l["from"] == root for l in new):
        new.insert(0, {"from": root, "picks": {}})
    for l in new:
        l["picks"] = deepcopy(l.get("picks") or {})
        if l["from"] != root and not l.get("via"):
            l["via"] = root
    return root, recipe(ch) + [l for l in new if l["from"] == root or l.get("via")]


def _fill_new(skeleton, ch, cat, rng, root):
    """Answer every open choice of the new layers (only theirs)."""
    f = _Filler({"layers": skeleton, "abilities": deepcopy(ch.get("abilities") or {}), "hp": {}}, cat, rng)
    classes = [cat.get("classes", cid) for cid in _levels({"layers": skeleton})]
    _, tiers = priority([c for c in classes if c], (ch.get("abilities") or {}).get("base") or {})
    built = f.fill_choices(tiers, only=lambda frm, layers: frm in _new_froms(layers, root))
    return f.layers, built


def _build(ch, class_id, payload, cat, rng):
    root, skeleton = _skeleton(ch, class_id, payload)
    if (payload or {}).get("random"):
        skeleton, built = _fill_new(skeleton, ch, cat, rng or random.Random(), root)
    else:
        built = build(skeleton, cat, (ch.get("abilities") or {}).get("base"))
    return root, skeleton, built


# ─── requirements (warnings only) ─────────────────────────────────

def _requires_text(cls, scores):
    """'Wizard needs Int 13 (you have 10)', or None when met."""
    groups = ((cls or {}).get("multiclass") or {}).get("requires") or []
    if not groups or any(all(scores.get(a, 0) >= n for a, n in g.items()) for g in groups):
        return None
    need = " or ".join(" and ".join(f"{ABILITY_NAMES.get(a, a)} {n}" for a, n in g.items()) for g in groups)
    have = ", ".join(sorted({f"{ABILITY_NAMES.get(a, a)} {scores.get(a, 0)}" for g in groups for a in g}))
    return f"{cls.get('name') or cls.get('id')} needs {need} to multiclass (you have {have})."


def warnings_for(ch, class_id, cat):
    """A new class on a character that has others: the new class's and
    every current class's multiclass requirements."""
    levels = _levels(ch)
    if levels.get(class_id) or not levels:
        return []
    scores = ability_scores(ch)
    out = []
    for cid in [class_id] + list(levels):
        msg = _requires_text(cat.get("classes", cid), scores)
        if msg:
            out.append(msg)
    return out


# ─── keeping what the old layers had ──────────────────────────────

def reconcile(old_layers, built_layers, problems):
    """The built layers, each keeping the old copies of its features and
    spells (by id), the ones the player added to it (`own`), and anything
    else the old layer had that a build doesn't make. A layer whose record is gone from the catalogue stays
    as it was. Returns (layers, new spell copies)."""
    old = {l.get("from"): l for l in old_layers}
    gone = {p.get("from") for p in problems or [] if p.get("problem") == "not in the catalogue"}
    out, fresh = [], []
    for nl in built_layers:
        ol = old.get(nl["from"])
        if ol is not None and nl["from"] in gone:
            out.append(ol)
            continue
        if ol is None:
            out.append(nl)
            fresh += nl.get("spells") or []
            continue
        merged = dict(nl)
        for key in ("features", "spells"):
            prev = {x.get("id"): x for x in ol.get(key) or [] if isinstance(x, dict) and x.get("id")}
            keep = []
            for x in nl.get(key) or []:
                if x.get("id") in prev:
                    keep.append(prev.pop(x["id"]))
                else:
                    keep.append(x)
                    if key == "spells":
                        fresh.append(x)
            # What the player added to this layer (`own`: a homebrew racial
            # trait) stays with it; it goes only when the layer goes.
            keep += [x for x in prev.values() if x.get("own")]
            merged[key] = keep
        for k, v in ol.items():
            if k not in merged:
                merged[k] = v
        out.append(merged)
    return out, fresh


def _rest(ch):
    """The layers a build doesn't make (manual), in their order."""
    return [l for l in ch.get("layers") or [] if not _built(l)]


def _with_layers(ch, layers, cat):
    out = deepcopy(ch)
    out["layers"] = layers + deepcopy(_rest(ch))
    copies = class_copies(layers, cat)
    old = ch.get("classes") or {}
    used = {x for cid, _, sub in class_levels(out) for x in (cid, sub) if x}
    for k in used:  # a class gone from the catalogue keeps its copy
        if k not in copies and k in old:
            copies[k] = old[k]
    out["classes"] = copies
    return out


# ─── preview ──────────────────────────────────────────────────────

def _features_of(layers, froms):
    out = []
    for l in layers:
        if l["from"] not in froms:
            continue
        for f in l.get("features") or []:
            out.append({"from": l["from"], "id": f.get("id"), "name": f.get("name"), "level": f.get("level"),
                        "text": f.get("text") or "", "category": f.get("category")})
    return out


def _spells_of(layers, froms):
    return [{"from": l["from"], "id": s.get("id"), "name": s.get("name"), "level": s.get("level"),
             "how": (s.get("granted") or {}).get("how"), "class": (s.get("granted") or {}).get("class")}
            for l in layers if l["from"] in froms for s in l.get("spells") or []]


def _hp_info(ch, class_id, root, cat, after):
    cls = cat.get("classes", class_id) or (ch.get("classes") or {}).get(class_id) or {}
    die = str(cls.get("hit_die") or "d8")
    w_after = derive(after)
    con = (w_after.get("abilities") or {}).get("con", {}).get("mod", 0)
    probe = deepcopy(after)
    probe.setdefault("hp", {})
    for k in ("rolls", "set"):
        probe["hp"][k] = {kk: v for kk, v in (probe["hp"].get(k) or {}).items() if kk != root}
    avg_total = derive(probe)["hp_max"]
    before = derive(ch)["hp_max"]
    return {"die": die, "sides": int(die[1:]) if die[1:].isdigit() else 8, "con_mod": con,
            "average": avg_total - before, "hp_max_before": before, "hp_max_after": w_after["hp_max"],
            "manual": (ch.get("hp") or {}).get("mode") == "manual"}


def preview_level(ch, class_id, payload, cat, rng=None):
    root, skeleton, built = _build(ch, class_id, payload, cat, rng)
    layers, _ = reconcile(ch.get("layers") or [], built["layers"], built["problems"])
    after = _with_hp(_with_layers(ch, layers, cat), root, (payload or {}).get("hp"))
    froms = _new_froms(layers, root)
    have = _have(built)
    state = state_of(built, (ch.get("abilities") or {}).get("base"), cat)
    missing = {(o["from"], o["path"]): o["missing"] for o in built["open"]}
    return {
        "from": root,
        "level": int(root.rsplit("@", 1)[1]),
        "layers": [{k: l.get(k) for k in ("from", "via", "label", "picks") if l.get(k) is not None}
                   for l in skeleton if l["from"] in froms],
        "choices": [_choice_view(c, missing, cat, have, state) for c in built["choices"] if c["from"] in froms],
        "open": [o for o in built["open"] if o["from"] in froms],
        "problems": [p for p in built["problems"] if p.get("from") in froms],
        "features": _features_of(layers, froms),
        "spells": _spells_of(layers, froms),
        "hp": _hp_info(ch, class_id, root, cat, after),
        "warnings": warnings_for(ch, class_id, cat),
    }


# ─── apply ────────────────────────────────────────────────────────

def _with_hp(ch, key, hp_in):
    """The new level's HP: the average (nothing stored), a roll, or the number the player set."""
    hp = dict(ch.get("hp") or {"mode": "average"})
    rolls = {k: v for k, v in (hp.get("rolls") or {}).items() if k != key}
    sets = {k: v for k, v in (hp.get("set") or {}).items() if k != key}
    how = (hp_in or {}).get("how")
    val = (hp_in or {}).get("value")
    if how == "roll" and isinstance(val, int):
        rolls[key] = val
    elif how == "set" and isinstance(val, int):
        sets[key] = val
    hp["rolls"], hp["set"] = rolls, sets
    out = dict(ch)
    out["hp"] = hp
    return out


def apply_level(ch, class_id, payload, cat, rng=None):
    """Returns {character, open, problems}."""
    root, skeleton, built = _build(ch, class_id, payload, cat, rng)
    layers, fresh = reconcile(ch.get("layers") or [], built["layers"], built["problems"])
    out = _with_layers(ch, layers, cat)
    froms = _new_froms(layers, root)
    hp_in = dict((payload or {}).get("hp") or {})
    if hp_in.get("how") == "roll" and not isinstance(hp_in.get("value"), int):
        sides = int(str((cat.get("classes", class_id) or {}).get("hit_die") or "d8")[1:] or 8)
        hp_in["value"] = (rng or random.Random()).randint(1, sides)
    out = _with_hp(out, root, hp_in)
    # The new layers' gear (a first class's starting equipment).
    inv = out.setdefault("inventory", {"items": [], "currency": {}})
    for it in built["items"]:
        if it.get("from") in froms:
            inv.setdefault("items", []).append(dict(it, id=_new_id()))
    settle_prepared(out, {id(s) for s in fresh})
    return {"character": out,
            "open": [o for o in built["open"] if o["from"] in froms],
            "problems": [p for p in built["problems"] if p.get("from") in froms]}


# ─── down ─────────────────────────────────────────────────────────

def level_down(ch, class_id, cat):
    """The character without `class_id`'s top level and what it gave:
    its layer, the feats that came through it, their used counts, its HP
    roll or set number, and (when it was the class's last level) the class.
    Spells and features of other layers past the new character level go
    too. Returns the character (unchanged when the class isn't there)."""
    lvl = _levels(ch).get(class_id)
    if not lvl:
        return deepcopy(ch)
    root = f"class:{class_id}@{lvl}"
    gone = _new_froms(ch.get("layers") or [], root)
    skeleton = [l for l in recipe(ch) if l["from"] not in gone]
    built = build(skeleton, cat, (ch.get("abilities") or {}).get("base"))
    kept = [l for l in ch.get("layers") or [] if _built(l) and l["from"] not in gone]
    layers, _ = reconcile(kept, built["layers"], built["problems"])
    # Copies the old layers had that the smaller build no longer gives
    # (a race spell above the new level) went with reconcile: it keeps
    # only what the build still makes.
    out = _with_layers(ch, layers, cat)
    hp = dict(out.get("hp") or {})
    for k in ("rolls", "set"):
        if isinstance(hp.get(k), dict):
            hp[k] = {kk: v for kk, v in hp[k].items() if kk != root}
    out["hp"] = hp
    st = dict(out.get("state") or {})
    st["uses_used"] = {k: v for k, v in (st.get("uses_used") or {}).items() if k.split("#", 1)[0] not in gone}
    # Hit dice spent can't be more than the dice left.
    dice = derive(out).get("hit_dice") or {}
    st["hit_dice_used"] = {k: min(v, dice.get(k, 0)) for k, v in (st.get("hit_dice_used") or {}).items() if dice.get(k)}
    out["state"] = st
    return out
