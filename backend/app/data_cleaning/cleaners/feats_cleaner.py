"""Code cleaner for feats: one resolved feat (with its options) -> our shape.

    clean_feat(entry) -> (cleaned dict, problems)

Rules decided for feats:
  - feats have no `edition` key; a feat with a `category` is 2024 ("one"),
    one without is classic, and classic feats keep an empty category;
  - prerequisites become groups (any group / all parts), see schemas/feats_schema.py;
  - `_versions` were turned into `options` by the resolver (Magic Initiate,
    Strike of the Giants); each option only holds what differs.
"""

import re

from pydantic import ValidationError

from ..schemas.common_schema import dump
from ..schemas.feats_schema import Feat
from . import common_cleaner as c

CATEGORIES = c.FEAT_CATEGORIES

GRANT_KEYS = {
    "ability", "skillProficiencies", "toolProficiencies", "languageProficiencies",
    "weaponProficiencies", "armorProficiencies", "skillToolLanguageProficiencies",
    "savingThrowProficiencies", "expertise", "additionalSpells", "optionalfeatureProgression",
    "resist", "immune", "vulnerable", "conditionImmune", "senses", "bonusSenses",
}
HANDLED = GRANT_KEYS | {
    "name", "source", "edition", "srd", "srd52", "reprintedAs", "prerequisite", "category",
    "repeatable", "traitTags", "entries", "options",
}
DROPPED = {"page", "hasFluff", "hasFluffImages", "basicRules", "basicRules2024", "otherSources",
           "additionalSources", "repeatableHidden", "_file"}
OPTION_HANDLED = GRANT_KEYS | {"name", "source", "edition", "srd", "srd52", "entries",
                               "overwrite", "entriesRemoved", "fromVersion"}

REPLACES = {
    "ability": "ability", "skillProficiencies": "skills", "toolProficiencies": "tools",
    "languageProficiencies": "languages", "weaponProficiencies": "weapons", "armorProficiencies": "armor",
    "savingThrowProficiencies": "saves", "expertise": "expertise", "additionalSpells": "spells",
    "resist": "defenses", "immune": "defenses", "vulnerable": "defenses", "conditionImmune": "defenses",
    "senses": "senses", "bonusSenses": "senses_bonus", "optionalfeatureProgression": "optional_features",
}
TAG_RE = re.compile(r"\{@\w+\s+([^}]*)\}")


# ---------- prerequisites ----------

def _ref_from_display(display: str | None, name: str, problems: list) -> str:
    """"{@background Rune Carver|BGG}" -> "rune-carver-bgg"; else the name with PHB."""
    m = TAG_RE.search(display or "")
    return c.ref_id(m.group(1)) if m else c.ref_id(name)


def _group(p: dict, problems: list) -> dict:
    out: dict = {}
    for k, v in p.items():
        if k == "level":
            if isinstance(v, int):
                out["level"] = v
            elif isinstance(v, dict) and "class" in v:
                req = {"class": c.snake(v["class"].get("name", "")), "level": v.get("level", 1)}
                if v.get("subclass"):
                    req["subclass"] = c.snake(v["subclass"].get("name", ""))
                out.setdefault("class_level", []).append(req)
            else:
                problems.append(f"prerequisite level: can't read {v!r}")
        elif k == "ability":
            out["ability"] = [{a: n for a, n in d.items()} for d in v]
        elif k == "race":
            races = []
            for r in v:
                name = str(r.get("name", "")).lower()
                if name == "small race" or "small race" in str(r.get("displayEntry", "")).lower():
                    races.append({"size": "small"})
                else:
                    races.append({kk: vv for kk, vv in (("race", name), ("subrace", r.get("subrace"))) if vv})
            out["race"] = races
        elif k == "background":
            out["background"] = [_ref_from_display(b.get("displayEntry"), b.get("name", ""), problems) for b in v]
        elif k == "feat":
            out["feat"] = [c.ref_id("|".join(str(f).split("|")[:2])) for f in v]
        elif k in ("featCategory", "exclusiveFeatCategory"):
            cats = [CATEGORIES.get(x) for x in v]
            if None in cats:
                problems.append(f"prerequisite {k}: unknown category in {v}")
            out["feat_category" if k == "featCategory" else "no_other_feat_category"] = [x for x in cats if x]
        elif k == "feature":
            for f in v:
                if f in ("Spellcasting", "Pact Magic"):
                    out["spellcasting"] = True       # merged, like the old cleaner
                else:
                    out.setdefault("feature", []).append(c.snake(f))
        elif k in ("spellcasting", "spellcasting2020", "spellcastingFeature"):
            if v is True:
                out["spellcasting"] = True
        elif k == "proficiency":
            profs = []
            for d in v:
                for pk, pv in d.items():
                    if pk == "armor":
                        profs.append({"armor": c.ARMOR_IDS.get(str(pv).lower(), c.snake(pv))})
                    elif pk in ("weapon", "weaponGroup"):
                        profs.append({"weapon": c.WEAPON_GROUPS.get(str(pv).lower(), c.snake(pv))})
                    elif pk == "tool":
                        for t in (pv if isinstance(pv, list) else [pv]):
                            profs.append({"tool": c.snake(t)})
                    else:
                        problems.append(f"prerequisite proficiency: can't read {pk}={pv!r}")
            out["proficiency"] = profs
        elif k == "optionalfeature":
            out["optional_feature"] = [c.ref_id(x) for x in v]
        elif k == "pact":
            out["pact"] = [c.snake(v)]                      # "Blade" -> the Pact of the Blade boon
        elif k == "spell":
            spells_, notes = [], []
            for x in v:
                if isinstance(x, str) and "/" not in x.split("#")[0]:
                    spells_.append(c.ref_id(x))
                elif isinstance(x, str):                    # "hex/curse#x": hex or a curse spell
                    notes.append(x.split("#")[0].replace("/", " or ") + " spell")
                elif isinstance(x, dict):
                    notes.append(x.get("entrySummary") or x.get("entry") or "a spell")
            if spells_:
                out["spell"] = spells_
            if notes:
                out["note"] = "; ".join(([out["note"]] if out.get("note") else []) + notes)
        elif k == "item":
            out["item"] = [str(x) for x in v]               # text only: "A suit of armor (requires attunement)"
        elif k == "campaign":
            out["campaign"] = list(v)
        elif k == "other":
            out["note"] = str(v)
        elif k == "otherSummary":
            out["note"] = str(v.get("entry") or v.get("entrySummary") or "")
        else:
            problems.append(f"prerequisite '{k}' not handled")
    return out


def prerequisites(raw: list | None, problems: list) -> list[dict]:
    return [g for g in (_group(p, problems) for p in raw or []) if g]


# ---------- grants ----------

def _grants(entry: dict, problems: list) -> tuple[dict, list]:
    grants: dict = {}
    choices: list = []

    g, ch = c.ability_scores(entry.get("ability"), problems)
    c.add_grants(grants, g)
    choices += ch
    # what `ability: "inherit"` in additionalSpells means: the ability this feat raises
    fixed = list((g.get("ability") or {}).keys())
    inherit = fixed[0] if len(fixed) == 1 and not ch else ({"choice": "ability"} if ch else None)

    for part in (
        c.proficiencies(entry.get("skillProficiencies"), "skills", problems),
        c.proficiencies(entry.get("toolProficiencies"), "tools", problems),
        c.proficiencies(entry.get("languageProficiencies"), "languages", problems),
        c.proficiencies(entry.get("weaponProficiencies"), "weapons", problems),
        c.proficiencies(entry.get("armorProficiencies"), "armor", problems),
        c.mixed_proficiencies(entry.get("skillToolLanguageProficiencies"), problems),
        c.saves(entry.get("savingThrowProficiencies"), problems),
        c.expertise(entry.get("expertise"), problems),
        c.spells(entry.get("additionalSpells"), problems, inherit=inherit),
        c.defenses(entry, problems),
    ):
        c.add_grants(grants, part[0])
        choices += part[1]

    choices += c.optional_features(entry.get("optionalfeatureProgression"), problems)
    s = c.senses(entry.get("senses"), problems)
    if s:
        grants["senses"] = s
    b = c.senses(entry.get("bonusSenses"), problems, "bonusSenses")
    if b:
        grants["senses_bonus"] = b
    return grants, choices


def option_id(opt: dict, feat: dict) -> str:
    """"magic-initiate-cleric-xphb"."""
    return f"{c.slug(feat['name'])}-{c.slug(opt.get('name') or 'Option')}-{str(opt.get('source') or feat['source']).lower()}"


def _option(opt: dict, feat: dict, problems: list) -> dict:
    p: list = []
    named = opt.get("name") or "Option"
    out = c.header({**opt, "name": named}, "feat_option", p, read_prerequisite=False)
    out["id"] = option_id(opt, feat)
    out["edition"] = feat_edition(feat)
    grants, choices = _grants(opt, p)
    c.assign_ids(choices)
    out["grants"], out["choices"] = grants, choices
    replaces = []
    for k in opt.get("overwrite") or {}:
        if k in REPLACES and REPLACES[k] not in replaces:
            replaces.append(REPLACES[k])
    if replaces:
        out["replaces"] = replaces
    if opt.get("entriesRemoved"):
        out["replaces_text"] = list(opt["entriesRemoved"])
    c.unhandled(opt, OPTION_HANDLED, DROPPED, p)
    problems += [f"option {named}: {x}" for x in p]
    return out


def feat_edition(entry: dict) -> str:
    """No feat has an `edition`: a feat with a category is 2024 ("one")."""
    return entry.get("edition") or ("one" if entry.get("category") else "classic")


# ---------- the feat ----------

def clean_feat(entry: dict) -> tuple[dict | None, list[str]]:
    problems: list[str] = []
    out = c.header(entry, "feat", problems, read_prerequisite=False)
    out["edition"] = feat_edition(entry)
    cat = entry.get("category")
    if cat:
        if cat in CATEGORIES:
            out["category"] = CATEGORIES[cat]
        else:
            problems.append(f"unknown category '{cat}'")
    if entry.get("repeatable"):
        out["repeatable"] = True
    pre = prerequisites(entry.get("prerequisite"), problems)
    if pre:
        out["prerequisites"] = pre

    grants, choices = _grants(entry, problems)
    c.assign_ids(choices)
    out["grants"], out["choices"] = grants, choices

    opts = [_option(o, entry, problems) for o in entry.get("options") or []]
    if opts:
        out["options"] = opts

    c.unhandled(entry, HANDLED, DROPPED, problems)
    try:
        return dump(Feat.model_validate(out)), problems
    except ValidationError as e:
        problems += [f"schema: {'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]
        return None, problems
