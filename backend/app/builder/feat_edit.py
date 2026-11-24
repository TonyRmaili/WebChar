"""The player's own version of a feat on a saved character (the sheet's
Feats & Options tab: "edit" on a whole feat).

    edit_feat(ch, frm, entry, cat) -> {character, open, problems}

`frm` is the feat's layer ("feat:grappler-xphb"); `entry` is the edited
feat record (the feat form's), or None to go back to the catalogue's.
The record is kept on the layer as `entry`, so every later build (level
up, a new race or background) uses it too (build._Builder.part_for).

The character is built again from its picks the way the leveler does it
(level.reconcile), with one difference for this feat's layer: its
features and spells come from the new record, except copies the player
changed on the sheet (`edited`) or added (`own`), which stay. Switches
(shown in Play, on, taken off) carry over by id.
"""

from copy import deepcopy

try:
    from app.builder.build import build
    from app.builder.character import settle_prepared
    from app.builder.level import _new_froms, _with_layers, reconcile, recipe
except ImportError:  # run from this folder
    from build import build
    from character import settle_prepared
    from level import _new_froms, _with_layers, reconcile, recipe

FLAGS = ("active", "on", "removed", "prepared", "riders")  # riders: the ones attached to it in Play


def edit_feat(ch, frm, entry, cat):
    layers = deepcopy(ch.get("layers") or [])
    target = next((l for l in layers if l.get("from") == frm), None)
    if target is None or not str(frm).startswith("feat:"):
        raise ValueError(f"no feat layer {frm}")
    if entry:
        target["entry"] = deepcopy(entry)
    else:
        target.pop("entry", None)
    built = build(recipe({**ch, "layers": layers}), cat, (ch.get("abilities") or {}).get("base"))

    # This feat (and feats it gave): only the sheet's own changes stay.
    mine = _new_froms(layers, frm)
    flags = {}
    for l in layers:
        if l.get("from") not in mine:
            continue
        for key in ("features", "spells"):
            keep = []
            for x in l.get(key) or []:
                if not isinstance(x, dict):
                    continue
                if x.get("edited") or x.get("own"):
                    keep.append(x)
                elif x.get("id"):
                    flags[(l["from"], key, x["id"])] = {k: x[k] for k in FLAGS if k in x}
            l[key] = keep
    if not entry:
        target.pop("entry", None)

    out_layers, fresh = reconcile([l for l in layers if l.get("from") != "manual"], built["layers"], built["problems"])
    for l in out_layers:
        if l.get("from") not in mine:
            continue
        if l.get("from") == frm and not entry:
            l.pop("entry", None)
        for key in ("features", "spells"):
            l[key] = [{**x, **flags.get((l["from"], key, x.get("id")), {})} if isinstance(x, dict) else x for x in l.get(key) or []]
    out = _with_layers(ch, out_layers, cat)
    settle_prepared(out, {id(s) for s in fresh})
    return {"character": out,
            "open": [o for o in built["open"] if o["from"] in mine],
            "problems": [p for p in built["problems"] if p.get("from") in mine]}
