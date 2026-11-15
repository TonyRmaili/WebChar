"""Code cleaner for classes: one resolved class book -> the class and its subclasses.

    clean_class_book(book) -> (records, problems per record)

A book is resolved/classes/<class id>.json: one class, its subclasses and
every class/subclass feature they use (the resolver gathered them, also
features shared with another class). The result is one class record and one
record per subclass (`kind` says which); the finalizer writes them to
final/classes/ and final/subclasses/.

What code does here (the LLM step adds the features' mechanics later):
  - the core: hit die and hit points, saves, primary ability, proficiencies,
    starting equipment, multiclassing;
  - `columns`: the class table, cells as plain values;
  - `spellcasting`: ability, progression, cantrips, prepared/known, slots,
    pact slots, Mystic Arcanum, the Wizard's spellbook;
  - `resources`: pools from the table columns and the data's `consumes`
    (how they refill is filled in by the LLM step);
  - `progression`: per class level, the features, the upgrades, and the picks
    (subclass, ASI/feats, fighting styles, optional features, weapon masteries);
  - `features`: every feature with its id, level and text. A feature that
    points at others (Monk's Focus -> Flurry of Blows) keeps them as their own
    features with `parent`.

Rules decided from the data, not from names:
  - an upgrade is a later feature named like an earlier one, or with "(…)"
    after it ("Extra Attack (2)", "Additional Superiority Die" again): its text
    goes on the earlier feature and the level lists it under `upgrades`;
  - a `gainSubclassFeature` entry is the subclass pick (the first) or a
    "your subclass gives a feature here" marker (the rest);
  - Ability Score Improvement and Epic Boon are picks, not features.
"""

import re

from pydantic import ValidationError

from .. import text_renderer
from ..data_resolver import class_feature_key, class_feature_list, feature_refs, subclass_feature_key
from ..schemas.classes_schema import ClassEntry, SubclassEntry
from ..schemas.common_schema import dump
from . import common_cleaner as c

HANDLED_CLASS = {
    "name", "source", "edition", "srd", "srd52", "reprintedAs", "alias", "hd", "proficiency",
    "primaryAbility", "startingProficiencies", "startingEquipment", "multiclassing", "classTableGroups",
    "classFeatures", "subclassTitle", "spellcastingAbility", "casterProgression", "cantripProgression",
    "preparedSpells", "preparedSpellsChange", "preparedSpellsProgression", "spellsKnownProgression",
    "spellsKnownProgressionFixed", "spellsKnownProgressionFixedByLevel", "additionalSpells",
    "featProgression", "optionalfeatureProgression", "itemMasteries", "itemMasteriesProgression",
}
DROPPED_CLASS = {
    "page", "hasFluff", "hasFluffImages", "_file", "basicRules", "basicRules2024", "otherSources",
    "spellsKnownProgressionFixedAllowLowerLevel",
    "reskinOf", "isHero",          # WoW: which class it was built from (resolved already)
    "includeSubclassesFrom",       # WoW: a subclass belongs to one class only (decided)
}
HANDLED_SUB = {
    "name", "shortName", "source", "className", "classSource", "edition", "srd", "srd52", "reprintedAs",
    "subclassFeatures", "subclassTableGroups", "additionalSpells", "spellcastingAbility", "casterProgression",
    "cantripProgression", "preparedSpellsProgression", "preparedSpellsChange", "spellsKnownProgression",
    "optionalfeatureProgression", "featProgression",
}
DROPPED_SUB = {"page", "hasFluff", "hasFluffImages", "_file", "basicRules", "basicRules2024", "otherSources",
               "isReprinted"}
HANDLED_FEATURE = {"name", "source", "className", "classSource", "subclassShortName", "subclassSource", "level",
                   "entries", "srd", "srd52", "isClassFeatureVariant", "consumes"}
DROPPED_FEATURE = {"page", "_file", "basicRules", "basicRules2024", "otherSources", "header", "type"}

PICKS = {"ability score improvement", "epic boon"}          # picks in the progression, not features
UPGRADE = re.compile(r"^(.+?) \([^()]*\)$")                  # "Extra Attack (2)" -> "Extra Attack"

CASTER = {"full": "full", "1/2": "half", "1/3": "third", "artificer": "half_up", "pact": "pact"}
CHANGE = {"restLong": "long_rest", "level": "level"}

# Column ids that mean the same thing across editions.
COLUMN_IDS = {"ki_points": "focus_points", "cantrips_known": "cantrips", "invocations_known": "invocations",
              "spells_prepared": "prepared_spells"}
# Columns that belong to `spellcasting`, not to `columns`.
SPELL_COLUMNS = {"cantrips", "spells_known", "prepared_spells", "spell_slots", "slot_level"}
# Columns that are a resource's size or die: column id -> (resource id, part, resource name).
RESOURCE_COLUMNS = {
    "rages": ("rage", "max", "Rage"),
    "focus_points": ("focus_points", "max", None),
    "sorcery_points": ("sorcery_points", "max", None),
    "channel_divinity": ("channel_divinity", "max", None),
    "wild_shape": ("wild_shape", "max", None),
    "second_wind": ("second_wind", "max", None),
    "psi_points": ("psi_points", "max", None),
    "psionic_energy_die_number": ("psionic_energy_dice", "max", "Psionic Energy Dice"),
    "psionic_energy_die_size": ("psionic_energy_dice", "die", "Psionic Energy Dice"),
    "soulknife_energy_die_number": ("psionic_energy_dice", "max", "Psionic Energy Dice"),
    "soulknife_energy_die_size": ("psionic_energy_dice", "die", "Psionic Energy Dice"),
    "bardic_die": ("bardic_inspiration", "die", "Bardic Inspiration"),
}
ORDINAL = re.compile(r"^(\d+)(st|nd|rd|th)$")
DIE = re.compile(r"^d(4|6|8|10|12|20)$", re.I)
TIP = re.compile(r"^\{@tip [^|}]*\|([^}]*)\}$")


# ---------- ids ----------

def class_id(name: str, source: str) -> str:
    return c.entry_id(name, source or c.DEFAULT_SOURCE)


def subclass_id(class_name, class_source, short_name, source) -> str:
    return f"{class_id(class_name, class_source)}:{c.slug(short_name)}-{str(source or c.DEFAULT_SOURCE).lower()}"


def feature_id(f: dict) -> str:
    """Named after the class (and subclass) the feature itself comes from, so
    a feature shared by two classes (Death Knight uses Paladin's) is one id."""
    if "subclassShortName" in f:
        owner = subclass_id(f.get("className"), f.get("classSource"), f.get("subclassShortName"), f.get("subclassSource"))
    else:
        owner = class_id(f.get("className"), f.get("classSource"))
    return f"{owner}:{c.slug(f.get('name'))}"


# ---------- small readers ----------

def _srd(entry: dict) -> dict:
    out = {}
    for key, ver in (("srd", "5.1"), ("srd52", "5.2")):
        v = entry.get(key)
        if v is True:
            out[ver] = entry.get("name")
        elif isinstance(v, str):
            out[ver] = v
    return out


def _consumes(raw: dict | None) -> dict | None:
    if not raw:
        return None
    out = {"resource": c.resource_id(raw.get("name", ""))}
    if "amountMin" in raw or "amountMax" in raw:
        out["min"], out["max"] = raw.get("amountMin"), raw.get("amountMax")
    else:
        out["amount"] = raw.get("amount", 1)
    return out


def level_table(values: list, problems: list | None = None) -> dict:
    """[0, 2, 2, 3, …] (one per class level) -> {"2": 2, "4": 3, …}: only
    where the value changes, starting at the first level that has one."""
    out, prev = {}, None
    for i, v in enumerate(values):
        if prev is None and v in (0, None, "", [], "—"):
            continue
        if v != prev:
            out[str(i + 1)] = v
            prev = v
    return out


def cumulative(prog) -> dict[int, int]:
    """A progression of running totals ({"3": 3, "7": 5} or a list of 20)
    -> how many are gained at each level: {3: 3, 7: 2}."""
    if isinstance(prog, list):
        prog = {str(i + 1): v for i, v in enumerate(prog)}
    out, total = {}, 0
    for lvl in sorted(prog, key=int):
        n = prog[lvl]
        if isinstance(n, int) and n > total:
            out[int(lvl)] = n - total
            total = n
    return out


def cell(v, problems: list):
    """A class-table cell -> a plain value."""
    if isinstance(v, dict):
        t = v.get("type")
        if t == "dice":
            return "+".join(f"{r.get('number', 1)}d{r.get('faces')}" for r in v.get("toRoll") or [])
        if t in ("bonus", "bonusSpeed"):
            return v.get("value")
        problems.append(f"table: can't read cell {v!r}")
        return None
    if isinstance(v, str):
        s = text_renderer.tags(v, problems).strip()
        if s in ("", "—", "-"):
            return None
        if s.isdigit():
            return int(s)
        m = ORDINAL.match(s)
        if m:
            return int(m.group(1))
        if DIE.match(s):
            return s.lower()
        return s.lower() if s.lower() == "unlimited" else s
    return v


def column_label(label: str, problems: list) -> tuple[str, str]:
    """(id, name). "{@tip Die Size|Psionic Energy Die Size}" names itself in
    the tip: that full name gives the id."""
    m = TIP.match(label.strip())
    name = m.group(1).strip() if m else text_renderer.tags(label, problems).strip()
    cid = c.snake(name)
    return COLUMN_IDS.get(cid, cid), name


def table_groups(groups: list, problems: list) -> tuple[list[dict], list | None]:
    """classTableGroups / subclassTableGroups -> (columns, spell slot rows)."""
    columns, slots = [], None
    for g in groups or []:
        if "rowsSpellProgression" in g:
            slots = g["rowsSpellProgression"]
        if "rows" not in g:
            continue
        for i, label in enumerate(g.get("colLabels") or []):
            cid, name = column_label(label, problems)
            vals = [cell(r[i], problems) if i < len(r) else None for r in g["rows"]]
            columns.append({"id": cid, "name": name, "values": level_table(vals)})
    return columns, slots


def slot_table(rows: list) -> dict:
    trimmed = []
    for r in rows:
        r = list(r)
        while r and r[-1] == 0:
            r.pop()
        trimmed.append(r)
    return level_table(trimmed)


def prepared_formula(text: str, problems: list) -> str | None:
    """"<$level$> / 2 + <$cha_mod$>" -> "max(1, class_level / 2 + cha_mod)"
    (you always prepare at least one spell)."""
    f = re.sub(r"<\$level\$>", "class_level", text)
    f = re.sub(r"<\$(\w+)\$>", r"\1", f)
    from ..formula import FormulaError, check_formula
    try:
        check_formula(f)
    except FormulaError as e:
        problems.append(f"spellcasting: can't read prepared spells '{text}': {e}")
        return None
    return f"max(1, {f})" if "/" in f else f


# ---------- proficiencies, equipment, multiclassing ----------

WEAPON_WORDS = {"simple": "simple_weapons", "martial": "martial_weapons"}
ARMOR_WORDS = {"light": "light", "medium": "medium", "heavy": "heavy", "shield": "shields", "shields": "shields"}


def _weapon_filter_id(filt: str, problems: list) -> str:
    """"type=martial weapon|property=light;finesse" -> "martial_weapons_finesse_or_light"."""
    parts = dict(p.split("=", 1) for p in filt.lower().split("|") if "=" in p)
    base = c.filter_group(f"type={parts.get('type', '')}", problems)
    if not isinstance(base, str):
        return c.snake(filt)
    props = sorted(x.strip() for x in parts.get("property", "").split(";") if x.strip())
    return base + ("_" + "_or_".join(c.snake(p) for p in props) if props else "")


def _weapons(sp: dict, problems: list) -> tuple[dict, list]:
    structured = sp.get("weaponProficiencies")
    if structured:
        grants, choices, rest = {}, [], []
        for d in structured:
            d = dict(d)
            extra = []
            if isinstance(d.get("all"), dict) and "fromFilter" in d["all"]:
                extra.append(_weapon_filter_id(d.pop("all")["fromFilter"], problems))
            rest.append(d)
            if extra:
                c.add_grants(grants, {"weapons": extra})
        g, ch = c.proficiencies(rest, "weapons", problems)
        c.add_grants(grants, g)
        return grants, choices + ch
    fixed = []
    for w in sp.get("weapons") or []:
        if isinstance(w, dict):
            if not w.get("optional"):          # "firearms, if your DM allows": left to the DM
                problems.append(f"weapons: can't read {w!r}")
            continue
        low = str(w).lower()
        if low in WEAPON_WORDS:
            fixed.append(WEAPON_WORDS[low])
        elif low.startswith("{@item "):
            fixed.append(c.snake(c.split_ref(low[7:].rstrip("}"))["name"]))
        else:
            problems.append(f"weapons: can't read '{w}'")
    return ({"weapons": fixed} if fixed else {}), []


def _armor(sp: dict, problems: list) -> tuple[dict, list]:
    if sp.get("armorProficiencies"):
        return c.proficiencies(sp["armorProficiencies"], "armor", problems)
    fixed = []
    for a in sp.get("armor") or []:
        word = a.get("proficiency") if isinstance(a, dict) else a
        if str(word).lower() in ARMOR_WORDS:
            fixed.append(ARMOR_WORDS[str(word).lower()])
        else:
            problems.append(f"armor: can't read {a!r}")
    return ({"armor": fixed} if fixed else {}), []


def proficiencies(sp: dict | None, problems: list) -> tuple[dict, list]:
    """startingProficiencies / multiclassing.proficienciesGained. The
    structured keys (armorProficiencies, toolProficiencies…) are read; the
    plain-text lists next to them are only a fallback."""
    sp = sp or {}
    grants, choices = {}, []
    for g, ch in (
        _armor(sp, problems),
        _weapons(sp, problems),
        c.proficiencies(sp.get("toolProficiencies"), "tools", problems),
        c.proficiencies(sp.get("skills"), "skills", problems),
    ):
        c.add_grants(grants, g)
        choices += ch
    if sp.get("tools") and not sp.get("toolProficiencies"):
        problems.append(f"tools: only text {sp['tools']!r}")
    extra = set(sp) - {"armor", "armorProficiencies", "weapons", "weaponProficiencies", "tools",
                       "toolProficiencies", "skills"}
    if extra:
        problems.append(f"proficiencies: can't read {sorted(extra)}")
    return grants, choices


def multiclass(entry: dict, primary: list[list[str]], problems: list) -> dict:
    raw = entry.get("multiclassing") or {}
    req = raw.get("requirements") or {}
    groups = []
    if "or" in req:
        for d in req["or"]:
            groups += [{a: n} for a, n in d.items()]
        req = {k: v for k, v in req.items() if k != "or"}
    if req:
        groups.insert(0, {a: n for a, n in req.items() if a in c.ABILITIES})
        if set(req) - set(c.ABILITIES):
            problems.append(f"multiclassing: can't read requirements {req!r}")
    if not groups and entry.get("edition") == "one" and primary:
        # 2024: 13 in the class's primary ability (the data leaves it out)
        groups = [{a: 13 for a in grp} for grp in primary]
    grants, choices = proficiencies(raw.get("proficienciesGained"), problems)
    extra = set(raw) - {"requirements", "proficienciesGained", "requirementsSpecial"}
    if extra:
        problems.append(f"multiclassing: can't read {sorted(extra)}")
    return {"requires": groups, "grants": grants, "choices": choices}


def starting_equipment(raw: dict | None, problems: list) -> tuple[dict, list, str | None]:
    raw = raw or {}
    grants, choices = c.equipment(raw.get("defaultData"), problems)
    gold = None
    if raw.get("goldAlternative"):
        gold = text_renderer.tags(raw["goldAlternative"], problems).strip()
    extra = set(raw) - {"defaultData", "goldAlternative", "default", "entries", "additionalFromBackground"}
    if extra:
        problems.append(f"startingEquipment: can't read {sorted(extra)}")
    return grants, choices, gold


# ---------- spells ----------

def _expanded(exp: dict, problems: list) -> dict:
    """One `expanded` block -> {"spells": [list grants], "spell_lists": [filters]}."""
    out: dict = {}
    for key, items in exp.items():
        key = str(key)
        at = int(key) if key.isdigit() else None
        at_sl = int(key[1:]) if key[:1] == "s" and key[1:].isdigit() else None
        if at is None and at_sl is None:
            problems.append(f"spells: can't read expanded level '{key}'")
            continue
        for x in items if isinstance(items, list) else [items]:
            if isinstance(x, str):
                c.add_grants(out, {"spells": [c.spell_grant(x, "list", at, None, None, at_sl)]})
            elif isinstance(x, dict) and "all" in x:
                item = {"filter": c.spell_filter(x["all"], problems)}
                if at is not None:
                    item["at"] = at
                if at_sl is not None:
                    item["at_spell_level"] = at_sl
                c.add_grants(out, {"spell_lists": [item]})
            else:
                problems.append(f"spells: can't read expanded {x!r}")
    return out


def spell_grants(raw: list | None, problems: list) -> tuple[dict, list]:
    """additionalSpells. `expanded` (spells added to your class list) is read
    here: single spells become list grants; "all spells matching a filter"
    (Eldritch Knight: Wizard spells) becomes a `spell_lists` grant.
    Alternatives (The Genie's four kinds) each keep their own list; when
    they all add the same list (Divine Soul) it is added once."""
    raw = [dict(d) for d in raw or []]
    expanded = [_expanded(d.pop("expanded", None) or {}, problems) for d in raw]
    same = all(e == expanded[0] for e in expanded) if expanded else True
    kept = [d for d in raw if set(d) - {"name"}]
    grants, choices = c.spells(raw if len(kept) == len(raw) else kept, problems)
    if same:
        if expanded:
            c.add_grants(grants, expanded[0])
        return grants, choices
    bundle = next((ch for ch in choices if ch.get("type") == "bundle" and len(ch["options"]) == len(raw)), None)
    if bundle is None and not kept:
        # the alternatives are only their lists (The Genie: Dao, Djinni, Efreeti, Marid)
        bundle = c.bundle("Spells", [c.option(c.snake(d.get("name") or chr(97 + i)), d.get("name") or chr(65 + i), {}, [])
                                     for i, d in enumerate(raw)])
        choices.append(bundle)
    if bundle is None:
        problems.append("spells: different 'expanded' lists inside alternatives")
        return grants, choices
    for opt, exp in zip(bundle["options"], expanded):
        c.add_grants(opt["grants"], exp)
    return grants, choices


def spell_ability_on_grants(entry: dict, grants: dict, choices: list) -> bool:
    """A subclass with a spellcasting ability but no spellcasting of its own
    (Ancestral Guardian): the ability is the one its granted spells use.
    False when it has no spells to put it on (Way of the Four Elements: its
    spells come from the disciplines it picks); then it stays as
    `spellcasting: {"ability": …}`."""
    ab = entry.get("spellcastingAbility")
    if not ab or entry.get("casterProgression"):
        return True
    used = False
    for g in grants.get("spells") or []:
        if isinstance(g, dict) and g.get("ability") is None:
            g["ability"] = ab
            used = True

    def walk(cs):
        nonlocal used
        for ch in cs:
            if ch.get("type") == "pool" and ch.get("grant") == "spells" and ch.get("ability") is None:
                ch["ability"] = ab
                used = True
            for o in ch.get("options", []):
                for g in (o.get("grants") or {}).get("spells") or []:
                    if g.get("ability") is None:
                        g["ability"] = ab
                        used = True
                walk(o.get("choices", []))

    walk(choices)
    return used


def merge_alternatives(choices: list) -> list:
    """"An artisan's tool or a musical instrument" arrives as two
    alternatives of one pick each; that is one pool over both groups."""
    out = []
    for ch in choices:
        opts = ch.get("options") if ch.get("type") == "bundle" else None
        pools = [o["choices"][0] for o in opts or []
                 if not o.get("grants") and len(o.get("choices") or []) == 1 and o["choices"][0]["type"] == "pool"]
        if opts and len(pools) == len(opts) and len({(p["grant"] if isinstance(p["grant"], str) else tuple(p["grant"]),
                                                     p["count"]) for p in pools}) == 1:
            frm = []
            for p in pools:
                frm += p["from"] if isinstance(p["from"], list) else [p["from"]]
            out.append(c.pool(pools[0]["grant"], frm, pools[0]["count"]))
        else:
            out.append(ch)
    return out


def spellcasting(entry: dict, slots_rows: list | None, columns: list[dict], own_list: str | None,
                 problems: list) -> dict | None:
    if not entry.get("casterProgression"):
        if slots_rows:
            problems.append("spellcasting: a slot table but no caster progression")
        return None
    out: dict = {"ability": entry.get("spellcastingAbility")}
    prog = entry.get("casterProgression")
    if prog:
        out["progression"] = CASTER.get(prog)
        if out["progression"] is None:
            problems.append(f"spellcasting: unknown caster progression '{prog}'")
    if own_list:
        out["list"] = own_list
    if entry.get("cantripProgression"):
        out["cantrips"] = level_table(entry["cantripProgression"])
    if entry.get("preparedSpellsProgression"):
        out["prepared"] = level_table(entry["preparedSpellsProgression"])
    elif entry.get("preparedSpells"):
        out["prepared"] = prepared_formula(entry["preparedSpells"], problems)
    if entry.get("spellsKnownProgression"):
        out["known"] = level_table(entry["spellsKnownProgression"])
    if entry.get("preparedSpellsChange"):
        out["change"] = CHANGE.get(entry["preparedSpellsChange"])
        if out["change"] is None:
            problems.append(f"spellcasting: unknown change rule '{entry['preparedSpellsChange']}'")
    if slots_rows:
        out["slots"] = slot_table(slots_rows)
    if prog == "pact":
        cols = {col["id"]: col["values"] for col in columns}
        if "spell_slots" in cols and "slot_level" in cols:
            out["pact"] = {"slots": cols["spell_slots"], "level": cols["slot_level"]}
        else:
            problems.append("spellcasting: pact magic without Spell Slots / Slot Level columns")
    if entry.get("spellsKnownProgressionFixedByLevel"):
        arc = {}
        for lvl, d in entry["spellsKnownProgressionFixedByLevel"].items():
            for spell_level in d:
                arc[str(lvl)] = int(spell_level)
        out["arcanum"] = arc
    fixed = entry.get("spellsKnownProgressionFixed")
    if fixed:
        rest = set(fixed[1:])
        if len(rest) == 1:
            out["spellbook"] = {"first": fixed[0], "per_level": rest.pop()}
        else:
            problems.append(f"spellcasting: uneven spellbook progression {fixed}")
    return out


# ---------- resources ----------

def resources(columns: list[dict], consumed: list[tuple[str, str]], known: set, problems: list) -> list[dict]:
    """Pools from the table columns (their size or die) and from what the
    features spend (`consumes`). `known`: ids the class already defines (a
    subclass doesn't repeat Channel Divinity)."""
    out: dict[str, dict] = {}
    for col in columns:
        hit = RESOURCE_COLUMNS.get(col["id"])
        if not hit:
            continue
        rid, part, name = hit
        r = out.setdefault(rid, {"id": rid, "name": name or col["name"]})
        r[part] = col["values"]
    for rid, name in consumed:
        if rid not in out and rid not in known:
            out[rid] = {"id": rid, "name": name}
    return list(out.values())


# ---------- features ----------

class FeatureBuilder:
    """Turns one owner's (a class or a subclass) list of feature refs into
    features + what each level gets."""

    def __init__(self, owner_source: str, cf_index: dict, sf_index: dict, problems: list):
        self.owner_source = str(owner_source).lower()
        self.cf_index, self.sf_index = cf_index, sf_index
        self.problems = problems
        self.features: list[dict] = []
        self.by_key: dict[tuple, dict] = {}
        self.levels: dict[int, dict] = {}
        self.top_by_name: dict[str, dict] = {}
        self.consumed: list[tuple[str, str]] = []
        self.raw: dict[str, dict] = {}          # feature id -> its raw entry (for the LLM jobs)
        self.tops: list[dict] = []              # {"id", "upgrades": [raw…]}: the owner's own list, in order

    def level(self, n: int) -> dict:
        return self.levels.setdefault(int(n), {"level": int(n), "features": [], "upgrades": [], "choices": [],
                                               "grants": {}})

    def lookup(self, is_sub: bool, ref: str) -> tuple[tuple, dict | None]:
        key = subclass_feature_key(ref) if is_sub else class_feature_key(ref)
        f = (self.sf_index if is_sub else self.cf_index).get(key)
        if f is None:
            self.problems.append(f"feature '{ref}' not found")
        return key, f

    def own_text(self, f: dict) -> str:
        """The feature's own text; the features it points at are their own features."""
        text_renderer.REFS = lambda kind, ref: []
        try:
            return text_renderer.render(f.get("entries"), self.problems)
        finally:
            text_renderer.REFS = None

    def make(self, f: dict, parent: str | None = None) -> dict:
        fid = feature_id(f)
        if any(x["id"] == fid for x in self.features):
            fid = f"{fid}-{f.get('level')}"
        c.unhandled(f, HANDLED_FEATURE | {"_book"}, DROPPED_FEATURE, self.problems)
        feat = {"id": fid, "name": c.display_name(f), "level": int(f.get("level") or 1), "text": self.own_text(f)}
        if str(f.get("source", "")).lower() != self.owner_source:
            feat["source"] = f.get("source")
        if parent:
            feat["parent"] = parent
        if f.get("isClassFeatureVariant"):
            feat["optional"] = True
        cons = _consumes(f.get("consumes"))
        if cons:
            feat["consumes"] = cons
            self.consumed.append((cons["resource"], f["consumes"].get("name", "")))
        srd = _srd(f)
        if srd:
            feat["srd"] = srd
        self.features.append(feat)
        self.raw[fid] = f
        return feat

    def add(self, is_sub: bool, ref: str, parent: str | None = None) -> dict | None:
        """One feature and, as their own features, the ones it points at."""
        key, f = self.lookup(is_sub, ref)
        if f is None:
            return None
        if key in self.by_key:
            return self.by_key[key]
        feat = self.make(f, parent)
        self.by_key[key] = feat
        for sub, r in feature_refs(f.get("entries"), []):
            self.add(sub, r, feat["id"])
        return feat

    def add_children_only(self, is_sub: bool, ref: str) -> tuple[dict | None, list[dict]]:
        """A subclass's opening feature (named like the subclass): its own text
        describes the subclass; the features it points at are the real ones."""
        key, f = self.lookup(is_sub, ref)
        if f is None:
            return None, []
        self.by_key[key] = {"id": None}
        kids = []
        for sub, r in feature_refs(f.get("entries"), []):
            k = self.add(sub, r)
            if k:
                kids.append(k)
                self.tops.append({"id": k["id"], "upgrades": []})
        return f, kids

    def top(self, is_sub: bool, ref: str) -> None:
        """A feature from the owner's own list: a new feature, or an upgrade
        of an earlier one."""
        key, f = self.lookup(is_sub, ref)
        if f is None:
            return
        name = str(f.get("name", "")).strip()
        lvl = self.level(f.get("level") or 1)
        base = self.top_by_name.get(base_name(name))
        if base is not None and base["level"] < int(f.get("level") or 1):
            text = self.own_text(f)
            # 5etools often repeats the whole feature at the later level (2024 Action
            # Surge, Indomitable): only text that says something new is added.
            if text.strip() and text.strip() not in base["text"]:
                base["text"] = (base["text"] + "\n\n" if base["text"] else "") + f"**{name}.** {text}"
            lvl["upgrades"].append(base["id"])
            self.by_key[key] = base
            for t in self.tops:
                if t["id"] == base["id"]:
                    t["upgrades"].append(f)
            return
        feat = self.add(is_sub, ref)
        if feat:
            self.top_by_name.setdefault(base_name(name), feat)
            lvl["features"].append(feat["id"])
            self.tops.append({"id": feat["id"], "upgrades": []})


def base_name(name: str) -> str:
    """"Extra Attack (2)" and "Extra Attack" -> "extra attack": the name an
    upgrade shares with the feature it improves."""
    name = str(name).strip()
    m = UPGRADE.match(name)
    return (m.group(1) if m else name).strip().lower()


def _pick(grant, frm, count, label, level) -> dict:
    ch = c.pool(grant, frm, count, label=label)
    ch["id"] = f"{c.snake(label) or grant}_{level}"
    return ch


def picks(entry: dict, b: FeatureBuilder, problems: list) -> None:
    """Feats, optional features and weapon masteries gained per level."""
    for fp in entry.get("featProgression") or []:
        cats = []
        for code in fp.get("category") or []:
            cat = c.FEAT_CATEGORIES.get(code)
            if cat is None:
                problems.append(f"feat progression: unknown category '{code}'")
            elif cat not in cats:
                cats.append(cat)
        for lvl, n in cumulative(fp.get("progression") or {}).items():
            b.level(lvl)["choices"].append(_pick("feats", {"category": cats}, n, fp.get("name") or "Feat", lvl))
    for op in entry.get("optionalfeatureProgression") or []:
        frm = c.optional_feature_filter(op.get("featureType") or [], problems)
        for lvl, n in cumulative(op.get("progression") or {}).items():
            b.level(lvl)["choices"].append(_pick("optional_features", frm, n, op.get("name") or "Options", lvl))
        for lvl, refs in (op.get("required") or {}).items():
            c.add_grants(b.level(lvl)["grants"], {"optional_features": [c.ref_id(r) for r in refs]})
    if entry.get("itemMasteriesProgression"):
        for lvl, n in cumulative(entry["itemMasteriesProgression"]).items():
            b.level(lvl)["choices"].append(_pick("weapon_masteries", "proficient_weapons", n, "Weapon Mastery", lvl))
    elif entry.get("itemMasteries"):
        problems.append("weapon mastery without a progression")


def asi_choice(edition: str, level: int) -> dict:
    """2014: +2 to one ability or +1 to two, or a feat (the optional rule).
    2024: a feat; the Ability Score Improvement feat is one of them."""
    if edition == "one":
        return _pick("feats", {"category": ["general"]}, 1, "Ability Score Improvement", level)
    ch = c.bundle("Ability Score Improvement", [
        c.option("ability", "+2 to one ability or +1 to two", {},
                 [{**c._ability_choice(list(c.ABILITIES), [[2], [1, 1]]), "id": f"ability_{level}"}]),
        c.option("feat", "A feat", {}, [_pick("feats", "all_feats", 1, "Feat", level)]),
    ])
    ch["id"] = f"ability_score_improvement_{level}"
    return ch


def progression(b: FeatureBuilder) -> list[dict]:
    return [b.levels[k] for k in sorted(b.levels)]


# ---------- the book ----------

def _index(book: dict) -> tuple[dict, dict]:
    from ..data_resolver import feature_key_of
    return ({feature_key_of(f, False): f for f in book.get("classFeature", [])},
            {feature_key_of(f, True): f for f in book.get("subclassFeature", [])})


def clean_class(cls: dict, cf_index: dict, sf_index: dict, keep: dict | None = None) -> tuple[dict | None, list[str]]:
    problems: list[str] = []
    out = c.header(cls, "class", problems, read_prerequisite=False)
    out.pop("text", None)
    cid = out["id"]
    edition = out["edition"]

    hd = cls.get("hd") or {}
    faces = hd.get("faces")
    out["hit_die"] = f"d{faces}"
    out["hp"] = {"first": f"{faces} + con_mod", "per_level": f"{faces // 2 + 1} + con_mod"}
    primary = [[a for a, v in d.items() if v and a in c.ABILITIES] for d in cls.get("primaryAbility") or []]
    out["primary_ability"] = primary
    out["saves"] = [a for a in cls.get("proficiency") or [] if a in c.ABILITIES]

    grants, choices = proficiencies(cls.get("startingProficiencies"), problems)
    g, ch, gold = starting_equipment(cls.get("startingEquipment"), problems)
    c.add_grants(grants, g)
    choices += ch
    g, ch = spell_grants(cls.get("additionalSpells"), problems)
    c.add_grants(grants, g)
    choices += ch
    ability_used = spell_ability_on_grants(cls, grants, choices)
    choices = merge_alternatives(choices)
    c.assign_ids(choices)
    out["grants"], out["choices"] = grants, choices
    if gold:
        out["starting_gold"] = gold
    out["multiclass"] = multiclass(cls, primary, problems)
    out["multiclass"]["choices"] = merge_alternatives(out["multiclass"]["choices"])
    c.assign_ids(out["multiclass"]["choices"])
    if cls.get("reskinOf"):
        out.pop("aliases", None)    # WoW: the alias names the class it was built from

    columns, slot_rows = table_groups(cls.get("classTableGroups"), problems)
    out["spellcasting"] = spellcasting(cls, slot_rows, columns, cid, problems) or \
        (None if ability_used else {"ability": cls["spellcastingAbility"]})

    b = FeatureBuilder(cls.get("source"), cf_index, sf_index, problems)
    sub_info = {"title": cls.get("subclassTitle") or "Subclass"}
    for r in cls.get("classFeatures") or []:
        ref = r["classFeature"] if isinstance(r, dict) else r
        key, f = b.lookup(False, ref)
        if f is None:
            continue
        lvl = int(f.get("level") or 1)
        if isinstance(r, dict) and r.get("gainSubclassFeature"):
            if "level" not in sub_info:
                sub_info["level"] = lvl
                sub_info["text"] = b.own_text(f)
                b.level(lvl)["choices"].append(_pick("subclass", cid, 1, sub_info["title"], lvl))
            else:
                b.level(lvl)["subclass_features"] = True
            continue
        if str(f.get("name", "")).strip().lower() in PICKS:
            if f["name"].strip().lower() == "ability score improvement":
                b.level(lvl)["choices"].append(asi_choice(edition, lvl))
            continue
        b.top(False, ref)
    picks(cls, b, problems)
    if keep is not None:
        keep["builder"] = b
    out["subclass"] = sub_info
    out["features"] = b.features
    out["progression"] = progression(b)

    out["columns"] = [col for col in columns if col["id"] not in SPELL_COLUMNS]
    out["resources"] = resources(columns, b.consumed, set(), problems)

    c.unhandled(cls, HANDLED_CLASS | {"classFeatures"}, DROPPED_CLASS, problems)
    try:
        return dump(ClassEntry.model_validate(out)), problems
    except ValidationError as e:
        problems += [f"schema: {'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]
        return None, problems


def clean_subclass(sub: dict, cls_record: dict | None, cf_index: dict, sf_index: dict,
                   keep: dict | None = None) -> tuple[dict | None, list[str]]:
    problems: list[str] = []
    out = c.header(sub, "subclass", problems, read_prerequisite=False)
    out["id"] = subclass_id(sub.get("className"), sub.get("classSource"), sub.get("shortName"), sub.get("source"))
    out["class_id"] = class_id(sub.get("className"), sub.get("classSource"))
    out["short_name"] = sub.get("shortName") or sub.get("name")
    out["edition"] = sub.get("edition") or (cls_record or {}).get("edition") or "classic"
    out["text"] = None
    reprints = []
    for r in sub.get("reprintedAs") or []:
        p = (str(r.get("uid") if isinstance(r, dict) else r).split("|") + [""] * 4)[:4]
        reprints.append(subclass_id(p[1], p[2], p[0], p[3] or p[2]))
    if reprints:
        out["reprinted_as"] = reprints

    grants, choices = spell_grants(sub.get("additionalSpells"), problems)
    ability_used = spell_ability_on_grants(sub, grants, choices)
    c.assign_ids(choices)
    out["grants"], out["choices"] = grants, choices

    columns, slot_rows = table_groups(sub.get("subclassTableGroups"), problems)
    out["spellcasting"] = spellcasting(sub, slot_rows, columns, None, problems) or \
        (None if ability_used else {"ability": sub["spellcastingAbility"]})

    b = FeatureBuilder(sub.get("source"), cf_index, sf_index, problems)
    names = {str(sub.get("name", "")).lower(), str(sub.get("shortName", "")).lower()}
    for i, ref in enumerate(sub.get("subclassFeatures") or []):
        key, f = b.lookup(True, ref)
        if f is None:
            continue
        if i == 0 and str(f.get("name", "")).lower() in names:
            f, kids = b.add_children_only(True, ref)
            out["text"] = b.own_text(f) or None
            lvl = b.level(f.get("level") or 1)
            for k in kids:
                lvl["features"].append(k["id"])
                b.top_by_name.setdefault(base_name(k["name"]), k)
            continue
        b.top(True, ref)
    picks(sub, b, problems)
    if keep is not None:
        keep["builder"] = b
    out["features"] = b.features
    out["progression"] = progression(b)

    out["columns"] = [col for col in columns if col["id"] not in SPELL_COLUMNS]
    known = {r["id"] for r in (cls_record or {}).get("resources", [])}
    out["resources"] = resources(columns, b.consumed, known, problems)

    c.unhandled(sub, HANDLED_SUB, DROPPED_SUB, problems)
    try:
        return dump(SubclassEntry.model_validate(out)), problems
    except ValidationError as e:
        problems += [f"schema: {'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]
        return None, problems


def clean_class_book(book: dict) -> tuple[list[dict], dict[str, list[str]]]:
    """One resolved class book -> [class record, subclass records…]."""
    cf_index, sf_index = _index(book)
    records, problems = [], {}
    cls_record = None
    for cls in book.get("class", []):
        rec, probs = clean_class(cls, cf_index, sf_index)
        label = f"{cls.get('name')} ({cls.get('source')})"
        problems[label] = probs
        if rec:
            cls_record = rec
            records.append(rec)
    for sub in book.get("subclass", []):
        rec, probs = clean_subclass(sub, cls_record, cf_index, sf_index)
        label = f"{sub.get('className')} · {sub.get('name')} ({sub.get('source')})"
        problems[label] = probs
        if rec:
            records.append(rec)
    return records, problems


# ---------- LLM jobs ----------
#
# One job per top-level class feature (with the features it points at, and
# the text of its upgrades), and one job per subclass (all its features
# together, so pools spread over several features come out right). A
# feature shared with another class (Death Knight uses Paladin's) is a job
# of the class it comes from only, so it is asked once.

SPELLCASTING_NAMES = {"spellcasting", "pact magic"}


def _descendants(b: FeatureBuilder, fid: str) -> list[str]:
    out = []
    for f in b.features:
        if f.get("parent") == fid:
            out += [f["id"]] + _descendants(b, f["id"])
    return out


def _named_text(name: str, text: str) -> str:
    if not text:
        return f"**{name}.**"
    if text.startswith(("- ", "|", "*")):
        return f"**{name}.**\n\n{text}"
    return f"**{name}.** {text}"


def _job_text(b: FeatureBuilder, ids: list[str], upgrades: dict[str, list]) -> str:
    """The text the LLM reads: each feature as a **Name.** block; an upgrade
    as an italic note under its feature (so it never becomes a feature of
    its own)."""
    feats = {f["id"]: f for f in b.features}
    parts = []
    for fid in ids:
        f = feats[fid]
        parts.append(_named_text(f["name"], b.own_text(b.raw[fid])))
        for up in upgrades.get(fid, []):
            t = b.own_text(up)
            if t.strip() and t.strip() not in b.own_text(b.raw[fid]):
                parts.append(f"*{up.get('name')} (level {up.get('level')}):* {t}")
    return "\n\n".join(parts)


def _context(cls_record: dict, sub_record: dict | None = None) -> dict:
    """What a job may refer to: table columns (formula words), resources
    (ids for `consumes`) and the class's skill list (for picks)."""
    cols = list(cls_record.get("columns", [])) + list((sub_record or {}).get("columns", []))
    res = list(cls_record.get("resources", [])) + list((sub_record or {}).get("resources", []))
    skills = []
    for ch in cls_record.get("choices", []):
        if ch.get("grant") == "skills" and isinstance(ch.get("from"), list):
            skills = ch["from"]
    show = lambda v: ", ".join(f"{x} at {lv}" for lv, x in v.items())
    return {
        "columns": [f"{c_['id']} ({c_['name']}): {show(c_['values'])}" for c_ in cols],
        "resources": [f"{r['id']} ({r['name']})" for r in res],
        "class_skills": skills,
        "_words": [c_["id"] for c_ in cols],
        "_dice": [c_["id"] for c_ in cols if any(isinstance(v, str) and "d" in v for v in c_["values"].values())],
    }


def _raw_part(f: dict) -> dict:
    return {"name": f.get("name"), "level": f.get("level"), "entries": f.get("entries")}


def _skip_class_feature(cls: dict, f: dict) -> bool:
    """Class features with nothing for the LLM: the code covers them."""
    name = str(f.get("name", "")).strip().lower()
    picks_ = {str(p.get("name", "")).lower() for p in (cls.get("optionalfeatureProgression") or [])
              + (cls.get("featProgression") or [])}
    if name in picks_:
        return True
    if name in SPELLCASTING_NAMES and cls.get("casterProgression"):
        return True
    if name == "weapon mastery" and (cls.get("itemMasteries") or cls.get("itemMasteriesProgression")):
        return True
    # a list of options from another catalogue ("Eldritch Invocation Options")
    import json as _json
    blob = _json.dumps(f.get("entries"))
    if ('"refOptionalfeature"' in blob or '"refFeat"' in blob) and \
            sum(len(x) for x in f.get("entries") or [] if isinstance(x, str)) < 250:
        return True
    return False


def class_jobs(book: dict) -> list[dict]:
    """The LLM jobs of one resolved class book (without hash/state; the
    LLM step adds those)."""
    cf_index, sf_index = _index(book)
    jobs = []
    for cls in book.get("class", []):
        keep: dict = {}
        rec, _ = clean_class(cls, cf_index, sf_index, keep)
        if rec is None:
            continue
        b: FeatureBuilder = keep["builder"]
        ctx = _context(rec)
        cname = f"{cls['name']}|{cls['source']}".lower()
        for top in b.tops:
            fid = top["id"]
            if fid.split(":")[0] != rec["id"]:
                continue                       # another class's feature: that class's job
            f = b.raw[fid]
            if _skip_class_feature(cls, f):
                continue
            ids = [fid] + _descendants(b, fid)
            feats = {x["id"]: x for x in b.features}
            raw_input = {
                "kind": "class_feature", "edition": rec["edition"], "class": cls["name"],
                "features": [_raw_part(b.raw[i]) for i in ids],
                "upgrades": [_raw_part(u) for u in top["upgrades"]],
                "context": {k: v for k, v in ctx.items() if not k.startswith("_")},
            }
            send = {"name": feats[fid]["name"], "kind": "class_feature", "edition": rec["edition"],
                    "class": rec["name"], "subclass": None,
                    "features": [{"name": feats[i]["name"], "level": feats[i]["level"]} for i in ids],
                    **{k: v for k, v in ctx.items() if not k.startswith("_")},
                    "text": _job_text(b, ids, {fid: top["upgrades"]})}
            jobs.append({"id": fid, "label": f"{rec['name']} ({rec['source']}) · {feats[fid]['name']}",
                         "srd": bool(f.get("srd") or f.get("srd52")), "input": raw_input, "send": send,
                         "entry": cname, "entry_display": cname, "subrace": False, "book": book_key(rec),
                         "names": [feats[i]["name"] for i in ids], "words": ctx["_words"], "dice": ctx["_dice"]})
        for sub in book.get("subclass", []):
            skeep: dict = {}
            srec, _ = clean_subclass(sub, rec, cf_index, sf_index, skeep)
            if srec is None:
                continue
            sb: FeatureBuilder = skeep["builder"]
            sctx = _context(rec, srec)
            ids, ups = [], {}
            for top in sb.tops:
                ids += [top["id"]] + _descendants(sb, top["id"])
                ups[top["id"]] = top["upgrades"]
            if not ids:
                continue
            feats = {x["id"]: x for x in sb.features}
            raw_input = {
                "kind": "subclass", "edition": srec["edition"], "class": cls["name"], "subclass": sub["name"],
                "features": [_raw_part(sb.raw[i]) for i in ids],
                "upgrades": [_raw_part(u) for t in sb.tops for u in t["upgrades"]],
                "context": {k: v for k, v in sctx.items() if not k.startswith("_")},
            }
            send = {"name": srec["name"], "kind": "subclass", "edition": srec["edition"], "class": rec["name"],
                    "subclass": srec["name"],
                    "features": [{"name": feats[i]["name"], "level": feats[i]["level"]} for i in ids],
                    **{k: v for k, v in sctx.items() if not k.startswith("_")},
                    "text": _job_text(sb, ids, ups)}
            sname = f"{sub['name']}|{sub['source']}".lower()
            jobs.append({"id": srec["id"], "label": f"{rec['name']} ({rec['source']}) · {srec['name']} ({srec['source']})",
                         "srd": bool(sub.get("srd") or sub.get("srd52")), "input": raw_input, "send": send,
                         "entry": sname, "entry_display": sname, "subrace": True, "book": book_key(rec),
                         "names": [feats[i]["name"] for i in ids], "words": sctx["_words"], "dice": sctx["_dice"]})
    return jobs


def book_key(rec: dict) -> str:
    return rec["id"]
