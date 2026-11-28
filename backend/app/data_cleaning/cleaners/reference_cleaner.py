"""Code cleaner for the reference catalogues (2026-11-25): text-only entries
for three catalogue tabs. No LLM step: the text is made by text_renderer,
and each kind keeps a few fields for the filters and the card's lines.

    rules     actions, conditions, diseases, statuses, senses, skills,
              the rules glossary and variant / optional rules
    lore      deities, languages, cults, demonic boons
    toolkit   traps, hazards, objects, vehicles and their upgrades, rewards
              (charms, blessings…), bastion facilities, character options
              (dark gifts, supernatural gifts, character secrets)

Every entry has the usual header (common_cleaner.header: id from name and
source, name, source, SRD, reprints, aliases), its `kind` (the type below),
an `edition` (common_cleaner.edition_of: flags, reprints, the book) and its
`text`. Statblock-like parts (an object's AC and HP, a vehicle's hull and
weapons, a trap's trigger and countermeasures) become text lines in front
of the rest. These entries don't take part in combat or the sheet.

Kinds and their own fields (all optional):
    action          time ("1 action")
    condition, status, sense
    disease         disease_type ("Magical Contagion")
    skill           ability ("dex")
    rule            rule_type: core · optional · variant · variant optional · other
    deity           (id: name-pantheon-source) pantheon, title, alignment (words), domains, symbol,
                    province, deity_category, plane, worshipers
    language        language_type (standard · rare · exotic · secret), script,
                    typical_speakers, origin
    cult            cult_type ("Diabolical")
    boon            boon_type ("Demonic")
    trap, hazard    trap_type ("Simple trap"), tiers [1, 2], threat ("deadly")
    object          object_type, size
    vehicle         vehicle_type, terrain
    vehicle_upgrade upgrade_type
    reward          reward_type ("Charm"), rarity
    facility        facility_type (basic · special), level, space, hirelings, orders
    character_option option_type ("Dark Gift")
"""

import unicodedata

from . import common_cleaner as c
from ..text_renderer import render, tags

# ─── words for the codes the data uses ─────────────────────────────────

RULE_TYPES = {"C": "core", "O": "optional", "V": "variant", "VO": "variant optional"}
ALIGNMENT_WORDS = {"L": "lawful", "N": "neutral", "C": "chaotic", "G": "good", "E": "evil", "U": "unaligned", "A": "any alignment"}
TRAP_TYPES = {
    "SMPL": "Simple trap", "CMPX": "Complex trap", "MECH": "Mechanical trap", "MAG": "Magical trap",
    "TRP": "Trap", "HAUNT": "Haunt", "ENV": "Environmental hazard", "WTH": "Weather", "WLD": "Wilderness hazard",
    "EST": "Eldritch storm", "GEN": "Generic",
}
OBJECT_TYPES = {"SW": "Siege weapon", "GEN": "Generic", "U": "Other"}
VEHICLE_TYPES = {
    "SHIP": "Ship", "SPELLJAMMER": "Spelljammer ship", "INFWAR": "Infernal war machine",
    "ELEMENTAL_AIRSHIP": "Elemental airship", "OBJECT": "Object", "CREATURE": "Creature",
}
UPGRADE_TYPES = {
    "SHP:H": "Ship hull", "SHP:M": "Ship movement", "SHP:W": "Ship weapon", "SHP:F": "Ship figurehead",
    "SHP:O": "Ship (other)", "IWM:W": "War machine weapon", "IWM:A": "War machine armor", "IWM:G": "War machine gadget",
}
OPTION_TYPES = {"CS": "Character Secret", "SG": "Supernatural Gift", "DG": "Dark Gift", "RF:B": "Background Feature"}
SIZES = {"T": "tiny", "S": "small", "M": "medium", "L": "large", "H": "huge", "G": "gargantuan"}
ATTACK_WORDS = {
    "MW": "Melee Weapon Attack:", "RW": "Ranged Weapon Attack:", "MS": "Melee Spell Attack:", "RS": "Ranged Spell Attack:",
    "MW,RW": "Melee or Ranged Weapon Attack:", "RW,MW": "Melee or Ranged Weapon Attack:",
}
ABILITIES = ("str", "dex", "con", "int", "wis", "cha")

# Keys every kind reads or drops; anything else is reported.
COMMON = {"name", "source", "edition", "srd", "srd52", "reprintedAs", "alias", "entries"}
DROPPED = {"page", "_file", "hasFluff", "hasFluffImages", "basicRules", "basicRules2024", "otherSources",
           "additionalSources", "hasToken", "tokenCredit", "tokenCustom", "altArt", "fonts", "symbolImg",
           "_copy", "customExtensionOf", "reprintAlias", "piety", "additionalSpells", "seeAlsoFacility", "type",
           "isNpc", "token"}


# ─── text helpers ─────────────────────────────────────────────────────

def _prep(node):
    """Turn the block types the renderer doesn't know into ones it does:
    an `actions` group into a named block, an `attack` into its line."""
    if isinstance(node, list):
        return [_prep(n) for n in node]
    if not isinstance(node, dict):
        return node
    t = node.get("type")
    if t == "actions":
        return {"type": "entries", "name": node.get("name"), "entries": _prep(node.get("entries") or [])}
    if t == "statblockInline" and node.get("statblockType") == "object":
        d = node.get("statblockData") or {}
        return {"type": "entries", "name": d.get("name"), "entries": [x for x in _object_lines(d, []) if x] + list(_prep(d.get("entries") or []))}
    if t == "attack":
        head = ATTACK_WORDS.get(node.get("attackType", ""), "Attack:")
        hit = " ".join(str(x) for x in node.get("hitEntries") or [])
        body = " ".join(str(x) for x in node.get("attackEntries") or [])
        return f"{head} {body} Hit: {hit}".strip()
    return {k: _prep(v) for k, v in node.items()}


def _text(value, problems) -> str:
    return render(_prep(value), problems) if value else ""


def _words(value, problems) -> str:
    """A short value with 5etools tags ("{@creature aarakocra}") as plain words."""
    if value is None:
        return ""
    if isinstance(value, dict) and "entry" in value:
        value = value["entry"]
    if isinstance(value, list):
        return ", ".join(w for w in (_words(v, problems) for v in value) if w)
    return tags(str(value), problems).strip()


def _line(label: str, value: str) -> str:
    return f"**{label}.** {value}" if value else ""


def _join(*parts) -> str:
    return "\n\n".join(p for p in parts if p)


def _signed(n) -> str:
    try:
        n = int(n)
    except (TypeError, ValueError):
        return str(n)
    return f"+{n}" if n >= 0 else str(n)


def _abilities_line(e: dict) -> str:
    out = []
    for a in ABILITIES:
        if isinstance(e.get(a), int):
            out.append(f"{a.capitalize()} {e[a]} ({_signed((e[a] - 10) // 2)})")
    return " · ".join(out)


def _list_words(value) -> str:
    return ", ".join(str(v) for v in value) if isinstance(value, list) else str(value or "")


# ─── the shared part ──────────────────────────────────────────────────

def _base(entry: dict, kind: str, category: str, problems: list, handled: set) -> dict:
    # The header's own text would be rendered without _prep: the text is made below.
    out = c.header({**entry, "entries": []}, kind, problems, read_prerequisite=False)
    out["edition"] = c.edition_of(entry, problems, category) or "classic"
    out["text"] = _text(entry.get("entries"), problems)
    c.unhandled(entry, COMMON | handled, DROPPED, problems)
    return out


def _prerequisite_line(entry: dict, problems: list) -> str:
    """"Human, Half-Elf or Half-Orc (if you don't meet it, draw a different card)" and the like, in words."""
    parts = []
    for p in entry.get("prerequisite") or []:
        bits = []
        for k, v in p.items():
            if k == "race":
                bits.append(" or ".join(c.title(r.get("name", "")) for r in v))
            elif k == "membership":
                bits.append("member of " + " or ".join(v))
            elif k == "spellcastingFocus":
                bits.append("a spellcasting focus" if v is True else "a spellcasting focus (" + ", ".join(v) + ")")
            elif k == "otherSummary":
                bits.append(_words(v.get("entry") or v.get("entrySummary"), problems))
            elif k in ("expertise", "proficiency"):
                for x in v:
                    for what, which in x.items():
                        names = "a " + what if which is True else ", ".join(c.title(str(w)) for w in which)
                        bits.append(f"{k} in {names}")
            elif k == "note":
                continue
            else:
                problems.append(f"prerequisite '{k}' not handled")
        note = p.get("note")
        parts.append(", ".join(bits) + (f" ({note})" if note else ""))
    return "; or ".join(x for x in parts if x)


# ─── rules ────────────────────────────────────────────────────────────

def _time_words(time) -> str:
    out = []
    for t in time or []:
        if isinstance(t, str):
            out.append(t)
        elif isinstance(t, dict):
            n, unit = t.get("number", 1), str(t.get("unit", "")).replace("bonus", "bonus action")
            out.append(f"{n} {unit}" + ("s" if n != 1 and unit and not unit.endswith("s") else ""))
    return " or ".join(out)


def _see_also(refs) -> str:
    return ", ".join(c.title(str(r).split("|")[0]) for r in refs or [])


def clean_action(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "action", "rules", problems, {"time", "seeAlsoAction", "fromVariant"})
    if entry.get("time"):
        out["time"] = _time_words(entry["time"])
    out["text"] = _join(out["text"],
                        _line("See also", _see_also(entry.get("seeAlsoAction"))),
                        _line("From the variant rule", _words(entry.get("fromVariant"), problems).split("|")[0]))
    return out, problems


def _plain(kind: str):
    def clean(entry: dict) -> tuple[dict, list]:
        problems: list = []
        return _base(entry, kind, "rules", problems, set()), problems
    return clean


clean_condition = _plain("condition")
clean_status = _plain("status")
clean_sense = _plain("sense")


def clean_disease(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "disease", "rules", problems, set())
    if entry.get("type"):
        out["disease_type"] = entry["type"]
    return out, problems


def clean_skill(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "skill", "rules", problems, {"ability"})
    if entry.get("ability"):
        out["ability"] = entry["ability"]
    return out, problems


def clean_rule(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "rule", "rules", problems, {"ruleType"})
    out["rule_type"] = RULE_TYPES.get(entry.get("ruleType"), "other")
    return out, problems


# ─── lore ─────────────────────────────────────────────────────────────

def _ascii_slug(text: str) -> str:
    """"Faerûnian" -> "faerunian" (c.slug would drop the û)."""
    return c.slug(unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode())


def alignment_words(codes) -> str:
    """["C", "G"] -> "chaotic good", ["N"] -> "neutral"."""
    codes = list(codes or [])
    if not codes:
        return ""
    if codes == ["N", "N"]:
        return "neutral"
    return " ".join(ALIGNMENT_WORDS.get(x, x) for x in codes)


def clean_deity(entry: dict) -> tuple[dict, list]:
    problems: list = []
    handled = {"pantheon", "title", "alignment", "domains", "symbol", "province", "category", "plane", "worshipers", "altNames"}
    out = _base(entry, "deity", "lore", problems, handled)
    # One book can have two gods of the same name in different pantheons (Oghma: Celtic and Faerûnian).
    if entry.get("pantheon"):
        out["id"] = f"{_ascii_slug(entry['name'])}-{_ascii_slug(entry['pantheon'])}-{str(entry.get('source', '')).lower()}"
    for key, field in (("pantheon", "pantheon"), ("title", "title"), ("symbol", "symbol"), ("province", "province"),
                       ("category", "deity_category"), ("plane", "plane"), ("worshipers", "worshipers")):
        if entry.get(key):
            out[field] = _words(entry[key], problems)
    if entry.get("alignment"):
        out["alignment"] = alignment_words(entry["alignment"])
    if entry.get("domains"):
        out["domains"] = [str(d) for d in entry["domains"]]
    alt = [a for a in entry.get("altNames") or [] if a != out["name"]]
    if alt:
        out["aliases"] = [*(out.get("aliases") or []), *[a for a in alt if a not in (out.get("aliases") or [])]]
    return out, problems


def clean_language(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "language", "lore", problems, {"type", "script", "typicalSpeakers", "origin", "dialects"})
    for key, field in (("type", "language_type"), ("script", "script"), ("origin", "origin")):
        if entry.get(key):
            out[field] = _words(entry[key], problems)
    if entry.get("typicalSpeakers"):
        out["typical_speakers"] = _words(entry["typicalSpeakers"], problems)
    if entry.get("dialects"):
        out["text"] = _join(out["text"], _line("Dialects", _words(entry["dialects"], problems)))
    return out, problems


def clean_cult(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "cult", "lore", problems, {"type", "goal", "cultists", "signatureSpells"})
    if entry.get("type"):
        out["cult_type"] = entry["type"]
    out["text"] = _join(_line("Goal", _words(entry.get("goal"), problems)),
                        _line("Typical cultists", _words(entry.get("cultists"), problems)),
                        _line("Signature spells", _words(entry.get("signatureSpells"), problems)),
                        out["text"])
    return out, problems


def clean_boon(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "boon", "lore", problems, {"type", "abilityEntry", "signatureSpells"})
    if entry.get("type"):
        out["boon_type"] = entry["type"]
    out["text"] = _join(_line("Ability score", _words(entry.get("abilityEntry"), problems)),
                        _line("Signature spells", _words(entry.get("signatureSpells"), problems)),
                        out["text"])
    return out, problems


# ─── toolkit ──────────────────────────────────────────────────────────

def _rating(entry: dict, out: dict) -> str:
    tiers, threats, words = [], [], []
    for r in entry.get("rating") or []:
        if r.get("tier") is not None and r["tier"] not in tiers:
            tiers.append(r["tier"])
        if r.get("threat") and r["threat"] not in threats:
            threats.append(r["threat"])
        lvl = r.get("level")
        if isinstance(lvl, dict):
            words.append(f"levels {lvl.get('min')}–{lvl.get('max')}")
    if tiers:
        out["tiers"] = tiers
    if threats:
        out["threat"] = threats[0] if len(threats) == 1 else ", ".join(threats)
    return ", ".join([*(f"tier {t}" for t in tiers), *threats, *words])


def _duration_words(value, problems) -> str:
    """[{"type": "instant"}] -> "Instantaneous"; {"type": "special", "condition": "…"} -> the condition."""
    if not value:
        return ""
    out = []
    for d in value if isinstance(value, list) else [value]:
        if not isinstance(d, dict):
            out.append(_words(d, problems))
        elif d.get("type") == "instant":
            out.append("Instantaneous")
        elif d.get("type") == "special":
            out.append(_words(d.get("condition") or "Special", problems))
        elif d.get("type") == "timed" and isinstance(d.get("duration"), dict):
            t = d["duration"]
            out.append(f"{t.get('amount', 1)} {t.get('type', '')}" + ("s" if t.get("amount", 1) != 1 else ""))
        else:
            out.append(_text([d], problems))
    return " or ".join(x for x in out if x)


def clean_trap(entry: dict, kind: str = "trap") -> tuple[dict, list]:
    problems: list = []
    handled = {"trapHazType", "rating", "trigger", "effect", "countermeasures", "duration", "initiative", "initiativeNote",
               "eActive", "eDynamic", "eConstant", "hauntBonus"}
    out = _base(entry, kind, "toolkit", problems, handled)
    if entry.get("trapHazType"):
        out["trap_type"] = TRAP_TYPES.get(entry["trapHazType"], entry["trapHazType"])
    _rating(entry, out)  # tiers and threat are the card's lines
    init = entry.get("initiative")
    init_words = f"{init}" + (f" ({_words(entry.get('initiativeNote'), problems)})" if entry.get("initiativeNote") else "") if init else ""
    out["text"] = _join(
        out["text"],
        _line("Trigger", _text(entry.get("trigger"), problems)),
        _line("Effect", _text(entry.get("effect"), problems)),
        _line("Duration", _duration_words(entry.get("duration"), problems)),
        _line("Initiative", init_words),
        _line("Active elements", _text(entry.get("eActive"), problems)),
        _line("Dynamic elements", _text(entry.get("eDynamic"), problems)),
        _line("Constant elements", _text(entry.get("eConstant"), problems)),
        _line("Haunt bonus", _words(entry.get("hauntBonus"), problems)),
        _line("Countermeasures", _text(entry.get("countermeasures"), problems)),
    )
    return out, problems


def clean_hazard(entry: dict) -> tuple[dict, list]:
    return clean_trap(entry, "hazard")


def _defense_line(label: str, value, problems) -> str:
    if not value:
        return ""
    words = []
    for v in value:
        if isinstance(v, str):
            words.append(v)
        elif isinstance(v, dict):
            inner = v.get("immune") or v.get("resist") or v.get("conditionImmune") or []
            words.append(", ".join(str(x) for x in inner) + (f" {v['note']}" if v.get("note") else ""))
    return f"**{label}** {', '.join(w for w in words if w)}"


def _size_words(size) -> str:
    sizes = size if isinstance(size, list) else [size] if size else []
    return " or ".join(SIZES.get(s, str(s)) for s in sizes)


def _speed_words(speed) -> str:
    if isinstance(speed, int):
        return f"{speed} ft."
    if isinstance(speed, dict):
        return ", ".join(f"{k} {v} ft." if k != "walk" else f"{v} ft." for k, v in speed.items() if isinstance(v, int))
    return str(speed or "")


def _object_lines(entry: dict, problems: list) -> list[str]:
    """An object's numbers as lines: AC · HP · speed, abilities, immunities."""
    ac, hp = entry.get("ac"), entry.get("hp")
    stats = " · ".join(x for x in (
        f"**Armor Class** {ac if not isinstance(ac, dict) else _words(ac.get('special') or ac, problems)}" if ac is not None else "",
        f"**Hit Points** {hp if not isinstance(hp, dict) else _words(hp.get('special') or hp, problems)}" if hp is not None else "",
        f"**Speed** {_speed_words(entry.get('speed'))}" if entry.get("speed") is not None else "",
    ) if x)
    return [
        stats,
        _abilities_line(entry),
        _defense_line("Damage Immunities", entry.get("immune"), problems),
        _defense_line("Damage Resistances", entry.get("resist"), problems),
        _defense_line("Damage Vulnerabilities", entry.get("vulnerable"), problems),
        _defense_line("Condition Immunities", entry.get("conditionImmune"), problems),
        _line("Senses", _words(entry.get("senses"), problems)),
    ]


def clean_object(entry: dict) -> tuple[dict, list]:
    problems: list = []
    handled = {"size", "objectType", "ac", "hp", "immune", "resist", "vulnerable", "conditionImmune", "actionEntries", "speed",
               "creatureType", "senses", *ABILITIES}
    out = _base(entry, "object", "toolkit", problems, handled)
    if entry.get("objectType"):
        out["object_type"] = OBJECT_TYPES.get(entry["objectType"], entry["objectType"])
    if entry.get("size"):
        out["size"] = _size_words(entry["size"])
    out["text"] = _join(
        *_object_lines(entry, problems),
        out["text"],
        _text(entry.get("actionEntries"), problems),
    )
    return out, problems


def _cost_words(cp) -> str:
    """Copper pieces -> "50,000 gp"."""
    try:
        return f"{int(cp) // 100:,} gp"
    except (TypeError, ValueError):
        return str(cp)


def _named_entries(label: str, items, problems) -> str:
    """A list of { name, entries } (a vehicle's traits, actions, stations) as named paragraphs under a label."""
    if not items:
        return ""
    blocks = []
    for it in items:
        if isinstance(it, dict):
            blocks.append({"type": "entries", "name": it.get("name"), "entries": it.get("entries") or []})
        else:
            blocks.append(it)
    return _join(f"**{label}**", _text(blocks, problems))


def _weapon(w: dict, problems) -> dict:
    head = f"{w.get('name', 'Weapon')}" + (f" ({w['count']})" if w.get("count", 1) != 1 else "")
    stats = ", ".join(x for x in (
        f"AC {w['ac']}" if w.get("ac") is not None else "",
        f"HP {w['hp']}" if w.get("hp") is not None else "",
        f"crew {w['crew']}" if w.get("crew") is not None else "",
        ", ".join(f"{_cost_words(cst['cost'])} per {cst.get('note', '')}".strip() for cst in w.get("costs") or [] if cst.get("cost")),
    ) if x)
    entries = ([f"*{stats}*"] if stats else []) + list(w.get("entries") or [])
    for a in w.get("action") or []:
        entries.append({"type": "entries", "name": a.get("name"), "entries": a.get("entries") or []})
    return {"type": "entries", "name": head, "entries": entries}


def clean_vehicle(entry: dict) -> tuple[dict, list]:
    problems: list = []
    handled = {"vehicleType", "terrain", "size", "dimensions", "capCrew", "capCrewNote", "capPassenger", "capCargo", "capCreature",
               "pace", "speed", "hull", "weapon", "cost", "weight", "immune", "conditionImmune", "resist", "hp", "ac",
               "action", "trait", "reaction", "actionStation", "station", "movement", "control", "other", "actionThresholds",
               *ABILITIES}
    out = _base(entry, "vehicle", "toolkit", problems, handled)
    if entry.get("vehicleType"):
        out["vehicle_type"] = VEHICLE_TYPES.get(entry["vehicleType"], entry["vehicleType"])
    if entry.get("terrain"):
        out["terrain"] = [str(t) for t in entry["terrain"]]
    hull = entry.get("hull") or {}
    pace = entry.get("pace")
    caps = ", ".join(x for x in (
        f"{entry['capCrew']} crew" + (f" ({entry['capCrewNote']})" if entry.get("capCrewNote") else "") if entry.get("capCrew") is not None else "",
        f"{entry['capPassenger']} passengers" if entry.get("capPassenger") is not None else "",
        f"{entry['capCreature']} creatures" if entry.get("capCreature") is not None else "",
        f"{entry['capCargo']} tons cargo" if entry.get("capCargo") is not None else "",
    ) if x)
    hp = entry.get("hp") or {}
    lines = [
        " · ".join(x for x in (
            f"**Size** {_size_words(entry['size'])}" if entry.get("size") else "",
            f"**Dimensions** {' by '.join(entry['dimensions'])}" if entry.get("dimensions") else "",
        ) if x),
        f"**Capacity** {caps}" if caps else "",
        " · ".join(x for x in (
            f"**Speed** {_speed_words(entry.get('speed'))}" if entry.get("speed") else "",
            f"**Travel pace** {pace if isinstance(pace, int) else ', '.join(f'{k} {v}' for k, v in pace.items())} miles per hour" if pace else "",
        ) if x),
        " · ".join(x for x in (
            f"**Armor Class** {hull.get('ac', entry.get('ac'))}" + (f" ({', '.join(hull['acFrom'])})" if hull.get("acFrom") else "") if hull.get("ac") or entry.get("ac") else "",
            f"**Hit Points** {hull.get('hp') or (hp.get('hp') if isinstance(hp, dict) else hp)}" if hull.get("hp") or hp else "",
            f"**Damage Threshold** {hull.get('dt') or (hp.get('dt') if isinstance(hp, dict) else '')}" if hull.get("dt") or (isinstance(hp, dict) and hp.get("dt")) else "",
            f"**Cost** {_cost_words(entry['cost'])}" if entry.get("cost") else "",
            f"**Weight** {entry['weight']} lb." if entry.get("weight") else "",
        ) if x),
        _abilities_line(entry),
        _defense_line("Damage Immunities", entry.get("immune"), problems),
        _defense_line("Damage Resistances", entry.get("resist"), problems),
        _defense_line("Condition Immunities", entry.get("conditionImmune"), problems),
    ]
    thresholds = entry.get("actionThresholds")
    out["text"] = _join(
        *lines,
        out["text"],
        _named_entries("Traits", entry.get("trait"), problems),
        _named_entries("Action stations", entry.get("actionStation"), problems),
        _named_entries("Stations", entry.get("station"), problems),
        _text(entry.get("action"), problems) if entry.get("action") and not isinstance(entry["action"][0], dict) else _named_entries("Actions", entry.get("action"), problems),
        _line("Action thresholds", ", ".join(f"{k}: {v}" for k, v in thresholds.items()) if isinstance(thresholds, dict) else ""),
        _named_entries("Reactions", entry.get("reaction"), problems),
        _named_entries("Control", entry.get("control"), problems),
        _named_entries("Movement", entry.get("movement"), problems),
        _named_entries("Weapons", [_weapon(w, problems) for w in entry.get("weapon") or []], problems),
        _named_entries("Other", entry.get("other"), problems),
    )
    return out, problems


def clean_vehicle_upgrade(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "vehicle_upgrade", "toolkit", problems, {"upgradeType"})
    types = [UPGRADE_TYPES.get(t, t) for t in entry.get("upgradeType") or []]
    if types:
        out["upgrade_type"] = ", ".join(types)
    return out, problems


def clean_reward(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "reward", "toolkit", problems, {"type", "rarity"})
    if entry.get("type"):
        out["reward_type"] = entry["type"]
    if entry.get("rarity"):
        out["rarity"] = entry["rarity"]
    return out, problems


def _hirelings(value) -> str:
    out = []
    for h in value or []:
        n = h.get("exact") if h.get("exact") is not None else f"{h.get('min', '?')}–{h.get('max', '?')}"
        out.append(f"{n}" + (f" ({h['space']})" if h.get("space") else ""))
    return ", ".join(out)


def clean_facility(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "facility", "toolkit", problems, {"facilityType", "level", "space", "hirelings", "orders", "prerequisite"})
    if entry.get("facilityType"):
        out["facility_type"] = entry["facilityType"]
    if entry.get("level") is not None:
        out["level"] = entry["level"]
    if entry.get("space"):
        out["space"] = [str(s) for s in entry["space"]]
    if entry.get("hirelings"):
        out["hirelings"] = _hirelings(entry["hirelings"])
    if entry.get("orders"):
        out["orders"] = [str(o) for o in entry["orders"]]
    out["text"] = _join(_line("Prerequisite", _prerequisite_line(entry, problems)), out["text"])
    return out, problems


def clean_character_option(entry: dict) -> tuple[dict, list]:
    problems: list = []
    out = _base(entry, "character_option", "toolkit", problems, {"optionType", "prerequisite"})
    types = [OPTION_TYPES.get(t, t) for t in entry.get("optionType") or []]
    if types:
        out["option_type"] = ", ".join(types)
    out["text"] = _join(_line("Prerequisite", _prerequisite_line(entry, problems)), out["text"])
    return out, problems


# data_cleaner.CLEANERS: (list in the resolved file, cleaner) for each catalogue.
REFERENCE_CLEANERS = {
    "rules": [("action", clean_action), ("condition", clean_condition), ("disease", clean_disease), ("status", clean_status),
              ("sense", clean_sense), ("skill", clean_skill), ("variantrule", clean_rule)],
    "lore": [("deity", clean_deity), ("language", clean_language), ("cult", clean_cult), ("boon", clean_boon)],
    "toolkit": [("trap", clean_trap), ("hazard", clean_hazard), ("object", clean_object), ("vehicle", clean_vehicle),
                ("vehicleUpgrade", clean_vehicle_upgrade), ("reward", clean_reward), ("facility", clean_facility),
                ("charoption", clean_character_option)],
}
