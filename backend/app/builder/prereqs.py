"""Does a character meet a feat's (or an optional feature's) prerequisites?

The builder and randomizer stay legal; the sheet allows anything. So this
is only used when the randomizer picks a feat, an optional feature or an
epic boon. The wizard can use it to warn; it never blocks the player.

Prerequisites (data-model §4b) are a list of groups: any one group is
enough, every part inside a group is needed, and inside a part that is a
list any one item is enough.

    [{"level": 4, "ability": [{"str": 13}, {"dex": 13}]}, {"spellcasting": true}]

Parts the character can't be checked against (campaign, note, item) count
as met: there is nothing to check them with.

state_of(built, base_scores, cat) gathers what the checks need from a
build (build.build's answer).
"""

import re

try:
    from app.builder.derive import ability_scores, class_levels
except ImportError:  # run from this folder
    from derive import ability_scores, class_levels

ALWAYS_MET = {"campaign", "note", "item", "other"}


def _name(rec_id):
    """"human-xphb" -> "human"; "fighter-xphb:battle-master-xphb" -> "battle-master"."""
    last = str(rec_id or "").split(":")[-1]
    return re.sub(r"-[a-z0-9]+$", "", last)


def state_of(built, base_scores, cat):
    layers = built.get("layers") or []
    ch = {"abilities": {"base": base_scores or {}}, "layers": layers}
    levels = class_levels(ch)
    st = {
        "level": sum(l for _, l, _ in levels),
        "scores": ability_scores(ch),
        "classes": {_name(c): l for c, l, _ in levels},
        "subclasses": {_name(s) for _, _, s in levels if s},
        "races": set(),
        "backgrounds": set(),
        "feats": set(),
        "feat_categories": set(),
        "spells": set(),
        "optional_features": set(),
        "optional_feature_types": set(),
        "proficiencies": set(),
        "features": set(),
        "spellcasting": False,
    }
    for l in layers:
        frm = str(l.get("from") or "")
        g = l.get("grants") or {}
        if frm.startswith("race:"):
            for part in frm[5:].split("/subrace:"):
                st["races"].add(_name(part))
        elif frm.startswith("background:"):
            st["backgrounds"].add(frm[11:])
        elif frm.startswith("feat:"):
            fid = frm[5:]
            st["feats"].add(fid)
            cat_ = (cat.get("feats", fid) or {}).get("category")
            if cat_:
                st["feat_categories"].add(cat_)
        for sp in g.get("spells") or []:
            if isinstance(sp, dict):
                st["spells"].add(sp.get("spell"))
        for of in g.get("optional_features") or []:
            st["optional_features"].add(of)
            st["optional_feature_types"].update((cat.get("optionalfeatures", of) or {}).get("feature_types") or [])
        for kind in ("armor", "weapons", "tools", "skills"):
            st["proficiencies"].update(g.get(kind) or [])
        for f in l.get("features") or []:
            st["features"].add(_name(f.get("id")))
    for cid, _, sub in levels:
        for rec in (cat.get("classes", cid), cat.get("subclasses", sub) if sub else None):
            if ((rec or {}).get("spellcasting") or {}).get("progression"):
                st["spellcasting"] = True
    if st["spells"]:
        st["spellcasting"] = True
    # A fighting style taken as a feat or an optional feature counts as the feature.
    if "fighting_style" in st["feat_categories"] or "fighting_style" in st["optional_feature_types"]:
        st["features"].add("fighting_style")
    return st


def _any(items, test):
    items = items if isinstance(items, list) else [items]
    return any(test(x) for x in items)


def _part(kind, value, st):
    if kind in ALWAYS_MET:
        return True
    if kind == "level":
        return st["level"] >= (value if isinstance(value, int) else 0)
    if kind == "ability":
        return _any(value, lambda d: all(st["scores"].get(a, 0) >= n for a, n in d.items()))
    if kind == "class_level":
        def ok(d):
            have = st["classes"].get(_name(d.get("class")) if "-" in str(d.get("class")) else str(d.get("class", "")).lower())
            if have is None or have < (d.get("level") or 1):
                return False
            return not d.get("subclass") or _name(d["subclass"]) in st["subclasses"] or str(d["subclass"]).lower() in st["subclasses"]
        return _any(value, ok)
    if kind == "race":
        def ok(d):
            if isinstance(d, dict) and d.get("size"):
                return True  # size isn't tracked per race here
            r = d.get("race") if isinstance(d, dict) else d
            return str(r or "").lower() in st["races"] or _name(r) in st["races"]
        return _any(value, ok)
    if kind == "background":
        return _any(value, lambda b: b in st["backgrounds"])
    if kind == "feat":
        return _any(value, lambda f: f in st["feats"])
    if kind == "feat_category":
        return _any(value, lambda c: c in st["feat_categories"])
    if kind == "no_other_feat_category":
        return not _any(value, lambda c: c in st["feat_categories"])
    if kind == "spellcasting":
        return bool(st["spellcasting"]) == bool(value)
    if kind == "proficiency":
        return _any(value, lambda d: any(v in st["proficiencies"] for v in (d.values() if isinstance(d, dict) else [d])))
    if kind == "feature":
        return _any(value, lambda f: _name(f) in st["features"] or str(f).replace("_", "-") in st["features"])
    if kind == "spell":
        return _any(value, lambda s: s in st["spells"] or _name(s) in {_name(x) for x in st["spells"]})
    if kind == "optional_feature":
        return _any(value, lambda o: o in st["optional_features"])
    if kind == "pact":
        return _any(value, lambda p: any(f"pact-of-the-{p}" in o for o in st["optional_features"]))
    return True  # a part we don't know yet: don't hold the pick back


def meets(prerequisites, st):
    groups = prerequisites or []
    if not groups:
        return True
    return any(all(_part(k, v, st) for k, v in g.items()) for g in groups)
