"""Code cleaner for monsters: one resolved monster -> our shape. No LLM.

    clean_monster(entry) -> (cleaned dict, problems)

Monster text is written with fixed tags ({@atkr m} {@hit 14}, reach 10 ft.
{@h}13 ({@damage 1d10 + 8}) Slashing damage …; {@actSave dex} {@dc 21} …),
so attacks, saves, damage, recharge and uses are read by code into the same
feature shape every category uses. What code can't read stays in the
feature's text, and the report counts traits and actions whose numbers
weren't read (`numbers not read`), so we can see how much is left.

Fixed numbers: a monster's to-hit, DC and damage bonus are plain numbers.
"""

import re

from pydantic import ValidationError

from .. import text_renderer
from ..data_resolver import cr_pb
from ..schemas.common_schema import dump
from ..schemas.monsters_schema import Monster
from . import common_cleaner as c

HANDLED = {
    "name", "source", "srd", "srd52", "reprintedAs", "alias", "shortName", "size", "sizeNote", "type", "typeNote",
    "alignment", "alignmentPrefix", "ac", "hp", "speed", "str", "dex", "con", "int", "wis", "cha", "save", "skill",
    "senses", "passive", "resist", "immune", "vulnerable", "conditionImmune", "languages", "cr", "level", "pbNote",
    "initiative", "trait", "action", "bonus", "reaction", "legendary", "mythic", "legendaryHeader", "mythicHeader",
    "reactionHeader", "actionNote", "reactionNote", "legendaryActions", "legendaryActionsLair", "spellcasting",
    "lairActions", "regionalEffects", "mythicEncounter", "gear", "attachedItems", "environment", "treasure",
    "group", "familiar", "isNpc", "isNamedCreature", "dragonAge", "dragonCastingColor", "summonedBySpell",
    "summonedBySpellLevel", "summonedByClass", "variant", "_version_of", "edition",
    "damageTags", "damageTagsSpell", "damageTagsLegendary", "conditionInflict", "conditionInflictSpell",
    "conditionInflictLegendary", "savingThrowForced", "savingThrowForcedSpell", "savingThrowForcedLegendary",
    "senseTags", "actionTags", "traitTags", "miscTags", "languageTags", "spellcastingTags",
}
DROPPED = {
    "page", "_file", "otherSources", "referenceSources", "hasFluff", "hasFluffImages", "hasToken", "tokenCredit",
    "tokenCustom", "soundClip", "altArt", "foundryTokenScale", "basicRules", "basicRules2024", "isReprinted",
}

SIZES = {"T": "tiny", "S": "small", "M": "medium", "L": "large", "H": "huge", "G": "gargantuan", "V": "varies"}
ABILITY_NAMES = {"strength": "str", "dexterity": "dex", "constitution": "con", "intelligence": "int",
                 "wisdom": "wis", "charisma": "cha"}
DAMAGE_TYPES = {"acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison",
                "psychic", "radiant", "slashing", "thunder"}
SECTIONS = {"trait": "traits", "action": "actions", "bonus": "bonus_actions", "reaction": "reactions",
            "legendary": "legendary_actions", "mythic": "mythic_actions"}
ATTACK_KIND = {"mw": "melee", "m": "melee", "rw": "ranged", "r": "ranged", "mw,rw": "melee_or_ranged",
               "m,r": "melee_or_ranged", "ms": "spell", "rs": "spell", "ms,rs": "spell"}

# 5etools' tag codes -> words, for the catalogue's filters
DAMAGE_CODES = {"A": "acid", "B": "bludgeoning", "C": "cold", "F": "fire", "O": "force", "L": "lightning",
                "N": "necrotic", "P": "piercing", "I": "poison", "Y": "psychic", "R": "radiant", "S": "slashing",
                "T": "thunder"}
SENSE_CODES = {"B": "blindsight", "D": "darkvision", "SD": "superior_darkvision", "T": "tremorsense", "U": "truesight"}
SPELLCASTING_CODES = {"I": "innate", "P": "psionics", "F": "form", "S": "shared", "O": "other",
                      "CA": "artificer", "CB": "bard", "CC": "cleric", "CD": "druid", "CP": "paladin",
                      "CR": "ranger", "CS": "sorcerer", "CL": "warlock", "CW": "wizard"}
MISC_CODES = {"AOE": "area_of_effect", "CUR": "curse", "DIS": "disease", "HPR": "hit_point_reduction",
              "MA": "melee_attack", "MLW": "melee_weapon", "MW": "melee_weapon_attack", "RA": "ranged_attack",
              "RCH": "reach", "RNG": "ranged_weapon", "RW": "ranged_weapon_attack", "THW": "thrown_weapon"}

ALIGN = {"L": "lawful", "C": "chaotic", "N": "neutral", "NX": "neutral", "NY": "neutral", "G": "good",
         "E": "evil", "U": "unaligned", "A": "any alignment"}
ALIGN_SETS = [
    ({"L", "NX", "C", "G", "NY", "E"}, "any alignment"),
    ({"NX", "C", "G", "NY", "E"}, "any non-lawful alignment"),
    ({"L", "NX", "G", "NY", "E"}, "any non-chaotic alignment"),
    ({"L", "NX", "C", "NY", "E"}, "any non-good alignment"),
    ({"L", "NX", "C", "G", "NY"}, "any non-evil alignment"),
    ({"L", "G", "NY", "E"}, "any lawful alignment"),
    ({"C", "G", "NY", "E"}, "any chaotic alignment"),
    ({"L", "NX", "C", "G"}, "any good alignment"),
    ({"L", "NX", "C", "E"}, "any evil alignment"),
]
CR_XP = {"0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
         "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000,
         "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
         "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000,
         "28": 120000, "29": 135000, "30": 155000}


def text(x, problems: list) -> str:
    """Rich text -> our text (text_renderer)."""
    if x is None:
        return ""
    return text_renderer.render(x if isinstance(x, list) else [x], problems)


def plain(s, problems: list) -> str:
    return text_renderer.tags(str(s), problems).strip()


def _int(s):
    try:
        return int(str(s).replace("+", "").replace("−", "-").strip())
    except (TypeError, ValueError):
        return None


# ---------- the top of the statblock ----------

def size(entry: dict, problems: list) -> list[str]:
    out = []
    for s in entry.get("size") or []:
        if s not in SIZES:
            problems.append(f"size: unknown '{s}'")
        out.append(SIZES.get(s, str(s).lower()))
    return out


def creature_type(raw, problems: list) -> dict:
    """"fiend" or {"type": "fiend", "tags": ["devil"], "swarmSize": "T"}."""
    if raw is None:
        return {}
    if isinstance(raw, str):
        return {"type": raw.lower()}
    t = raw.get("type")
    out = {}
    if isinstance(t, dict) and "choose" in t:
        out["type"] = [x.lower() for x in t["choose"]]
    elif isinstance(t, str):
        out["type"] = t.lower()
    else:
        problems.append(f"type: can't read {raw!r}")
    tags = []
    for tg in raw.get("tags") or []:
        if isinstance(tg, str):
            tags.append(tg.lower())
        elif isinstance(tg, dict) and tg.get("tag"):
            tags.append(tg["tag"].lower())
            if tg.get("prefix") and not tg.get("prefixHidden"):
                tags[-1] = f"{tg['prefix'].lower()} {tags[-1]}"
    if tags:
        out["tags"] = tags
    if raw.get("swarmSize"):
        out["swarm_of"] = SIZES.get(raw["swarmSize"], raw["swarmSize"])
    extra = set(raw) - {"type", "tags", "swarmSize", "sidekickType", "sidekickTags", "sidekickHidden", "note",
                        "typeHidden"}
    if extra:
        problems.append(f"type: can't read {sorted(extra)}")
    return out


def _align_codes(codes: list) -> str:
    s = set(codes)
    for group, words in ALIGN_SETS:
        if s == group:
            return words
    if s == {"N"}:
        return "neutral"
    return " ".join(ALIGN.get(x, x.lower()) for x in codes)


def alignment(entry: dict, problems: list) -> list[str]:
    raw = entry.get("alignment") or []
    codes = [x for x in raw if isinstance(x, str)]
    out = [_align_codes(codes)] if codes else []
    for x in raw:
        if isinstance(x, dict):
            if "special" in x:
                out.append(plain(x["special"], problems))
            elif "alignment" in x:
                words = _align_codes(x["alignment"])
                out.append(f"{words} ({x['chance']}%)" if x.get("chance") else words)
            else:
                problems.append(f"alignment: can't read {x!r}")
    return out


def armor_class(entry: dict, problems: list) -> list[dict]:
    out = []
    for a in entry.get("ac") or []:
        if isinstance(a, int):
            out.append({"value": a})
        elif isinstance(a, dict) and "special" in a:
            out.append({"special": plain(a["special"], problems)})
        elif isinstance(a, dict) and "ac" in a:
            row = {"value": a["ac"]}
            if a.get("from"):
                row["from"] = [plain(f, problems) for f in a["from"]]
            if a.get("condition"):
                row["condition"] = plain(a["condition"], problems)
            out.append(row)
        else:
            problems.append(f"ac: can't read {a!r}")
    return out


def hit_points(entry: dict, problems: list) -> dict | None:
    hp = entry.get("hp")
    if not isinstance(hp, dict):
        return None
    out = {k: hp[k] for k in ("average", "formula") if hp.get(k) is not None}
    if hp.get("isTemporary"):
        out["temporary"] = True          # a Wild Shape form's hit points are temporary
    if hp.get("special"):
        sp = plain(hp["special"], problems)
        if sp.isdigit():
            out["average"] = int(sp)
        else:
            out["special"] = sp
    return out


SPEED_MODES = ("walk", "fly", "swim", "climb", "burrow")


def speed(entry: dict, problems: list) -> dict:
    raw = entry.get("speed") or {}
    if isinstance(raw, int):
        return {"walk": raw}
    out, notes = {}, {}
    for k, v in raw.items():
        if k in SPEED_MODES:
            if isinstance(v, int):
                out[k] = v
            elif isinstance(v, dict) and "number" in v:
                out[k] = v["number"]
                cond = str(v.get("condition") or "").strip()
                if cond.strip("()").lower() == "hover":
                    out["hover"] = True
                elif cond:
                    notes[k] = plain(cond.strip("()"), problems)
            elif v is True:
                out[k] = "walk"           # equal to its walking speed
            else:
                problems.append(f"speed: can't read {k}={v!r}")
        elif k == "canHover":
            out["hover"] = bool(v)
        elif k == "alternate":
            for mode, alts in v.items():
                for alt in alts:
                    if isinstance(alt, dict):
                        notes.setdefault(mode, "")
                        notes[mode] = (notes[mode] + "; " if notes[mode] else "") + \
                            f"{alt.get('number')} ft. {plain(str(alt.get('condition', '')).strip('()'), problems)}".strip()
        elif k == "choose":
            notes["choose"] = f"{v.get('amount')} ft. {' or '.join(v.get('from', []))} {v.get('note', '')}".strip()
        else:
            problems.append(f"speed: can't read '{k}'")
    if notes:
        out["notes"] = notes
    return out


def abilities(entry: dict, problems: list) -> tuple[dict, str | None]:
    """Scores, and a note when a score isn't a number (a druid's Wild Shape
    form: "Your Strength and Dexterity scores are equal to your Wisdom score")."""
    out, notes = {}, []
    for a in c.ABILITIES:
        v = entry.get(a)
        if isinstance(v, int):
            out[a] = v
        elif isinstance(v, dict) and "special" in v:
            out[a] = None
            note = plain(v["special"], problems)
            if note not in notes:
                notes.append(note)
        elif v is not None:
            problems.append(f"abilities: can't read {a}={v!r}")
    return out, " ".join(notes) or None


# A summon's bonus that grows with its summoner: "+2 plus PB", "+0 plus PB × 2", "+1 + PB"
PB_BONUS = re.compile(r"^([+-]?\d+)\s*(?:plus|\+)\s*PB(?:\s*[×x*]\s*(\d+))?$", re.I)
# "+4 (+6 while in snake form)"
BONUS_ALT = re.compile(r"^([+-]?\d+)\s*\(([+-]?\d+)\s+(.+)\)$")


def bonus(v, what: str, key: str, problems: list, notes: list):
    """A save or skill bonus: an int, or a formula string for a summon
    ("2 + pb", "pb * 2"). An alternative value in brackets goes to notes."""
    n = _int(v)
    if n is not None:
        return n
    t = str(v).strip()
    m = PB_BONUS.match(t)
    if m:
        base = int(m.group(1))
        pb = f"pb * {m.group(2)}" if m.group(2) else "pb"
        return f"{base} + {pb}" if base else pb
    m = BONUS_ALT.match(t)
    if m:
        notes.append(f"{c.title(key)} {m.group(2)} {m.group(3)}")
        return int(m.group(1))
    problems.append(f"{what}: can't read {key}={v!r}")
    return None


def saves(entry: dict, problems: list) -> tuple[dict, str | None]:
    out, notes = {}, []
    for k, v in (entry.get("save") or {}).items():
        if k == "special":
            notes.append(plain(v, problems))
            continue
        if k not in c.ABILITIES:
            problems.append(f"save: can't read {k}={v!r}")
            continue
        n = bonus(v, "save", k, problems, notes)
        if n is not None:
            out[k] = n
    return out, "; ".join(notes) or None


def skills(entry: dict, problems: list) -> tuple[dict, str | None]:
    out, notes = {}, []
    for k, v in (entry.get("skill") or {}).items():
        if k == "other":
            for o in v:
                one = (o.get("oneOf") or {}) if isinstance(o, dict) else {}
                notes.append("one of " + ", ".join(f"{c.title(s)} {b}" for s, b in one.items()))
            continue
        if k == "special":
            notes.append(plain(v, problems))
            continue
        n = bonus(v, "skill", k, problems, notes)
        if n is not None:
            out[c.snake(k)] = n
    return out, "; ".join(notes) or None


SENSE_RE = re.compile(r"^(blindsight|darkvision|tremorsense|truesight)\s+(\d+)\s*ft\.?\s*(.*)$", re.I)


def senses(entry: dict, problems: list) -> dict:
    out, notes = {}, []
    for s in entry.get("senses") or []:
        t = plain(s, problems)
        m = SENSE_RE.match(t)
        if m:
            out[m.group(1).lower()] = int(m.group(2))
            if m.group(3).strip():
                notes.append(f"{m.group(1).lower()} {m.group(3).strip()}")
        else:
            notes.append(t)
    if notes:
        out["notes"] = "; ".join(notes)
    return out


DEF_KEYS = {"resist": "resist", "immune": "immune", "vulnerable": "vulnerable", "conditionImmune": "condition_immune"}


def _flat_types(lst: list) -> list[str]:
    out = []
    for x in lst or []:
        if isinstance(x, str):
            out.append(x.lower())
        elif isinstance(x, dict):
            for k in DEF_KEYS:
                if k in x:
                    out += _flat_types(x[k])
    return out


def defenses(entry: dict, problems: list) -> dict:
    """{"resist": {"types": [...], "conditional": [{"types", "note"}], "special"}, …}:
    plain types, types that only apply sometimes (with the text that says
    when), and a special line that is only text."""
    out = {}
    for raw_key, key in DEF_KEYS.items():
        raw = entry.get(raw_key)
        if not raw:
            continue
        block = {"types": [], "conditional": []}
        for x in raw:
            if isinstance(x, str):
                block["types"].append(x.lower())
            elif isinstance(x, dict) and "special" in x:
                block["special"] = plain(x["special"], problems)
            elif isinstance(x, dict) and any(k in x for k in DEF_KEYS):
                note = " ".join(plain(x[n], problems) for n in ("preNote", "note") if x.get(n)).strip()
                block["conditional"].append({"types": _flat_types([x]), "note": note or None})
            else:
                problems.append(f"{raw_key}: can't read {x!r}")
        out[key] = {k: v for k, v in block.items() if v}
    return out


def challenge(entry: dict, problems: list) -> dict | None:
    raw = entry.get("cr")
    if raw is None:
        return None
    if isinstance(raw, str):
        raw = {"cr": raw}
    cr = str(raw.get("cr"))
    if cr in ("None", "Unknown", "—", ""):
        return {"cr": "unknown"}               # some adventure NPCs have no rating
    out = {"cr": cr, "xp": raw.get("xp", CR_XP.get(cr)), "pb": cr_pb(cr)}
    if cr not in CR_XP:
        problems.append(f"cr: unknown '{cr}'")
    if raw.get("lair"):
        out["lair"] = str(raw["lair"])
        out["xp_lair"] = CR_XP.get(str(raw["lair"]))
    if raw.get("xpLair"):
        out["xp_lair"] = raw["xpLair"]
    if raw.get("coven"):
        out["coven"] = str(raw["coven"])
        out["xp_coven"] = CR_XP.get(str(raw["coven"]))
    extra = set(raw) - {"cr", "xp", "lair", "xpLair", "coven"}
    if extra:
        problems.append(f"cr: can't read {sorted(extra)}")
    return out


def initiative(entry: dict, scores: dict, pb: int | None) -> dict:
    dex = (scores.get("dex") or 10)
    mod = (dex - 10) // 2
    raw = entry.get("initiative")
    if isinstance(raw, int):
        return {"bonus": raw}
    out = {"bonus": mod}
    if isinstance(raw, dict):
        out["bonus"] = mod + (pb or 0) * int(raw.get("proficiency", 0))
        if raw.get("advantageMode") == "adv":
            out["advantage"] = True
        if "initiative" in raw:
            out["bonus"] = raw["initiative"]
    return out


# ---------- traits and actions ----------

NAME_USES = [
    (re.compile(r"\s*\((\d+)/Day(?: Each)?(?:, or (\d+)/Day in (\w+))?\)", re.I), "day"),
    (re.compile(r"\s*\((\d+)/Turn\)", re.I), "turn"),
    (re.compile(r"\s*\(Recharges after a Short or Long Rest\)", re.I), "short"),
    (re.compile(r"\s*\(Recharges after a Long Rest\)", re.I), "long"),
]
COST_RE = re.compile(r"\s*\(Costs (\d+) Actions\)", re.I)
RECHARGE_RE = re.compile(r"\s*\{@recharge(?: (\d))?\}")

# "13 ({@damage 1d10 + 8}) Slashing damage"; "15 ({@damage 1d12 + 4} plus {@damage 1d8}) slashing
# damage"; a summon's "{@damage 1d8 + 3 + summonSpellLevel} Force damage". With no type word
# ("an extra 14 (4d6) damage") the damage is the weapon's own type.
# A type word, maybe with a summon's label: "Radiant (Celestial)"
_TYPE = r"[A-Za-z]+(?:\s*\([^)]*\))?"
# One type or a list to pick from: "fire", "Piercing or Slashing", "acid, cold, fire, or thunder"
_TYPES = rf"{_TYPE}(?:\s*,\s*(?:or\s+)?{_TYPE})*(?:,?\s+or\s+{_TYPE})?"
_ABILITY = r"Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma"
DMG_PART = re.compile(r"(?:(\d+)\s*)?\(?((?:\{@damage [^}]+\}(?:\s*plus\s*)?)+)\)?"
                      rf"(\s+(?:plus|\+) (?:PB|your (?:{_ABILITY}) modifier|this spell's level))?\s+"
                      rf"(?:(?:of\s+)?({_TYPES})\s+)?damage\b", re.I)
# Text fixes before reading damage: a type list with no "damage" after it
# ("…) Slashing." in WoW; the kobold's "of a type of its choice: acid, …"),
# and 2014's "bludgeoning, magic damage" (magical bludgeoning).
NO_DAMAGE_WORD = re.compile(rf"(\{{@damage [^}}]+\}}\)?)\s+(?:of a type of [^:]{{0,40}}:\s*)?({_TYPES})(?=[.;])", re.I)
MAGIC_WORD = re.compile(r",\s*magic(?:al)? damage", re.I)
DMG_TAG = re.compile(r"\{@damage ([^}]+)\}")
FLAT_DMG = re.compile(r"(?<![\w(])(\d+)\s+([A-Za-z]+) damage", re.I)
DC_ABILITY = re.compile(r"\{@dc (\d+)\}\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw", re.I)
ACT_SAVE = re.compile(r"\{@actSave (\w+)\}\s*\{@dc (\d+)\}")
# A summon's or a Wild Shape form's save uses its summoner's DC
ACT_SAVE_SPELL = re.compile(r"\{@actSave (\w+)\}\s*DC equals your spell save DC", re.I)
SPELL_DC_ABILITY = re.compile(r"(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw "
                              r"against your spell save DC", re.I)
CONDITION = re.compile(r"\{@condition ([^}|]+)")
AREA = re.compile(r"(\d+)-foot(?:-radius|-long|-wide|[-, \d]*foot-wide)?\s*(?:\{@variantrule )?(cone|sphere|cube|line|cylinder|emanation|radius|square)", re.I)
REACH = re.compile(r"reach (\d+) ft\.(?: or range (\d+(?:/\d+)?) ft\.)?", re.I)
RANGE = re.compile(r"range (\d+(?:/\d+)?) ft\.", re.I)
RIDER = re.compile(r"\bextra\b.*\bdamage\b|\bhits?\b.*\bextra\b", re.I | re.S)
# Words after a damage roll that read like a condition but aren't one: the
# save's own wording, "on a hit", "to the target".
NOT_A_CONDITION = re.compile(r"^(?:on a (?:failed sav|failure|hit\b)|to (?:the|a|its) target\b|to (?:it|each of them)$)", re.I)
CONDITIONAL = re.compile(r"^[\s,]*(if|while|when|against|on a|to)\b([^.;]*)", re.I)


def name_and_uses(raw_name: str, problems: list) -> tuple[str, dict | None, int | None]:
    """"Fire Breath {@recharge 5}" -> ("Fire Breath", uses {1, recharge 5}, None)
    "Wing Attack (Costs 2 Actions)" -> ("Wing Attack", None, 2)."""
    name, uses, cost = raw_name or "", None, None
    m = RECHARGE_RE.search(name)
    if m:
        uses = {"max": 1, "reset": "recharge", "recharge": int(m.group(1) or 6)}
        name = RECHARGE_RE.sub("", name)
    for rx, reset in NAME_USES:
        m = rx.search(name)
        if m:
            n = int(m.group(1)) if m.groups() and m.group(1) and m.group(1).isdigit() else 1
            uses = {"max": n, "reset": "long" if reset == "day" else reset}
            if reset == "day" and m.lastindex and m.lastindex >= 2 and m.group(2):
                uses["max_in_lair"] = int(m.group(2))
            name = rx.sub("", name)
    m = COST_RE.search(name)
    if m:
        cost = int(m.group(1))
        name = COST_RE.sub("", name)
    return plain(name, problems), uses, cost


# Words in a summon's damage that grow with its summoner
SUMMON_WORDS = {"summonSpellLevel": "spell_level", "PB": "pb"}


def _dice(expr: str) -> tuple[str | None, int | str | None]:
    """"1d10 + 8" -> ("1d10", 8); "2d4" -> ("2d4", None); "5" -> (None, 5);
    a summon's "1d8 + 3 + summonSpellLevel" -> ("1d8", "3 + spell_level")."""
    terms = re.findall(r"[+-]?[^+-]+", expr.replace("−", "-").replace(" ", ""))
    dice, num, words = None, 0, []
    for t in terms:
        body = t.lstrip("+-")
        sign = "-" if t.startswith("-") else ""
        if re.fullmatch(r"\d*d\d+", body) and dice is None and not sign:
            dice = body if body[0].isdigit() else "1" + body
        elif body.isdigit():
            num += int(sign + body)
        elif body in SUMMON_WORDS:
            words.append(SUMMON_WORDS[body])
        else:
            return None, None
    if words:
        return dice, " + ".join(([str(num)] if num else []) + words)
    return dice, (num if num or dice is None else None)


def damage_types(raw: str | None) -> list[str] | None:
    """"Radiant (Celestial), Psychic (Fey), or Necrotic (Fiend)" ->
    ["radiant", "psychic", "necrotic"]; None if a word isn't a damage type."""
    words = [re.sub(r"\s*\([^)]*\)", "", w).strip().lower()
             for w in re.split(r"\s*,\s*(?:or\s+)?|\s+or\s+", raw or "") if w.strip()]
    return words if words and all(w in DAMAGE_TYPES for w in words) else None


def _fix_damage_text(s: str) -> str:
    def add_word(m):
        return f"{m.group(1)} {m.group(2)} damage" if damage_types(m.group(2)) else m.group(0)
    return NO_DAMAGE_WORD.sub(add_word, MAGIC_WORD.sub(" damage", s))


def _plus_word(plus: str | None) -> str | None:
    """" plus your Charisma modifier" -> "cha_mod"; " plus PB" -> "pb"."""
    if not plus:
        return None
    if "PB" in plus:
        return "pb"
    if "spell's level" in plus:
        return "spell_level"
    return ABILITY_NAMES[re.search(_ABILITY, plus, re.I).group(0).lower()] + "_mod"


def damage_parts(s: str, unread: list) -> list[dict]:
    """Every "13 ({@damage 1d10 + 8}) Slashing damage" in a text, with
    "if …" conditions; "or 5 (1d10) … if used with two hands" is a part
    with its condition. Several types to pick from ("acid, cold, or fire
    damage") give type "chosen" with `type_options`; a summon's "plus your
    Charisma modifier" / "plus PB" is added to the bonus."""
    s = _fix_damage_text(s)
    parts = []
    hits = list(DMG_PART.finditer(s))
    for i, m in enumerate(hits):
        options = None
        if m.group(4):
            types = damage_types(m.group(4))
            if types is None:
                if m.group(4).strip().lower() in ("extra", "additional"):
                    types = ["weapon"]           # "deals 7 (3d4) extra damage": the weapon's own
                else:
                    unread.append(f"damage type '{m.group(4)}'")
                    continue
            dtype, options = (types[0], None) if len(types) == 1 else ("chosen", types)
        elif re.match(r"\s*of (?:a|the|one) type", s[m.end():]):
            dtype = "chosen"          # "damage of a type this dragon has resistance to (your choice)"
        else:
            dtype = "weapon"
        end = hits[i + 1].start() if i + 1 < len(hits) else len(s)
        after = s[m.end():end]
        before = s[(hits[i - 1].end() if i else 0):m.start()]
        cond = CONDITIONAL.match(after)
        tags = DMG_TAG.findall(m.group(2))
        for j, expr in enumerate(tags):
            dice, bonus = _dice(expr)
            if dice is None and bonus is None:
                unread.append(f"damage '{expr}'")
                continue
            word = _plus_word(m.group(3)) if j == len(tags) - 1 else None
            if word:
                bonus = word if not bonus else f"{bonus} + {word}"
            part = {"dice": dice, "bonus": bonus, "type": dtype, "type_options": options}
            if cond:
                cond_text = re.sub(r",?\s*(?:plus|and|or)$", "", plain(cond.group(0).strip(" ,"), []))
                if not NOT_A_CONDITION.match(cond_text):
                    part["condition"] = cond_text
            elif i and not j and re.search(r"\bor\s*$", before.strip()):
                part["condition"] = "instead"
            parts.append({k: v for k, v in part.items() if v is not None})
    if not hits:
        for m in FLAT_DMG.finditer(s):
            if m.group(2).lower() in DAMAGE_TYPES:
                parts.append({"bonus": int(m.group(1)), "type": m.group(2).lower()})
    return parts


def save_start(s: str):
    """(match, ability, dc) of the first saving throw in a text; dc is None
    when it is the summoner's spell save DC."""
    m = ACT_SAVE.search(s)
    if m:
        return m, m.group(1).lower()[:3], int(m.group(2))
    m = DC_ABILITY.search(s)
    if m:
        return m, ABILITY_NAMES[m.group(2).lower()], int(m.group(1))
    m = ACT_SAVE_SPELL.search(s)
    if m:
        return m, m.group(1).lower()[:3], None
    m = SPELL_DC_ABILITY.search(s)
    if m:
        return m, ABILITY_NAMES[m.group(1).lower()], None
    return None


def _save(s: str, unread: list) -> dict | None:
    """A saving throw in a text: 2024 ({@actSave dex} {@dc 21} … {@actSaveFail}
    … {@actSaveSuccess} Half damage.) or 2014 (a {@dc 13} Constitution saving
    throw, taking … on a failed save, or half as much damage on a successful one)."""
    found = save_start(s)
    if not found:
        return None
    m, ability, dc = found
    body = s[m.end():]
    fail = body
    succ = ""
    if "{@actSaveSuccess}" in body:
        fail, succ = body.split("{@actSaveSuccess}", 1)
    if "{@actSaveFail}" in fail:
        fail = fail.split("{@actSaveFail}", 1)[1]
    half = "half damage" in (succ + body).lower() or "half as much damage" in body.lower()
    out = {"ability": ability, "dc": dc, **({} if dc is not None else {"dc_from": "spell_save"}),
           "on_success": "half" if half else "none",
           "damage": damage_parts(fail, unread),
           "conditions": sorted({x.strip().lower() for x in CONDITION.findall(fail)})}
    return out


def action_of(entries: list, unread: list) -> dict | None:
    """The numbers in a trait or action, read from its tags."""
    s = " ".join(x for x in entries or [] if isinstance(x, str))
    if not s:
        return None
    out: dict = {}
    atk = re.search(r"\{@atkr? ([^}]+)\}", s)
    if atk:
        kind = ATTACK_KIND.get(atk.group(1).strip())
        if kind is None:
            unread.append(f"attack kind '{atk.group(1)}'")
        hit = re.search(r"\{@hit ([+-]?\d+)\}", s) or re.match(r"\s*([+-]\d+)\b", s[atk.end():])
        attack = {"kind": kind or "melee", "bonus": int(hit.group(1)) if hit else None}
        if hit and re.match(r"\s*plus PB", s[hit.end():]):
            attack["bonus"] = f"{int(hit.group(1))} + pb" if int(hit.group(1)) else "pb"   # a sidekick drake
        if not hit and ("{@hitYourSpellAttack" in s or re.search(r"your spell attack modifier to hit", s, re.I)):
            attack["bonus_from"] = "spell_attack"
        if not hit and re.search(r"\bautomatic hit\b", s, re.I):
            attack["auto_hit"] = True
        reach, rng = REACH.search(s), RANGE.search(s)
        if reach:
            out["range"] = f"reach {reach.group(1)} ft." + (f" or range {reach.group(2)} ft." if reach.group(2) else "")
        elif rng:
            out["range"] = f"range {rng.group(1)} ft."
        hit_text = s.split("{@h}", 1)[1] if "{@h}" in s else \
            s.split("Hit:", 1)[1] if "Hit:" in s else ""
        hit_text = re.split(r"\{@m\}|\{@hom\}", hit_text)[0]
        save = _save(hit_text, unread)
        dmg_text = hit_text
        if save:
            # the save's own damage is in the save, the hit's damage before it
            dmg_text = hit_text[:save_start(hit_text)[0].start()]
        attack["damage"] = damage_parts(dmg_text, unread)
        out["attack"] = attack
        if save:
            out["save"] = save
        if not hit and "bonus_from" not in attack and not attack.get("auto_hit"):
            unread.append("attack without a to-hit")
    else:
        save = _save(s, unread)
        cut = save_start(s)[0] if save else None
        before = damage_parts(s[:cut.start()] if cut else s, unread)
        if save:
            out["save"] = save
            area = AREA.search(s)
            if area:
                out["area"] = f"{area.group(1)}-foot {area.group(2).lower()}"
        if before:
            if RIDER.search(s):
                # "hits it with a ram attack … takes an extra 5 (2d4) bludgeoning damage":
                # extra damage on the creature's own attack (it uses that attack's to-hit)
                out["attack"] = {"kind": "any", "bonus": None, "damage": before}
            else:
                out["damage"] = before
    if not out:
        return None
    if "{@damage" in s and not (out.get("damage") or (out.get("attack") or {}).get("damage")
                                or (out.get("save") or {}).get("damage")):
        unread.append("damage not placed")
    return out


ROLL_PREFIX = re.compile(r"^\s*(\d+(?:\s*[-–]\s*\d+)?)\s*[:.]?\s*")
HAS_NUMBERS = re.compile(r"\{@(?:hit|damage|dc|atkr?|actSave) ")


def option_features(parent: dict, entries, problems: list, unread: dict) -> list[dict]:
    """A feature whose numbers sit in a list of options: a beholder's eye
    rays, a metallic dragon's two breath weapons, the hellfire engine's
    "roll a d6" weapons. Each option becomes a feature of its own with
    `parent` (and `roll`: "1-2" when it is rolled for), so the dice tower
    can roll it. The parent keeps the whole text."""
    items = []
    for e in entries or []:
        if isinstance(e, dict) and e.get("type") == "list":
            items += [i for i in e.get("items") or [] if isinstance(i, dict) and i.get("name")
                      and (i.get("entries") or i.get("entry"))]
    if not items or not any(HAS_NUMBERS.search(str(i)) for i in items):
        return []
    out = []
    for i in items:
        body = i.get("entries") or [i["entry"]]
        raw_name = plain(i["name"], problems).strip().rstrip(".:")
        m = ROLL_PREFIX.match(raw_name)
        roll = m.group(1).replace("–", "-").replace(" ", "") if m else None
        name = raw_name[m.end():].strip() if m else raw_name
        name = name or f"{parent['name']} ({roll})"
        f = {"id": f"{parent['id']}-{c.slug(name)}", "name": name, "category": parent["category"],
             "text": text(body, problems), "parent": parent["id"]}
        if roll:
            f["roll"] = roll
        miss: list = []
        act = action_of(body, miss)
        if act:
            f["action"] = act
        if miss or (re.search(r"\{@(?:hit|damage) ", str(body)) and not act):
            unread.setdefault(f"{parent['name']}: {name}", []).extend(miss or ["numbers not read"])
        out.append(f)
    return out


def features(entry: dict, problems: list, unread: dict) -> list[dict]:
    out, used = [], set()
    for raw_key, category in SECTIONS.items():
        for e in entry.get(raw_key) or []:
            if not isinstance(e, dict):
                problems.append(f"{raw_key}: can't read {e!r}")
                continue
            name, uses, cost = name_and_uses(e.get("name") or "", problems)
            fid = c.slug(name) or category
            n = 2
            while fid in used:
                fid, n = f"{c.slug(name)}-{n}", n + 1
            used.add(fid)
            f = {"id": fid, "name": name, "category": category, "text": text(e.get("entries"), problems)}
            if uses:
                f["uses"] = uses
            if cost:
                f["cost"] = cost
            miss: list = []
            act = action_of(e.get("entries"), miss)
            if act:
                f["action"] = act
            out.append(f)
            kids = option_features(f, e.get("entries"), problems, unread)
            out += kids
            raw = str(e.get("entries"))
            # "casts Guiding Bolt (… +14 to hit with spell attacks)": the spell has the numbers
            casts_spell = "{@spell" in raw and "{@atk" not in raw
            if not kids and (miss or ("{@hit" in raw and not act and not casts_spell)):
                unread.setdefault(name, []).extend(miss or ["numbers not read"])
    for raw_key, category, name in (("lairActions", "lair_actions", "Lair Actions"),
                                    ("regionalEffects", "regional_effects", "Regional Effects")):
        if entry.get(raw_key):
            out.append({"id": c.slug(name), "name": name, "category": category,
                        "text": text(entry[raw_key], problems)})
    return out


# ---------- variants ----------

def guess_category(name: str, entries: list) -> str:
    """Where a variant's named block goes in the statblock. 5etools doesn't
    say, so it's read from how the block starts."""
    s = next((x for x in entries or [] if isinstance(x, str)), "").strip()
    low = s.lower()
    if name.lower().startswith("multiattack") or re.match(r"\{@(?:atkr?|actsave) ", s, re.I):
        return "actions"
    if low.startswith("as a bonus action") or low.startswith("bonus action"):
        return "bonus_actions"
    if low.startswith("as a reaction") or low.startswith("reaction") or low.startswith("{@actTrigger}".lower()):
        return "reactions"
    if re.match(r"(?:as an action|\{@actsave)", low):
        return "actions"
    return "traits"


# Variant blocks that describe changes to a statblock line (the named dragons'
# "customizing" insets), not a trait or action: they stay text only.
STAT_LINE_BLOCKS = {"languages", "skills", "spells", "other traits and actions", "senses", "saving throws",
                    "alignment", "armor class", "hit points", "speed", "challenge", "damage resistances",
                    "damage immunities", "condition immunities", "ability scores", "size"}


def variants(entry: dict, problems: list, unread: dict, used: set) -> tuple[list[dict], list[dict]]:
    """The statblock's variant insets ("Variant: Infernal Cambions").
      - One 5etools marks (`_version`) is also a monster of its own (the
        resolver made it); `version` names it, and the frontend can offer
        that monster instead.
      - Any other one is a toggle: its named blocks ("Fury of the Nine")
        become features with `variant` set. They are off until the DM turns
        one on, so the dice tower and initiative tracker ignore them by
        default. They are toggled one by one, since a variant's blocks are
        often alternatives (a cambion of Orcus OR of Baphomet; a red OR blue
        grung). Blocks that only change a statblock line ("Languages",
        "Skills": the named dragons' customizing notes) stay text."""
    out, feats = [], []
    vids = set()
    for v in entry.get("variant") or []:
        if not isinstance(v, dict):
            problems.append(f"variant: can't read {v!r}")
            continue
        vid = c.slug(v.get("name") or "variant") or "variant"
        n = 2
        while vid in vids:
            vid, n = f"{c.slug(v.get('name') or 'variant')}-{n}", n + 1
        vids.add(vid)
        row = {"id": vid, "name": plain(v.get("name") or "", problems), "text": text(v.get("entries"), problems)}
        ver = v.get("_version")
        if ver:
            row["version"] = c.entry_id(ver.get("name") or v.get("name"),
                                        ver.get("source") or v.get("source") or entry.get("source"))
        else:
            ids = []
            for e in v.get("entries") or []:
                if not (isinstance(e, dict) and e.get("name") and e.get("entries")):
                    continue
                if plain(e["name"], problems).strip(". ").lower() in STAT_LINE_BLOCKS:
                    continue
                name, uses, cost = name_and_uses(e["name"], problems)
                fid = c.slug(name) or "variant-feature"
                n = 2
                while fid in used:
                    fid, n = f"{c.slug(name)}-{n}", n + 1
                used.add(fid)
                f = {"id": fid, "name": name, "category": guess_category(name, e["entries"]),
                     "text": text(e["entries"], problems), "variant": vid}
                if uses:
                    f["uses"] = uses
                if cost:
                    f["cost"] = cost
                miss: list = []
                act = action_of(e["entries"], miss)
                if act:
                    f["action"] = act
                if miss:
                    unread.setdefault(name, []).extend(miss)
                feats.append(f)
                ids.append(fid)
            if ids:
                row["features"] = ids
        out.append(row)
    return out, feats


# ---------- spellcasting ----------

SPELL_TAG = re.compile(r"\{@spell ([^}]+)\}")
PER = {"daily": "day", "rest": "short", "restLong": "long", "weekly": "week", "monthly": "month", "yearly": "year"}


def _spell(item, problems: list) -> dict | None:
    if isinstance(item, dict):
        item = item.get("entry") or ""
    m = SPELL_TAG.search(str(item))
    if not m:
        # "any cleric spell up to 9th level": a rule, not one spell
        return {"text": plain(item, problems)} if str(item).strip() else None
    ref = m.group(1)
    out = {"spell": c.ref_id(ref.split("|")[0] + ("|" + ref.split("|")[1] if "|" in ref else ""))}
    note = (str(item)[:m.start()] + str(item)[m.end():]).strip()
    if note:
        out["note"] = plain(note, problems).strip()
    return out


def _group(spells, problems: list, **info) -> dict:
    g = {k: v for k, v in info.items() if v is not None}
    g["spells"] = [x for x in (_spell(s, problems) for s in spells or []) if x]
    return g


def spellcasting(entry: dict, problems: list) -> list[dict]:
    out = []
    for b in entry.get("spellcasting") or []:
        header = " ".join(x for x in b.get("headerEntries") or [] if isinstance(x, str))
        dc = re.search(r"\{@dc (\d+)\}", header)
        hit = re.search(r"\{@hit ([+-]?\d+)\}", header)
        block = {"name": plain(b.get("name") or "Spellcasting", problems), "ability": b.get("ability"),
                 "dc": int(dc.group(1)) if dc else None, "attack": int(hit.group(1)) if hit else None,
                 "text": text(b.get("headerEntries"), problems), "groups": []}
        if b.get("footerEntries"):
            block["footer"] = text(b["footerEntries"], problems)
        if b.get("displayAs"):
            block["display_as"] = {"action": "actions", "bonus": "bonus_actions", "reaction": "reactions",
                                   "legendary": "legendary_actions", "trait": "traits"}.get(b["displayAs"], b["displayAs"])
        if b.get("hidden"):
            block["hidden"] = [h for h in b["hidden"]]
        for key in ("constant", "will", "ritual"):
            if b.get(key):
                block["groups"].append(_group(b[key], problems, uses=None, how={"will": "at_will"}.get(key, key)))
        for key, per in PER.items():
            for n, lst in (b.get(key) or {}).items():
                each = str(n).endswith("e")
                num = _int(str(n).rstrip("e"))
                block["groups"].append(_group(lst, problems, uses=num, per=per, each=each or None))
        for key, how in (("recharge", "recharge"), ("legendary", "legendary"), ("charges", "charges")):
            for n, lst in (b.get(key) or {}).items():
                block["groups"].append(_group(lst, problems, uses=_int(n), how=how))
        for lvl, d in sorted((b.get("spells") or {}).items(), key=lambda kv: int(kv[0])):
            lvl = int(lvl)
            if lvl == 0:
                block["groups"].append(_group(d.get("spells"), problems, level=0, how="at_will"))
            else:
                block["groups"].append(_group(d.get("spells"), problems, level=lvl, slots=d.get("slots"),
                                              lower=d.get("lower")))
        extra = set(b) - {"name", "type", "headerEntries", "footerEntries", "ability", "displayAs", "hidden",
                          "constant", "will", "ritual", "spells", "chargesItem", *PER, "recharge", "legendary",
                          "charges"}
        if extra:
            problems.append(f"spellcasting: can't read {sorted(extra)}")
        out.append({k: v for k, v in block.items() if v not in (None, [], "")})
    return out


# ---------- the rest ----------

def items(entry: dict, problems: list) -> list[dict]:
    out = []
    for key in ("gear", "attachedItems"):
        for x in entry.get(key) or []:
            ref = x if isinstance(x, str) else (x.get("item") if isinstance(x, dict) else None)
            if not ref:
                problems.append(f"{key}: can't read {x!r}")
                continue
            it = {"item": c.ref_id(ref), "qty": x.get("quantity", 1) if isinstance(x, dict) else 1}
            if key == "attachedItems":
                it["attacks"] = True           # its attack is in the actions
            out.append(it)
    return out


LANGUAGE_CODES = {
    "AB": "abyssal", "AQ": "aquan", "AU": "auran", "C": "common", "CE": "celestial",
    "CS": "cant_speak", "CSL": "common_sign_language", "D": "dwarvish", "DR": "draconic",
    "DS": "deep_speech", "DU": "druidic", "E": "elvish", "G": "gnomish", "GI": "giant",
    "GO": "goblin", "GTH": "gith", "H": "halfling", "I": "infernal", "IG": "ignan",
    "LF": "known_in_life", "O": "orc", "OTH": "other", "P": "primordial", "S": "sylvan",
    "T": "terran", "TC": "thieves_cant", "TP": "telepathy", "U": "undercommon",
    "X": "any_choose", "XX": "all",
}


def _codes(entry: dict, keys: tuple, table: dict | None = None) -> list[str]:
    out = []
    for k in keys:
        for x in entry.get(k) or []:
            v = table.get(x, str(x).lower()) if table else str(x).lower()
            if v not in out:
                out.append(v)
    return out


def movement(entry: dict) -> list[str]:
    """fly / swim / climb / burrow / hover: the speeds it has besides walking."""
    sp = entry.get("speed") or {}
    if not isinstance(sp, dict):
        return []
    out = [k for k in ("fly", "swim", "climb", "burrow") if sp.get(k) or (sp.get("alternate") or {}).get(k)]
    fly = sp.get("fly")
    if sp.get("canHover") or (isinstance(fly, dict) and "hover" in str(fly.get("condition", "")).lower()):
        out.append("hover")
    return out


def filters(entry: dict) -> dict:
    f = {
        "damage_dealt": _codes(entry, ("damageTags", "damageTagsSpell", "damageTagsLegendary"), DAMAGE_CODES),
        "conditions_inflicted": _codes(entry, ("conditionInflict", "conditionInflictSpell", "conditionInflictLegendary")),
        "saves_forced": [x[:3] for x in _codes(entry, ("savingThrowForced", "savingThrowForcedSpell",
                                                "savingThrowForcedLegendary"))],
        "senses": _codes(entry, ("senseTags",), SENSE_CODES),
        "movement": movement(entry),
        "actions": [c.snake(x) for x in _codes(entry, ("actionTags",))],
        "traits": [c.snake(x) for x in _codes(entry, ("traitTags",))],
        "misc": _codes(entry, ("miscTags",), MISC_CODES),
        "languages": _codes(entry, ("languageTags",), LANGUAGE_CODES),
        "spellcasting": _codes(entry, ("spellcastingTags",), SPELLCASTING_CODES),
        "environment": [str(e).split(",", 1)[-1].strip().lower() for e in entry.get("environment") or []],
        "treasure": [str(t).lower() for t in entry.get("treasure") or []],
        "groups": [str(g) for g in entry.get("group") or []],
    }
    return {k: v for k, v in f.items() if v}


def clean_monster(entry: dict) -> tuple[dict | None, list[str]]:
    problems: list[str] = []
    out = c.header(entry, "monster", problems, read_prerequisite=False)
    out.pop("text", None)
    edition = c.edition_of(entry, problems, "monsters")
    if edition is None:
        c.unhandled(entry, HANDLED, DROPPED, problems)
        return None, problems
    out["edition"] = edition
    if entry.get("shortName") and isinstance(entry["shortName"], str):
        out["short_name"] = entry["shortName"]
    if entry.get("_version_of"):
        v = entry["_version_of"]
        out["version_of"] = c.entry_id(v["name"], v["source"])

    out["size"] = size(entry, problems)
    if entry.get("sizeNote"):
        out["size_note"] = entry["sizeNote"]
    out["creature_type"] = creature_type(entry.get("type"), problems)
    if isinstance(entry.get("type"), dict) and entry["type"].get("note"):
        out["creature_type"]["note"] = plain(entry["type"]["note"], problems)
    out["alignment"] = alignment(entry, problems)
    if entry.get("alignmentPrefix"):
        out["alignment_prefix"] = entry["alignmentPrefix"].strip().lower()

    out["ac"] = armor_class(entry, problems)
    out["hp"] = hit_points(entry, problems)
    out["speed"] = speed(entry, problems)
    scores, note = abilities(entry, problems)
    out["abilities"] = scores
    if note:
        out["abilities_note"] = note
    out["saves"], note = saves(entry, problems)
    if note:
        out["saves_note"] = note
    out["skills"], note = skills(entry, problems)
    if note:
        out["skills_note"] = note
    out["senses"] = senses(entry, problems)
    if entry.get("passive") is not None:
        out["passive_perception"] = _int(entry["passive"]) if _int(entry["passive"]) is not None else entry["passive"]
    out["defenses"] = defenses(entry, problems)
    out["languages"] = [plain(x, problems) for x in entry.get("languages") or []]
    out["cr"] = challenge(entry, problems)
    if entry.get("level") is not None:
        out["level"] = entry["level"]
    if entry.get("pbNote"):
        out["pb_note"] = plain(entry["pbNote"], problems)
    pb = (out["cr"] or {}).get("pb")
    out["initiative"] = initiative(entry, scores, pb)

    unread: dict = {}
    out["features"] = features(entry, problems, unread)
    for name, what in unread.items():
        problems.append(f"numbers not read: {name}: {', '.join(sorted(set(what)))}")
    notes = {}
    for raw_key, key in (("actionNote", "actions"), ("reactionNote", "reactions"), ("reactionHeader", "reactions"),
                         ("legendaryHeader", "legendary_actions"), ("mythicHeader", "mythic_actions")):
        if entry.get(raw_key):
            notes[key] = text(entry[raw_key], problems)
    if notes:
        out["section_notes"] = notes
    if entry.get("legendary"):
        out["legendary_actions"] = {"uses": entry.get("legendaryActions", 3)}
        if entry.get("legendaryActionsLair"):
            out["legendary_actions"]["uses_in_lair"] = entry["legendaryActionsLair"]
    if entry.get("mythicEncounter"):
        out["mythic_encounter"] = text(entry["mythicEncounter"], problems)
    out["spellcasting"] = spellcasting(entry, problems)
    out["items"] = items(entry, problems)
    if entry.get("variant"):
        out["variants"], extra = variants(entry, problems, unread, {f["id"] for f in out["features"]})
        out["features"] += extra
        for name, what in unread.items():
            p = f"numbers not read: {name}: {', '.join(sorted(set(what)))}"
            if p not in problems:
                problems.append(p)

    flags = {"npc": entry.get("isNpc"), "named": entry.get("isNamedCreature"), "familiar": entry.get("familiar"),
             "dragon_age": entry.get("dragonAge"), "dragon_casting_color": entry.get("dragonCastingColor")}
    out["flags"] = {k: v for k, v in flags.items() if v}
    if entry.get("summonedBySpell") or entry.get("summonedByClass"):
        out["summoned_by"] = {k: v for k, v in {
            "spell": c.ref_id(entry["summonedBySpell"]) if entry.get("summonedBySpell") else None,
            "spell_level": entry.get("summonedBySpellLevel"),
            "class": c.ref_id(entry["summonedByClass"]) if entry.get("summonedByClass") else None,
        }.items() if v is not None}
    out["filters"] = filters(entry)

    c.unhandled(entry, HANDLED, DROPPED, problems)
    try:
        return dump(Monster.model_validate(out)), problems
    except ValidationError as e:
        problems += [f"schema: {'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]
        return None, problems
