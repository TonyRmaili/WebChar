"""Swapping the race or background of a saved character (the sheet's
Biography tab).

    preview_swap(ch, kind, payload, cat, rng) -> what the swap form draws
    apply_swap(ch, kind, payload, cat, rng)   -> {character, open, problems}

`kind` is "race" or "background". `payload`:

    {"layers": [{"from": "race:elf-xphb", "picks": {…}},
                {"from": "race:elf-xphb/subrace:elf-drow-xphb", "picks": {…}},
                {"from": "feat:alert-xphb", "via": "background:sage-xphb", "picks": {…}}],
     "random": false, "seed": 7,
     "gear": false}         also swap the starting gear (and gold) the old one gave

Everything carries `from`, so the old race (with its subrace) or the old
background goes with all it gave: its traits, spells, the feats that came
through it (a 2024 background's origin feat) and their used counts. The
rest of the character is built again from its picks the way the leveler
does it (level.reconcile): every other copy keeps its edits. The
inventory stays unless `gear` is on.
"""

import random
from copy import deepcopy

try:
    from app.builder.build import build
    from app.builder.character import settle_prepared, _choice_view, _new_id
    from app.builder.autofill import _have
    from app.builder.prereqs import state_of
    from app.builder.level import (_features_of, _fill_new, _new_froms, _spells_of, _with_layers, reconcile, recipe)
except ImportError:  # run from this folder
    from build import build
    from character import settle_prepared, _choice_view, _new_id
    from autofill import _have
    from prereqs import state_of
    from level import _features_of, _fill_new, _new_froms, _spells_of, _with_layers, reconcile, recipe

KINDS = ("race", "background")


def _is(kind, frm):
    return str(frm or "").startswith(kind + ":")


def _old_froms(ch, kind):
    layers = ch.get("layers") or []
    return _new_froms(layers, [l["from"] for l in layers if _is(kind, l.get("from"))])


def _skeleton(ch, kind, payload):
    """The recipe with the old race/background swapped for the new one,
    in the same place. Returns (new roots, skeleton)."""
    new = []
    for l in (payload or {}).get("layers") or []:
        if l.get("from") and (_is(kind, l["from"]) or l.get("via")):
            r = {"from": l["from"], "picks": deepcopy(l.get("picks") or {})}
            if l.get("via"):
                r["via"] = l["via"]
            new.append(r)
    roots = [l["from"] for l in new if _is(kind, l["from"])]
    new = [l for l in new if not l.get("via") or l["via"] in _new_froms(new, roots)]
    gone = _old_froms(ch, kind)
    rec = recipe(ch)
    at = next((i for i, l in enumerate(rec) if l["from"] in gone), None)
    kept = [l for l in rec if l["from"] not in gone]
    if at is None:  # nothing to replace: a race goes first, a background after the race
        at = 0 if kind == "race" else sum(1 for l in kept if _is("race", l["from"]))
    else:
        at = sum(1 for l in rec[:at] if l["from"] not in gone)
    return roots, kept[:at] + new + kept[at:]


def _build(ch, kind, payload, cat, rng):
    roots, skeleton = _skeleton(ch, kind, payload)
    if (payload or {}).get("random") and roots:
        skeleton, built = _fill_new(skeleton, ch, cat, rng or random.Random(), roots)
    else:
        built = build(skeleton, cat, (ch.get("abilities") or {}).get("base"))
    return roots, skeleton, built


def preview_swap(ch, kind, payload, cat, rng=None):
    roots, skeleton, built = _build(ch, kind, payload, cat, rng)
    layers, _ = reconcile([l for l in ch.get("layers") or [] if l["from"] not in _old_froms(ch, kind)], built["layers"], built["problems"])
    froms = _new_froms(layers, roots)
    have = _have(built)
    state = state_of(built, (ch.get("abilities") or {}).get("base"), cat)
    missing = {(o["from"], o["path"]): o["missing"] for o in built["open"]}
    old = [l for l in ch.get("layers") or [] if l["from"] in _old_froms(ch, kind)]
    return {
        "layers": [{k: l.get(k) for k in ("from", "via", "label", "picks") if l.get(k) is not None}
                   for l in skeleton if l["from"] in froms],
        "labels": {l["from"]: l.get("label") for l in layers if l["from"] in froms},
        "choices": [_choice_view(c, missing, cat, have, state) for c in built["choices"] if c["from"] in froms],
        "open": [o for o in built["open"] if o["from"] in froms],
        "problems": [p for p in built["problems"] if p.get("from") in froms],
        "features": _features_of(layers, froms),
        "spells": _spells_of(layers, froms),
        # what goes
        "losing": {"layers": [l.get("label") or l["from"] for l in old],
                   "features": [f.get("name") for l in old for f in l.get("features") or []],
                   "spells": [s.get("name") for l in old for s in l.get("spells") or []],
                   "gear": [it.get("name") for it in (ch.get("inventory") or {}).get("items") or []
                            if it.get("from") in _old_froms(ch, kind)]},
    }


def apply_swap(ch, kind, payload, cat, rng=None):
    if kind not in KINDS:
        raise ValueError(kind)
    gone = _old_froms(ch, kind)
    roots, skeleton, built = _build(ch, kind, payload, cat, rng)
    keep = [l for l in ch.get("layers") or [] if l["from"] not in gone]
    layers, fresh = reconcile(keep, built["layers"], built["problems"])
    out = _with_layers(ch, layers, cat)
    froms = _new_froms(layers, roots)
    st = dict(out.get("state") or {})
    st["uses_used"] = {k: v for k, v in (st.get("uses_used") or {}).items() if k.split("#", 1)[0] not in gone}
    out["state"] = st
    if (payload or {}).get("gear"):
        # The old one's gear goes; the new one's (and its gold) comes.
        inv = dict(out.get("inventory") or {})
        items = [it for it in inv.get("items") or [] if it.get("from") not in gone]
        alone = build([l for l in skeleton if l["from"] in froms], cat, (ch.get("abilities") or {}).get("base"))
        items += [dict(it, id=_new_id()) for it in alone["items"]]
        purse = dict(inv.get("currency") or {})
        for k, v in (alone.get("currency") or {}).items():
            purse[k] = purse.get(k, 0) + v
        inv["items"], inv["currency"] = items, purse
        out["inventory"] = inv
    settle_prepared(out, {id(s) for s in fresh})
    return {"character": out,
            "open": [o for o in built["open"] if o["from"] in froms],
            "problems": [p for p in built["problems"] if p.get("from") in froms]}
