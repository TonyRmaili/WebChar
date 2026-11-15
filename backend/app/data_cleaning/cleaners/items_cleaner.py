"""Code cleaner for items: base items, items, magic variants and item groups.

    clean_base_item(entry)  a mundane weapon, armor, tool… (kind "item", base: true)
    clean_item(entry)       any other item (kind "item")
    clean_variant(entry)    a magic variant (kind "item_variant"): "+1 Weapon", "Flame Tongue"
    clean_group(entry)      an item group (kind "item_group"): "Absorbing Tattoo"

Everything 5etools gives as data is done here: types, weapon and armor
stats, the +N bonuses, resistances, speeds, ability scores, spells cast
from the item, charges, attunement, light, focus, and the details of
vehicles, mounts, containers, packs and poisons. The features (activated
powers, toggles) are the LLM step's job; the text is made by code.

A variant's `requires`/`excludes` become `applies_to`: the ids of the base
items it can be made from. Its text keeps "{base}" where the base item's
name goes; item_merge.merge() fills it in when a real item is made.

Edition: base items mostly have one; everything else comes from
common_cleaner.edition_of (SRD flags, reprints, the book's other entries,
its publication date).
"""

import re

from pydantic import ValidationError

from ..data_files import RESOLVED_PATH, read_entries, read_extra
from ..schemas.common_schema import dump
from ..schemas.items_schema import Item, ItemGroup, ItemVariant
from . import common_cleaner as c

DMG_TYPES = {"A": "acid", "B": "bludgeoning", "C": "cold", "F": "fire", "O": "force", "L": "lightning",
             "N": "necrotic", "P": "piercing", "I": "poison", "Y": "psychic", "R": "radiant", "S": "slashing",
             "T": "thunder"}
ARMOR_TYPES = {"LA": "light", "MA": "medium", "HA": "heavy", "S": "shield"}
DEX_CAP = {"light": None, "medium": 2, "heavy": 0}
WEAPON_TYPES = {"M": "melee", "R": "ranged"}
# Raw true/false flags that say what family an item belongs to (for filters
# and for what a variant fits).
FAMILY_FLAGS = ["weapon", "armor", "sword", "axe", "bow", "crossbow", "dagger", "club", "hammer", "lance", "mace",
                "net", "polearm", "rapier", "spear", "staff", "firearm", "arrow", "bolt", "bulletFirearm",
                "bulletSling", "cellEnergy", "needleBlowgun", "ammo"]
MISC_TAGS = {"CNS": "consumable", "TT": "trinket", "CF/W": "creates_food_or_water"}
RESETS = {"dawn": "dawn", "dusk": "dusk", "midnight": "midnight", "restLong": "long_rest",
          "restShort": "short_rest", "special": "special"}
ALIGNMENT = {"L": "lawful", "N": "neutral", "C": "chaotic", "G": "good", "E": "evil", "U": "unaligned",
             "A": "any", "NX": "neutral (law/chaos)", "NY": "neutral (good/evil)"}
# bonus key -> modifier target (a weapon's own bonus goes on `weapon.bonus` instead)
BONUS_TARGETS = {
    "bonusAc": "ac", "bonusSpellAttack": "spell_attack", "bonusSpellSaveDc": "spell_dc",
    "bonusSavingThrow": "save", "bonusAbilityCheck": "check", "bonusProficiencyBonus": "pb",
    "bonusSavingThrowConcentration": "concentration", "bonusSpellDamage": "spell_damage",
}
WEAPON_BONUS = {"bonusWeapon": ("attack", "damage"), "bonusWeaponAttack": ("attack",), "bonusWeaponDamage": ("damage",)}

# The base item's stats a unique item built on it (`baseItem`) takes over.
BASE_FIELDS = ["type", "dmg1", "dmg2", "dmgType", "property", "range", "weaponCategory", "ac", "strength", "stealth",
               "mastery", "ammoType", "reload"] + FAMILY_FLAGS

PART_KEYS = {
    "type", "typeAlt", "wondrous", "poison", "tattoo", "rarity", "tier", "weight", "weightNote", "value", "dmg1",
    "dmg2", "dmgType", "property", "range", "weaponCategory", "mastery", "ammoType", "reload", "critThreshold",
    "ac", "strength", "stealth", "dexterityMax", "reqAttune", "reqAttuneAlt", "reqAttuneTags", "charges",
    "recharge", "rechargeAmount", "resist", "immune", "vulnerable", "conditionImmune", "modifySpeed", "ability",
    "attachedSpells", "light", "focus", "scfType", "group", "curse", "sentient", "miscTags", "classFeatures",
    "optionalfeatures", "poisonTypes", "spellScrollLevel", "age", "packContents", "containerCapacity", "crew",
    "crewMin", "crewMax", "vehAc", "vehHp", "vehSpeed", "capPassenger", "capCargo", "vehDmgThresh", "travelCost",
    "shippingCost", "speed", "carryingCapacity", "baseItem", "entries", "barding",
} | set(BONUS_TARGETS) | set(WEAPON_BONUS) | set(FAMILY_FLAGS)
HEADER_KEYS = {"name", "source", "edition", "srd", "srd52", "basicRules", "basicRules2024", "reprintedAs", "alias"}
DROPPED = {"page", "otherSources", "additionalSources", "referenceSources", "hasFluff", "hasFluffImages", "hasRefs",
           "lootTables", "detail1", "detail2", "seeAlsoDeck", "seeAlsoVehicle", "grantsLanguage",
           "grantsProficiency", "valueRarity", "barDimensions", "atomicPackContents", "_file"}

_tables: dict | None = None
_bases: dict | None = None
_groups: dict | None = None


# ---------- lookups ----------

def tables() -> dict:
    """{"types": {(abbr, source): name}, "properties": {…}} from the lookup
    lists 5etools keeps next to the items."""
    global _tables
    if _tables is None:
        raw = read_extra(RESOLVED_PATH, "items", "_tables") or {}
        types, props = {}, {}
        for t in raw.get("itemType") or []:
            if t.get("abbreviation") and t.get("name"):
                types[(t["abbreviation"].lower(), str(t.get("source", "")).lower())] = t["name"]
        for p in raw.get("itemProperty") or []:
            name = p.get("name")
            for e in p.get("entries") or []:
                if isinstance(e, dict) and e.get("name"):
                    name = e["name"]
                    break
            if p.get("abbreviation") and name:
                props[(p["abbreviation"].lower(), str(p.get("source", "")).lower())] = name
        _tables = {"types": types, "properties": props}
    return _tables


def _lookup(table: dict, code: str):
    """"HA|XPHB" -> the XPHB entry; "HA" -> the PHB/DMG one (or any)."""
    abbr, _, src = str(code).partition("|")
    abbr, src = abbr.lower(), src.lower()
    if src:
        return table.get((abbr, src))
    for s in ("phb", "dmg"):
        if (abbr, s) in table:
            return table[(abbr, s)]
    return next((v for (a, _), v in table.items() if a == abbr), None)


def base_items() -> dict[str, dict]:
    """{base item id: raw resolved base item}."""
    global _bases
    if _bases is None:
        _bases = {c.entry_id(b["name"], b["source"]): b for b in read_entries(RESOLVED_PATH, "items", "baseitem")}
    return _bases


STAR = " (*)"   # 5etools' mark for "same name and book as another entry"


def variant_id(v: dict) -> str:
    """"Arrow of Slaying (*)" (a variant with the same name as an item) gets
    "-variant", so it can't collide with the item's id."""
    vid = c.entry_id(v["name"].replace(STAR, ""), v["source"])
    return vid + "-variant" if STAR in v["name"] else vid


def member_id(ref: str, group: dict) -> str:
    """A member written without a book is from the group's own book."""
    return c.ref_id(ref if "|" in ref else f"{ref}|{group.get('source')}")


def _unstar(out: dict) -> None:
    """Show "Arrow of Slaying", not "Arrow of Slaying (*)"."""
    out["name"] = out["name"].replace(STAR, "")
    if out.get("srd"):
        out["srd"] = {k: v.replace(STAR, "") for k, v in out["srd"].items()}


def group_id(g: dict) -> str:
    """Groups get "-group" on their id: some share their name and book with
    an item ("Arcane Focus")."""
    return c.entry_id(g["name"].replace(STAR, ""), g["source"]) + "-group"


def group_of() -> dict[str, str]:
    """{member item id: group id}."""
    global _groups
    if _groups is None:
        _groups = {}
        for g in read_entries(RESOLVED_PATH, "items", "itemGroup"):
            gid = group_id(g)
            for m in g.get("items") or []:
                _groups.setdefault(member_id(m, g), gid)
    return _groups


# ---------- parts ----------

def _bonus(v) -> int | None:
    try:
        return int(str(v).replace(" ", ""))
    except ValueError:
        return None


def _money(v):
    if v is None:
        return None
    return c.cp_to_money(int(round(v))) or {"cp": 0}


def _dice_text(v):
    """"{@dice 1d6 + 1}" -> "1d6 + 1"; 7 -> 7."""
    if isinstance(v, str):
        m = re.fullmatch(r"\s*\{@dice ([^}|]+)(?:\|[^}]*)?\}\s*", v)
        return m.group(1).strip() if m else v.strip()
    return v


def item_types(e: dict, problems: list) -> list[str]:
    out = []
    for key in ("type", "typeAlt"):
        code = e.get(key)
        if not code or str(code).split("|")[0] == "GV":
            continue
        name = _lookup(tables()["types"], code)
        if name is None:
            problems.append(f"type: unknown item type '{code}'")
            name = str(code).split("|")[0]
        t = c.snake(name)
        if t not in out:
            out.append(t)
    for flag, t in (("wondrous", "wondrous_item"), ("poison", "poison"), ("tattoo", "tattoo")):
        if e.get(flag) and t not in out:
            out.append(t)
    return out


def weapon(e: dict, problems: list) -> dict | None:
    code = str(e.get("type") or "").split("|")[0]
    if not (e.get("dmg1") or e.get("weaponCategory") or code in WEAPON_TYPES):
        return None
    w: dict = {}
    if e.get("weaponCategory"):
        w["category"] = e["weaponCategory"]
    if code in WEAPON_TYPES:
        w["kind"] = WEAPON_TYPES[code]
    if e.get("dmg1"):
        dt = e.get("dmgType")
        if dt and dt not in DMG_TYPES:
            problems.append(f"weapon: unknown damage type '{dt}'")
        w["damage"] = {"dice": str(e["dmg1"]), "type": DMG_TYPES.get(dt, dt)}
    if e.get("dmg2"):
        w["versatile"] = str(e["dmg2"])
    if e.get("range"):
        a, _, b = str(e["range"]).partition("/")
        try:
            w["range"] = {"normal": int(a), "long": int(b) if b else None}
        except ValueError:
            problems.append(f"weapon: can't read range '{e['range']}'")
    props, notes = properties(e.get("property"), problems)
    if props:
        w["properties"] = props
    if notes:
        w["property_notes"] = notes
    if e.get("mastery"):
        w["mastery"] = [c.snake(str(m.get("uid") if isinstance(m, dict) else m).split("|")[0]) for m in e["mastery"]]
    if e.get("ammoType"):
        w["ammo"] = c.ref_id(e["ammoType"])
    if e.get("reload"):
        w["reload"] = e["reload"]
    if e.get("critThreshold"):
        w["crit_at"] = e["critThreshold"]
    return w


def properties(raw, problems: list) -> tuple[list, dict]:
    out, notes = [], {}
    for p in raw or []:
        code, note = (p.get("uid"), p.get("note")) if isinstance(p, dict) else (p, None)
        name = _lookup(tables()["properties"], code)
        if name is None:
            problems.append(f"property: unknown item property '{code}'")
            name = str(code).split("|")[0]
        pid = c.snake(name)
        if pid not in out:
            out.append(pid)
        if note:
            notes[pid] = note
    return out, notes


def armor(e: dict, problems: list) -> dict | None:
    cat = ARMOR_TYPES.get(str(e.get("type") or "").split("|")[0])
    if not cat:
        return None
    a: dict = {"category": cat}
    if e.get("ac") is not None:
        a["base"] = e["ac"]
    if cat != "shield":
        a["dex_cap"] = e["dexterityMax"] if "dexterityMax" in e else DEX_CAP[cat]
    if e.get("strength"):
        try:
            a["strength"] = int(e["strength"])
        except ValueError:
            problems.append(f"armor: can't read strength '{e['strength']}'")
    if e.get("stealth"):
        a["stealth_disadvantage"] = True
    return a


def attunement(e: dict, problems: list) -> dict | None:
    req = e.get("reqAttune")
    if not req and not e.get("reqAttuneTags"):
        return None
    out: dict = {"required": True}
    if isinstance(req, str) and req.lower() != "true":
        out["note"] = req
    if e.get("reqAttuneAlt"):
        out["note"] = " · ".join(x for x in (out.get("note"), f"attunement {e['reqAttuneAlt']}") if x)
    groups = []
    for t in e.get("reqAttuneTags") or []:
        g: dict = {}
        for k, v in t.items():
            if k == "class":
                g["class"] = c.snake(str(v).split("|")[0])
            elif k == "race":
                g["race"] = c.ref_id(v)
            elif k == "background":
                g["background"] = c.ref_id(v)
            elif k == "alignment":
                g["alignment"] = [ALIGNMENT.get(x, x) for x in v]
            elif k in ("spellcasting", "psionics"):
                g[k] = bool(v)
            elif k == "creatureType":
                g["creature_type"] = v
            elif k == "size":
                g["size"] = {"T": "tiny", "S": "small", "M": "medium", "L": "large"}.get(v, v)
            elif k in c.ABILITIES:
                g["ability"] = {k: v}
            elif k == "skillProficiency":
                g["skill"] = c.snake(v)
            elif k == "languageProficiency":
                g["language"] = c.snake(v)
            else:
                problems.append(f"attunement: can't read {k}={v!r}")
        if g:
            groups.append(g)
    if groups:
        out["requires"] = groups
    return out


def charges(e: dict) -> dict | None:
    if e.get("charges") is None and not e.get("recharge"):
        return None
    out: dict = {"max": _dice_text(e.get("charges")) if e.get("charges") is not None else "special"}
    if e.get("recharge"):
        out["reset"] = RESETS.get(e["recharge"], e["recharge"])
        out["regain"] = _dice_text(e["rechargeAmount"]) if e.get("rechargeAmount") is not None else "all"
    return out


def item_spells(raw, problems: list) -> list[dict]:
    """attachedSpells: spells cast FROM the item (how "item")."""
    grants = []

    def add(refs, uses, ability=None):
        for r in refs or []:
            if isinstance(r, str):
                grants.append(c.spell_grant(r, "item", None, uses, ability))
            else:
                problems.append(f"spells: can't read {r!r}")

    if isinstance(raw, list):
        add(raw, None)
        return grants
    if not isinstance(raw, dict):
        problems.append(f"spells: can't read {raw!r}")
        return grants
    ability = raw.get("ability")
    for k, v in raw.items():
        if k == "ability":
            continue
        if k == "will":
            add(v, "at_will", ability)
        elif k == "ritual":
            add(v, "ritual", ability)
        elif k == "other":
            add(v, None, ability)
        elif k in ("daily", "rest", "charges", "limited") and isinstance(v, dict):
            for n, refs in v.items():
                num = str(n).rstrip("e")
                if not num.isdigit():
                    problems.append(f"spells: can't read {k}.{n}")
                    continue
                if k == "charges":
                    uses = {"resource": "charges", "cost": int(num)}
                else:
                    uses = {"max": int(num), "reset": {"daily": "dawn", "rest": "short", "limited": "never"}[k]}
                add(refs, uses, ability)
        else:
            problems.append(f"spells: can't read '{k}'")
    return grants


def ability(raw, problems: list) -> tuple[dict, list, list]:
    """-> (grants.ability, choices, modifiers). {"static": {"str": 21}} is
    "your Strength becomes 21" (a minimum)."""
    if not isinstance(raw, dict):
        problems.append(f"ability: can't read {raw!r}")
        return {}, [], []
    mods = [{"target": k, "min": v} for k, v in (raw.get("static") or {}).items()]
    fixed = {k: v for k, v in raw.items() if k in c.ABILITIES}
    choose = raw.get("choose")
    if isinstance(choose, list) and choose and isinstance(choose[0], dict):
        choose = choose[0]
    elif isinstance(choose, list):
        choose = {"from": choose, "count": raw.get("count", 1), "amount": raw.get("amount", 1)}
    if choose is None and "from" in raw:
        choose = {"from": raw["from"], "count": raw.get("count", 1), "amount": raw.get("amount", 1)}
    choices = []
    if choose:
        _, choices = c.ability_scores([{"choose": choose}], problems)
    extra = set(raw) - {"static", "choose", "from", "count", "amount"} - set(c.ABILITIES)
    if extra:
        problems.append(f"ability: can't read {sorted(extra)}")
    return fixed, choices, mods


def speed(raw, problems: list) -> tuple[dict, list]:
    """modifySpeed -> (grants.speed, modifiers). `multiply` (Boots of Speed)
    only works while switched on: that's the LLM's toggle, not data."""
    sp, mods = {}, []
    for k, v in (raw or {}).get("equal", {}).items():
        sp[k] = v
    for k, v in (raw or {}).get("static", {}).items():
        sp[k] = v
    for k, v in (raw or {}).get("bonus", {}).items():
        mods.append({"target": "speed" if k == "*" else f"speed.{k}", "add": v})
    extra = set(raw or {}) - {"equal", "static", "bonus", "multiply"}
    if extra:
        problems.append(f"modifySpeed: can't read {sorted(extra)}")
    return sp, mods


def extra_details(e: dict) -> dict:
    out: dict = {}
    veh = {k: e[k] for k in ("crew", "crewMin", "crewMax", "vehAc", "vehHp", "vehSpeed", "capPassenger",
                             "capCargo", "vehDmgThresh", "travelCost", "shippingCost") if k in e}
    if veh:
        out["vehicle"] = {c.snake(re.sub(r"(?<!^)(?=[A-Z])", "_", k)): v for k, v in veh.items()}
    if "carryingCapacity" in e or ("speed" in e and isinstance(e["speed"], int)):
        out["mount"] = {k: v for k, v in (("speed", e.get("speed")), ("carrying_capacity", e.get("carryingCapacity")))
                        if v is not None}
    if e.get("containerCapacity"):
        out["container"] = e["containerCapacity"]
    if e.get("packContents"):
        items = []
        for p in e["packContents"]:
            if isinstance(p, str):
                items.append({"item": c.ref_id(p), "qty": 1})
            elif isinstance(p, dict) and p.get("item"):
                items.append({"item": c.ref_id(p["item"]), "qty": p.get("quantity", 1)})
            elif isinstance(p, dict) and p.get("special"):
                items.append({"name": p["special"], "qty": p.get("quantity", 1)})
        out["contents"] = items
    if e.get("poisonTypes"):
        out["poison_types"] = list(e["poisonTypes"])
    if e.get("spellScrollLevel") is not None:
        out["scroll_level"] = e["spellScrollLevel"]
    if e.get("age"):
        out["era"] = e["age"]
    if e.get("weightNote"):
        out["weight_note"] = e["weightNote"]
    return out


def item_parts(e: dict, out: dict, problems: list) -> None:
    """Everything an item and a variant share."""
    types = item_types(e, problems)
    if types:
        out["item_types"] = types
    for k in ("rarity", "tier", "weight"):
        if e.get(k) is not None:
            out[k] = e[k]
    if e.get("value") is not None:
        out["value"] = _money(e["value"])
    w = weapon(e, problems)
    for k, fields in WEAPON_BONUS.items():
        if e.get(k) is not None:
            w = w if w is not None else {}
            b = w.setdefault("bonus", {})
            for f in fields:
                b[f] = _bonus(e[k])
    if w is not None:
        out["weapon"] = w
    a = armor(e, problems)
    if a:
        out["armor"] = a
    mods = []
    for k, target in BONUS_TARGETS.items():
        if e.get(k) is not None:
            n = _bonus(e[k])
            if n is None:
                problems.append(f"{k}: can't read {e[k]!r}")
            else:
                mods.append({"target": target, "add": n})
    att = attunement(e, problems)
    if att is not None:
        out["attunement"] = att
    ch = charges(e)
    if ch:
        out["charges"] = ch

    grants: dict = {}
    choices: list = []
    g, cho = c.defenses(e, problems)
    c.add_grants(grants, g)
    choices += cho
    if e.get("modifySpeed"):
        sp, sm = speed(e["modifySpeed"], problems)
        if sp:
            grants["speed"] = sp
        mods += sm
    if e.get("ability"):
        fixed, cho, am = ability(e["ability"], problems)
        if fixed:
            grants["ability"] = fixed
        choices += cho
        mods += am
    if e.get("attachedSpells"):
        sp = item_spells(e["attachedSpells"], problems)
        if sp:
            grants["spells"] = sp
    c.assign_ids(choices)
    out["grants"], out["choices"] = grants, choices
    if mods:
        out["modifiers"] = mods

    if e.get("light"):
        out["light"] = e["light"]
    if e.get("focus"):
        out["focus"] = True if e["focus"] is True else [c.snake(x) for x in e["focus"]]
    if e.get("scfType"):
        out["focus_type"] = e["scfType"]
    for k in ("curse", "sentient"):
        if e.get(k):
            out[k] = True
    tags = [c.snake(re.sub(r"(?<!^)(?=[A-Z])", "_", f)) for f in FAMILY_FLAGS if e.get(f)]
    for t in e.get("miscTags") or []:
        if t not in MISC_TAGS:
            problems.append(f"misc tag: unknown '{t}'")
        tags.append(MISC_TAGS.get(t, t.lower()))
    if e.get("classFeatures") or e.get("optionalfeatures"):
        tags.append("artificer_replicable")
    if e.get("barding"):
        tags.append("barding")
    if e.get("group"):
        tags += [c.snake(x) for x in e["group"]]
    if tags:
        out["item_tags"] = list(dict.fromkeys(tags))
    ex = extra_details(e)
    if ex:
        out["extra"] = ex


def _edition(e: dict, problems: list) -> str | None:
    return e.get("edition") or c.edition_of(e, problems, "items")


def _validate(model, out, problems):
    try:
        return dump(model.model_validate(out)), problems
    except ValidationError as err:
        problems += [f"schema: {'.'.join(map(str, x['loc']))}: {x['msg']}" for x in err.errors()]
        return None, problems


# ---------- the four kinds ----------

def clean_item(entry: dict, base: bool = False) -> tuple[dict | None, list[str]]:
    problems: list[str] = []
    e = dict(entry)
    if e.get("baseItem") and not base:
        b = base_items().get(c.ref_id(e["baseItem"]))
        if b is None:
            problems.append(f"base item '{e['baseItem']}' not found")
        else:
            for k in BASE_FIELDS:
                if k not in e and k in b:
                    e[k] = b[k]
    out = c.header(e, "item", problems, read_prerequisite=False)
    edition = _edition(e, problems)
    if edition is None:
        return None, problems
    out["edition"] = edition
    if base:
        out["base"] = True
    if e.get("baseItem"):
        out["base_item"] = c.ref_id(e["baseItem"])
    item_parts(e, out, problems)
    grp = group_of().get(out["id"])
    if grp:
        out["group"] = grp
    c.unhandled(entry, PART_KEYS | HEADER_KEYS, DROPPED, problems)
    return _validate(Item, out, problems)


def clean_base_item(entry: dict) -> tuple[dict | None, list[str]]:
    return clean_item(entry, base=True)


# {=bonusWeapon} and friends in a variant's text
TOKEN = re.compile(r"\{=(\w+)(?:/(\w+))?\}")
BASE_TOKENS = {"baseName": "{base}", "dmgType": "{base_damage_type}"}


def fill_tokens(entries, values: dict, problems: list):
    """Variant text: "{=bonusWeapon}" -> "+1"; "{=baseName/l}" -> "{base_lower}"
    (filled in when a real item is made)."""
    def one(m):
        key, mod = m.group(1), m.group(2)
        if key in BASE_TOKENS:
            ph = BASE_TOKENS[key]
            return ph.replace("}", "_lower}") if mod == "l" else ph
        if key in values and values[key] is not None:
            v = str(values[key])
            return v.lower() if mod == "l" else v
        problems.append(f"text: unknown variant token '{{={key}}}'")
        return f"[{key}]"

    def walk(x):
        if isinstance(x, str):
            return TOKEN.sub(one, x)
        if isinstance(x, list):
            return [walk(y) for y in x]
        if isinstance(x, dict):
            return {k: walk(v) for k, v in x.items()}
        return x
    return walk(entries)


def variant_view(v: dict, problems: list | None = None) -> dict:
    """A variant as an item-like dict: what it gives (`inherits`), plus its
    name, book and edition, with its text's tokens filled."""
    problems = [] if problems is None else problems
    inh = dict(v.get("inherits") or {})
    view = {k: x for k, x in inh.items() if k not in ("namePrefix", "nameSuffix", "nameRemove", "propertyAdd",
                                                      "valueExpression", "valueMult", "weightExpression",
                                                      "weightMult", "source", "page")}
    view["name"], view["source"] = v.get("name"), v.get("source")
    if v.get("edition"):
        view["edition"] = v["edition"]
    entries = inh.get("entries") or v.get("entries") or []
    view["entries"] = fill_tokens(entries, inh, problems)
    return view


def _matches(base: dict, cond: dict) -> bool:
    for k, want in cond.items():
        have = base.get(k)
        if k == "property":
            props = [str(p.get("uid") if isinstance(p, dict) else p).lower() for p in base.get("property") or []]
            if not any(str(w).lower() in props for w in (want if isinstance(want, list) else [want])):
                return False
        elif k == "name":
            names = [str(w).lower() for w in (want if isinstance(want, list) else [want])]
            if str(have or "").lower() not in names:
                return False
        elif isinstance(want, str):
            if str(have or "").lower() != want.lower():
                return False
        elif isinstance(want, bool):
            if bool(have) != want:
                return False
        elif have != want:
            return False
    return True


def applies_to(v: dict, problems: list) -> list[str]:
    """The base items a variant can be made from: any `requires` group
    matches, and no `excludes` key does."""
    req = v.get("requires") or []
    exc = v.get("excludes") or {}
    out = []
    for bid, b in base_items().items():
        if req and not any(_matches(b, r) for r in req):
            continue
        if exc and any(_matches(b, {k: w}) for k, w in exc.items()):
            continue
        out.append(bid)
    if not out:
        problems.append("applies_to: no base item fits this variant")
    return out


VARIANT_TOP = {"name", "source", "type", "requires", "excludes", "inherits", "edition", "ammo", "entries",
               "hasFluffImages", "referenceSources", "_file"}
VARIANT_INHERITS = PART_KEYS | HEADER_KEYS | DROPPED | {
    "namePrefix", "nameSuffix", "nameRemove", "propertyAdd", "valueExpression", "valueMult", "weightExpression",
    "weightMult", "page"}


def clean_variant(entry: dict) -> tuple[dict | None, list[str]]:
    problems: list[str] = []
    view = variant_view(entry, problems)
    out = c.header(view, "item_variant", problems, read_prerequisite=False)
    out["id"] = variant_id(entry)
    _unstar(out)
    edition = _edition(view, problems)
    if edition is None:
        return None, problems
    out["edition"] = edition
    inh = entry.get("inherits") or {}
    item_parts(view, out, problems)
    out["applies_to"] = applies_to(entry, problems)
    out["name_format"] = f"{inh.get('namePrefix', '')}{{base}}{inh.get('nameSuffix', '')}"
    if inh.get("nameRemove"):
        out["name_remove"] = inh["nameRemove"]
    if inh.get("propertyAdd"):
        out["properties_add"] = properties(inh["propertyAdd"], problems)[0]
    if inh.get("valueExpression") or inh.get("valueMult"):
        expr = inh.get("valueExpression") or f"[[baseItem.value]] * {inh['valueMult']}"
        out["value"] = {"formula": expr.replace("[[baseItem.value]]", "base").replace("[[baseItem.weight]]", "base")}
    if inh.get("weightExpression") or inh.get("weightMult"):
        expr = inh.get("weightExpression") or f"[[baseItem.weight]] * {inh['weightMult']}"
        out.setdefault("extra", {})["weight_formula"] = expr.replace("[[baseItem.weight]]", "base")
    if entry.get("ammo"):
        out.setdefault("item_tags", []).append("ammo")
    overrides = {}
    if "stealth" in inh:
        overrides["stealth_disadvantage"] = bool(inh["stealth"])
    if "strength" in inh:
        overrides["strength"] = int(inh["strength"]) if inh["strength"] else 0     # 0 = no requirement
    if overrides:
        out["armor_overrides"] = overrides
    for k in inh:
        if k not in VARIANT_INHERITS:
            problems.append(f"key 'inherits.{k}' not handled")
    c.unhandled(entry, VARIANT_TOP, set(), problems)
    return _validate(ItemVariant, out, problems)


def clean_group(entry: dict) -> tuple[dict | None, list[str]]:
    """A group only lists its members: each member is a complete item of
    its own, so the group's other keys (shown by 5etools as a summary) are
    not kept."""
    problems: list[str] = []
    out = c.header(entry, "item_group", problems, read_prerequisite=False)
    out["id"] = group_id(entry)
    _unstar(out)
    # 5etools' own editing note ("* This item group has the same name…") isn't rules text
    out["text"] = "\n\n".join(p for p in (out.get("text") or "").split("\n\n")
                               if not p.lstrip("*_ ").startswith("This item group has the same name"))
    edition = _edition(entry, problems)
    if edition is None:
        return None, problems
    out["edition"] = edition
    out["members"] = [member_id(m, entry) for m in entry.get("items") or []]
    if entry.get("rarity"):
        out["rarity"] = entry["rarity"]
    if entry.get("itemsHidden"):
        out["hidden_members"] = True
    return _validate(ItemGroup, out, problems)