"""What a pool choice can be answered with.

    candidates(choice, cat, have, state, legal=True) -> [ids]
        For the randomizer (legal=True): only what the character may take.
        A feat or optional feature must meet its prerequisites, only one
        Epic Boon, and nothing the character already has (`have`).

    described(choice, cat, have, state, picked) -> [{value, label, note, unmet}]
        For the wizard: every option of the choice, with a label for
        catalogue ids (spells, feats, subclasses, optional features,
        items), and `unmet` on a feat/optional feature whose prerequisites
        the character doesn't meet. The wizard shows those as a warning
        and never blocks them. What the choice already picked is always
        listed, even if `have` holds it.

`have` is {grant kind: set of values} the character has (autofill._have);
`state` is prereqs.state_of(...).

Spells, feats and optional features come in both editions under the same
name (Animate Dead PHB and XPHB). A list offers each name once, the 2024
("one") version when there is one, and never a name the character
already has in either edition.
"""

try:
    from app.builder.groups import members
    from app.builder.prereqs import meets
except ImportError:  # run from this folder
    from groups import members
    from prereqs import meets

GROUP_NAMES = {
    "all_skills", "all_tools", "all_languages", "standard_languages", "rare_languages", "artisans_tools",
    "gaming_sets", "musical_instruments", "vehicles", "simple_weapons", "martial_weapons", "all_weapons",
    "simple_melee_weapons", "martial_melee_weapons", "proficient_skills", "proficient_skills_tools",
    "proficient_weapons", "arcane_focuses", "druidic_focuses", "holy_symbols",
}
LABEL_CATEGORY = {"spells": "spells", "feats": "feats", "subclass": "subclasses",
                  "optional_features": "optionalfeatures", "items": "items"}


def _raw(choice, cat, have, state, legal):
    """[(value, record or None)] before the "already have" filter."""
    kind, frm = choice.get("grant"), choice.get("from")
    if kind == "subclass":
        return [(s["id"], s) for s in cat.subclasses_of(frm)]
    if kind == "spells":
        if isinstance(frm, list):
            return [(s, cat.get("spells", s)) for s in frm]
        return [(s["id"], s) for s in cat.spells_matching(frm if isinstance(frm, dict) else {})]
    if kind == "feats":
        feats = cat.feats_matching(frm) if isinstance(frm, dict) else [cat.get("feats", f) for f in frm or []]
        if legal:
            one_boon = "epic_boon" in (state or {}).get("feat_categories", set())
            feats = [f for f in feats if f and not (one_boon and f.get("category") == "epic_boon")
                     and meets(f.get("prerequisites"), state or {})]
        return [(f["id"], f) for f in feats if f]
    if kind == "optional_features":
        types = set((frm or {}).get("feature_type") or []) if isinstance(frm, dict) else set()
        opts = [o for o in cat.all("optionalfeatures") if not types or types & set(o.get("feature_types") or [])]
        if legal:
            opts = [o for o in opts if meets(o.get("prerequisites"), state or {})]
        return [(o["id"], o) for o in opts]
    out = []
    for k in kind if isinstance(kind, list) else [kind]:
        if isinstance(frm, list):  # named groups in a list are opened up; anything else is a value
            vals = [v for x in frm for v in ((members(x, k, cat, have) or [x]) if x in GROUP_NAMES else [x])]
        else:
            vals = members(frm, k, cat, {k2: list(v) for k2, v in (have or {}).items()})
        out += [(v, cat.get("items", v) if k == "items" else None) for v in vals]
    return out


NAMED = ("spells", "feats", "optional_features")


def _name(rec):
    return str((rec or {}).get("name") or "").strip().lower()


def _one_per_name(pairs):
    """Each named record once: the edition "one" version wins."""
    best = {}
    for v, rec in pairs:
        n = _name(rec)
        if not n:
            continue
        if n not in best or (rec.get("edition") == "one" and best[n][1].get("edition") != "one"):
            best[n] = (v, rec)
    keep = {id(p[1]) for p in best.values()}
    return [(v, rec) for v, rec in pairs if not _name(rec) or id(rec) in keep]


def _taken_names(choice, cat, ids):
    grant = choice.get("grant")
    if not isinstance(grant, str) or grant not in NAMED:
        return set()
    cat_name = LABEL_CATEGORY[grant]
    return {_name(cat.get(cat_name, i)) for i in ids} - {""}


def _pairs(choice, cat, have, state, legal):
    pairs = _raw(choice, cat, have, state, legal)
    if isinstance(choice.get("grant"), str) and choice["grant"] in NAMED and not isinstance(choice.get("from"), list):
        pairs = _one_per_name(pairs)
    return pairs


def _kind_key(choice):
    k = choice.get("grant")
    return k if isinstance(k, str) else "skills"


def candidates(choice, cat, have, state, legal=True):
    taken = (have or {}).get(_kind_key(choice), set())
    names = _taken_names(choice, cat, taken)
    repeatable = lambda rec: bool((rec or {}).get("repeatable"))
    return list(dict.fromkeys(v for v, rec in _pairs(choice, cat, have, state, legal)
                              if (v not in taken and _name(rec) not in names) or repeatable(rec)))


def described(choice, cat, have, state, picked=()):
    picked = list(picked or [])
    taken = set((have or {}).get(_kind_key(choice), set())) - set(picked)
    names = _taken_names(choice, cat, taken)
    out, seen = [], set()
    for v, rec in _pairs(choice, cat, have, state, legal=False):
        if v in seen or ((v in taken or (_name(rec) and _name(rec) in names)) and not (rec or {}).get("repeatable")):
            continue
        seen.add(v)
        row = {"value": v}
        if rec:
            row["label"] = rec.get("name")
            if choice.get("grant") == "spells":
                row["note"] = "cantrip" if rec.get("level") == 0 else f"level {rec.get('level')}"
            elif choice.get("grant") == "feats" and rec.get("category"):
                row["note"] = rec["category"].replace("_", " ")
            if choice.get("grant") in ("feats", "optional_features") and not meets(rec.get("prerequisites"), state or {}):
                row["unmet"] = True
        out.append(row)
    for v in picked:  # a pick the list no longer offers stays visible
        if v not in seen:
            out.append({"value": v, "label": None, "note": "not on the list"})
    return out
