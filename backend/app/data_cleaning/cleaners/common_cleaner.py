"""Helpers every code cleaner uses: raw 5etools keys -> our grants and choices.

Each parser takes a raw value and a `problems` list. Anything it doesn't
understand is added to `problems` (never silently dropped), so the run
report shows exactly what still needs handling.

Choices are built as plain dicts here; the category schema checks them
at the end. Their ids are given by `assign_ids()` once the whole entry is
built, so they are unique within the entry.

Raw rules (from the inspector reports):
  - several dicts in a proficiency/feat/spell list are ALTERNATIVES:
    the player takes one dict  ->  a bundle choice
  - several dicts in startingEquipment are SLOTS: all are taken
  - "name|source" refs without a source mean PHB
"""

import re

ABILITIES = ["str", "dex", "con", "int", "wis", "cha"]
SKILLS = {
    "acrobatics", "animal_handling", "arcana", "athletics", "deception", "history",
    "insight", "intimidation", "investigation", "medicine", "nature", "perception",
    "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival",
}
DEFAULT_SOURCE = "phb"

# Raw "any…" keys and group words -> our group ids.
SKILL_GROUPS = {"any": "all_skills", "anyskill": "all_skills"}
TOOL_GROUPS = {
    "any": "all_tools", "anytool": "all_tools",
    "anyartisanstool": "artisans_tools", "artisan's tools": "artisans_tools", "artisans tools": "artisans_tools",
    "anygamingset": "gaming_sets", "gaming set": "gaming_sets",
    "anymusicalinstrument": "musical_instruments", "musical instrument": "musical_instruments",
}
LANGUAGE_GROUPS = {
    "any": "all_languages", "anylanguage": "all_languages",
    "anystandard": "standard_languages", "anyexotic": "rare_languages", "anyrare": "rare_languages",
}
WEAPON_GROUPS = {"simple": "simple_weapons", "martial": "martial_weapons"}
ARMOR_IDS = {"light": "light", "medium": "medium", "heavy": "heavy", "shield": "shields", "shields": "shields"}
EQUIPMENT_GROUPS = {
    "setGaming": "gaming_sets", "toolArtisan": "artisans_tools", "instrumentMusical": "musical_instruments",
    "weaponSimple": "simple_weapons", "weaponMartial": "martial_weapons",
    "weaponSimpleMelee": "simple_melee_weapons", "weaponMartialMelee": "martial_melee_weapons",
    "focusSpellcastingArcane": "arcane_focuses", "focusSpellcastingDruidic": "druidic_focuses",
    "focusSpellcastingHoly": "holy_symbols",
}
KIND_LABELS = {
    "skills": "Skills", "tools": "Tools", "languages": "Languages", "weapons": "Weapons",
    "armor": "Armor", "feats": "Feat", "spells": "Spells", "items": "Equipment",
    "spell_ability": "Spellcasting Ability", "defenses.resist": "Damage Resistance", "size": "Size",
}


# ---------- names and ids ----------

def slug(text: str) -> str:
    """"Holy Symbol" -> "holy-symbol"."""
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower().replace("'", "")).strip("-")


def snake(text: str) -> str:
    """"thieves' tools" -> "thieves_tools", "vehicles (land)" -> "vehicles_land"."""
    return re.sub(r"[^a-z0-9]+", "_", str(text).lower().replace("'", "")).strip("_")


def entry_id(name: str, source: str) -> str:
    return f"{slug(name)}-{str(source).lower()}"


def split_ref(ref: str) -> dict:
    """"magic initiate; cleric|xphb" -> {name, option, source, flags}.
    "fire bolt|xphb#c" -> flags "c"; "hellish rebuke#2" -> flags "2"."""
    ref = str(ref).strip()
    flags = None
    if "#" in ref:
        ref, flags = ref.rsplit("#", 1)
    name, _, rest = ref.partition("|")
    source = (rest.split("|")[0] or DEFAULT_SOURCE).lower()
    option = None
    if ";" in name:
        name, option = (p.strip() for p in name.split(";", 1))
    return {"name": name.strip(), "option": option, "source": source, "flags": flags}


def ref_id(ref: str) -> str:
    r = split_ref(ref)
    return entry_id(r["name"], r["source"])


def title(text: str) -> str:
    return " ".join(w[:1].upper() + w[1:] for w in str(text).split(" "))


# ---------- choices ----------

def pool(grant, frm, count=1, label=None, **extra) -> dict:
    kinds = grant if isinstance(grant, list) else [grant]
    c = {"type": "pool", "id": None, "label": label or " or ".join(KIND_LABELS.get(k, k) for k in kinds),
         "grant": grant, "count": int(count), "from": frm}
    c.update({k: v for k, v in extra.items() if v is not None})
    return c


def bundle(label: str, options: list[dict]) -> dict:
    return {"type": "bundle", "id": None, "label": label, "options": options}


def option(oid: str, label: str, grants: dict, choices: list) -> dict:
    return {"id": oid, "label": label, "grants": grants, "choices": choices}


def assign_ids(choices: list[dict]) -> None:
    """Give every choice in the entry (options included) a unique id,
    based on what it grants: "skills", "skills_2", "equipment", …"""
    used: set[str] = set()

    def walk(cs):
        for c in cs:
            if c.get("id"):
                used.add(c["id"])
            for o in c.get("options", []):
                walk(o.get("choices", []))

    def name(c):
        g = c.get("grant")
        if c["type"] == "ability":
            return "ability"
        if c["type"] == "bundle":
            return snake(c["label"]) or "choice"
        return "_or_".join(g) if isinstance(g, list) else g.replace(".", "_")

    def fill(cs):
        for c in cs:
            if not c.get("id"):
                base, n = name(c), 1
                cid = base
                while cid in used:
                    n += 1
                    cid = f"{base}_{n}"
                c["id"] = cid
                used.add(cid)
            for o in c.get("options", []):
                fill(o.get("choices", []))

    walk(choices)
    fill(choices)


def add_grants(grants: dict, more: dict) -> None:
    """Merge `more` into `grants` (lists are joined without repeats)."""
    for k, v in more.items():
        if v in (None, [], {}):
            continue
        if isinstance(v, list):
            have = grants.setdefault(k, [])
            have.extend(x for x in v if x not in have)
        elif isinstance(v, dict) and k in grants:
            grants[k].update(v)
        else:
            grants[k] = v


def alternatives(dicts: list, parse_one, label: str, problems: list) -> tuple[dict, list]:
    """A raw list of dicts: one dict = take it; several = pick one of them."""
    if not dicts:
        return {}, []
    if len(dicts) == 1:
        return parse_one(dicts[0], problems)
    options = []
    for i, d in enumerate(dicts):
        g, ch = parse_one(d, problems)
        options.append(option(chr(97 + i), describe(g, ch), g, ch))
    return {}, [bundle(label, options)]


def describe(grants: dict, choices: list) -> str:
    """A short label for an option: what it gives."""
    parts = []
    for k, v in grants.items():
        if k == "currency":
            parts.append(money_text(v))
        elif k == "ability":
            parts.append(", ".join(f"{a.upper()} {n:+d}" for a, n in v.items()))
        elif isinstance(v, list):
            for x in v:
                if isinstance(x, dict):
                    parts.append(x.get("name") or title((x.get("item") or x.get("feat") or x.get("spell") or "").rsplit("-", 1)[0].replace("-", " ")))
                else:
                    parts.append(title(str(x).replace("_", " ")))
    for c in choices:
        parts.append(pool_text(c) if c["type"] == "pool" else c["label"])
    return ", ".join(p for p in parts if p) or "—"


def pool_text(c: dict) -> str:
    """"2 from Standard Languages", "1 from Musical Instruments or Gaming Sets"."""
    frm = c["from"]
    if isinstance(frm, str):
        what = title(frm.replace("_", " "))
    elif isinstance(frm, list):
        names = [title(str(x).replace("_", " ")) for x in frm]
        what = " or ".join(names[:4]) + (" …" if len(names) > 4 else "")
    else:
        what = c["label"]
    return f"{c.get('count', 1)} from {what}"


# ---------- proficiencies ----------

def _prof_parser(kind: str, groups: dict, make_id, known: set | None = None):
    """A parser for one raw proficiency dict of `kind`."""

    def to_id(name: str) -> str:
        low = str(name).lower()
        return groups.get(low.replace(" ", "") if low.startswith("any") else low) or make_id(name)

    def parse(d: dict, problems: list) -> tuple[dict, list]:
        fixed, choices = [], []
        for key, val in d.items():
            low = key.lower()
            if low == "other":
                continue  # "a language of your choice / the race's own language": ignored (decided)
            if key == "choose":
                if "fromFilter" in val:
                    frm = filter_group(val["fromFilter"], problems)
                else:
                    frm = [to_id(x) for x in val.get("from", []) if str(x).lower() != "other"]
                    if len(frm) == 1 and frm[0] in GROUP_IDS:
                        frm = frm[0]
                choices.append(pool(kind, frm, val.get("count", 1)))
            elif low in groups and isinstance(val, int) and not isinstance(val, bool):
                choices.append(pool(kind, groups[low], val))
            elif val is True and low in groups:
                choices.append(pool(kind, groups[low], 1))
            elif val is True:
                pid = make_id(key)
                if known is not None and pid not in known:
                    problems.append(f"{kind}: unknown '{key}'")
                fixed.append(pid)
            else:
                problems.append(f"{kind}: can't read {key}={val!r}")
        return ({kind: fixed} if fixed else {}), choices

    return parse


def filter_group(filt: str, problems: list) -> str | dict:
    """"type=martial weapon|miscellaneous=mundane" -> "martial_weapons"."""
    low = filt.lower()
    if "mundane weapon" in low:
        return "all_weapons"
    if "martial weapon" in low and "simple" not in low:
        return "martial_weapons"
    if "simple weapon" in low:
        return "simple_weapons"
    problems.append(f"unknown filter '{filt}'")
    return {"filter": filt}


GROUP_IDS = {"all_skills", "all_tools", "all_languages", "standard_languages", "rare_languages",
             "artisans_tools", "gaming_sets", "musical_instruments", "simple_weapons", "martial_weapons"}


def _weapon_id(name: str) -> str:
    low = name.lower()
    if low in WEAPON_GROUPS:
        return WEAPON_GROUPS[low]
    return snake(split_ref(name)["name"])


PARSERS = {
    "skills": _prof_parser("skills", SKILL_GROUPS, snake, SKILLS),
    "tools": _prof_parser("tools", TOOL_GROUPS, snake),
    "languages": _prof_parser("languages", LANGUAGE_GROUPS, snake),
    "weapons": _prof_parser("weapons", {}, _weapon_id),
    "armor": _prof_parser("armor", {}, lambda k: ARMOR_IDS.get(k.lower(), snake(k))),
}


def proficiencies(raw: list | None, kind: str, problems: list) -> tuple[dict, list]:
    """skillProficiencies, toolProficiencies, languageProficiencies,
    weaponProficiencies, armorProficiencies."""
    return alternatives(raw or [], PARSERS[kind], KIND_LABELS[kind], problems)


MIXED_GROUPS = {"anyskill": ("skills", "all_skills"), "anytool": ("tools", "all_tools"),
                "anylanguage": ("languages", "all_languages")}


def _mixed_one(d: dict, problems: list) -> tuple[dict, list]:
    choices = []
    for key, val in d.items():
        low = key.lower()
        if low in MIXED_GROUPS and isinstance(val, int):
            kind, group = MIXED_GROUPS[low]
            choices.append(pool(kind, group, val))
        elif key == "choose":
            for c in val if isinstance(val, list) else [val]:
                picked = [MIXED_GROUPS.get(str(x).lower()) for x in c.get("from", [])]
                if None in picked:
                    problems.append(f"mixed proficiencies: can't read {c}")
                    continue
                kinds = [k for k, _ in picked]
                choices.append(pool(kinds if len(kinds) > 1 else kinds[0],
                                    [g for _, g in picked] if len(picked) > 1 else picked[0][1], c.get("count", 1)))
        else:
            problems.append(f"mixed proficiencies: can't read {key}={val!r}")
    return {}, choices


def mixed_proficiencies(raw: list | None, problems: list) -> tuple[dict, list]:
    """skillToolLanguageProficiencies: "any skill or tool" style picks."""
    return alternatives(raw or [], _mixed_one, "Proficiencies", problems)


# ---------- ability scores ----------

def _ability_choice(frm, bonus_sets, cap=None, note=None) -> dict:
    c = {"type": "ability", "id": None, "label": "Ability Scores", "from": frm, "bonus_sets": bonus_sets}
    if cap:
        c["max"] = cap
    if note:
        c["note"] = note
    return c


def _ability_one(d: dict, problems: list) -> tuple[dict, list]:
    fixed = {a: d[a] for a in ABILITIES if a in d}
    cap = d.get("max")            # epic boons: "to a maximum of 30"
    choices = []
    c = d.get("choose")
    if c:
        if "weighted" in c:
            w = c["weighted"]
            choices.append(_ability_choice(w["from"], [w["weights"]], cap))
        else:
            amount, count = c.get("amount", 1), c.get("count", 1)
            choices.append(_ability_choice(c["from"], [[amount] * count], cap, c.get("entry")))
    if fixed and cap:
        # a fixed increase with its own cap: kept as a one-option choice so the cap travels with it
        for a, n in fixed.items():
            choices.append(_ability_choice([a], [[n]], cap))
        fixed = {}
    extra = set(d) - set(ABILITIES) - {"choose", "max", "hidden"}
    if extra:
        problems.append(f"ability: can't read {sorted(extra)}")
    return ({"ability": fixed} if fixed else {}), choices


def ability_scores(raw: list | None, problems: list) -> tuple[dict, list]:
    """`ability`. Several dicts are alternatives, but when they are all
    plain picks over the same abilities they become ONE ability choice
    with several bonus sets:
      2024 backgrounds   +2/+1 or +1/+1/+1  -> bonus_sets [[2,1],[1,1,1]]
      Ability Score Improvement  +2 or +1/+1 -> bonus_sets [[2],[1,1]]"""
    raw = raw or []
    picks = []
    for d in raw:
        c = d.get("choose") or {}
        if set(d) - {"choose", "max", "hidden"} or not c:
            break
        if "weighted" in c:
            picks.append((c["weighted"]["from"], c["weighted"]["weights"]))
        else:
            picks.append((c["from"], [c.get("amount", 1)] * c.get("count", 1)))
    if len(raw) > 1 and len(picks) == len(raw) and all(sorted(f) == sorted(picks[0][0]) for f, _ in picks):
        return {}, [_ability_choice(picks[0][0], [b for _, b in picks], raw[0].get("max"))]
    return alternatives(raw, _ability_one, "Ability Scores", problems)


def lineage_ability() -> dict:
    """`lineage: "VRGR"`: +2/+1 or +1/+1/+1 to any abilities."""
    return _ability_choice(list(ABILITIES), [[2, 1], [1, 1, 1]])


# ---------- feats ----------

def _feats_one(d: dict, problems: list) -> tuple[dict, list]:
    fixed, choices = [], []
    for key, val in d.items():
        if key == "any":
            choices.append(pool("feats", "all_feats", val))
        elif key == "anyFromCategory":
            cats = [FEAT_CATEGORIES.get(x) for x in val.get("category", [])]
            if None in cats:
                problems.append(f"feats: unknown category in {val.get('category')}")
            choices.append(pool("feats", {"category": [x for x in cats if x]}, val.get("count", 1)))
        elif val is True:
            r = split_ref(key)
            fixed.append({"feat": entry_id(r["name"], r["source"]), "option": r["option"]})
        else:
            problems.append(f"feats: can't read {key}={val!r}")
    return ({"feats": [{k: v for k, v in f.items() if v} for f in fixed]} if fixed else {}), choices


def feats(raw: list | None, problems: list) -> tuple[dict, list]:
    return alternatives(raw or [], _feats_one, "Feat", problems)


# ---------- spells ----------

SCHOOLS = {"A": "abjuration", "C": "conjuration", "D": "divination", "E": "enchantment",
           "V": "evocation", "I": "illusion", "N": "necromancy", "T": "transmutation"}


def spell_filter(text: str, problems: list) -> dict:
    """"level=0|class=Wizard" -> {"spell_level": 0, "class": "wizard"}.
    Also school letters, ritual, and spell attack."""
    out = {}
    if not str(text).strip():
        return out           # "" = any spell (Magical Secrets at 18)
    for part in str(text).split("|"):
        if "=" not in part:
            problems.append(f"spells: can't read filter '{text}'")
            continue
        k, v = (p.strip() for p in part.split("=", 1))
        k = k.lower()
        vals = [x.strip() for x in v.split(";") if x.strip()]
        one = lambda xs: xs[0] if len(xs) == 1 else xs
        if k == "level":
            out["spell_level"] = one([int(x) for x in vals if x.isdigit()])
        elif k == "class":
            out["class"] = one([x.lower() for x in vals])
        elif k == "school":
            if any(x.upper() not in SCHOOLS for x in vals):
                problems.append(f"spells: unknown school in '{text}'")
            out["school"] = one([SCHOOLS.get(x.upper(), x.lower()) for x in vals])
        elif k == "components & miscellaneous" and [x.lower() for x in vals] == ["ritual"]:
            out["ritual"] = True
        elif k == "source":
            # "source=EGW;!XGE": spells from EGW, except those also printed in XGE
            keep = [x.lower() for x in vals if not x.startswith("!")]
            drop = [x[1:].lower() for x in vals if x.startswith("!")]
            if keep:
                out["source"] = one(keep)
            if drop:
                out["not_source"] = one(drop)
        elif k == "spell attack":
            out["spell_attack"] = one([{"m": "melee", "r": "ranged", "o": "other"}.get(x.lower(), x) for x in vals])
        else:
            problems.append(f"spells: unknown filter key '{k}'")
            out[k] = one(vals)
    return out


def spell_grant(ref: str, how: str, at, uses, ability, at_spell_level=None) -> dict:
    r = split_ref(ref)
    g = {"spell": entry_id(r["name"], r["source"]), "how": how}
    if at is not None:
        g["at"] = at
    if at_spell_level is not None:
        g["at_spell_level"] = at_spell_level
    if uses is not None:
        g["uses"] = uses
    if r["flags"] and r["flags"].isdigit():
        g["cast_at"] = int(r["flags"])
    if ability is not None:
        g["ability"] = ability
    return g


# One id per class resource, however the book spells it. Ki (2014) and
# Focus Points (2024) are the same Monk resource, so both are "focus_points".
RESOURCE_IDS = {
    "ki": "focus_points", "ki_point": "focus_points", "ki_points": "focus_points",
    "focus_point": "focus_points", "sorcery_point": "sorcery_points",
    "superiority_die": "superiority_dice", "rages": "rage",
    "psionic_energy_die": "psionic_energy_dice", "soul_fragment": "soul_fragments",
    "psi_point": "psi_points", "sorcery_points": "sorcery_points",
}


def resource_id(name: str) -> str:
    """"Sorcery Point" / "Sorcery Points" -> "sorcery_points"; "Ki" -> "focus_points"."""
    s = snake(name)
    return RESOURCE_IDS.get(s, s)


def _spells_one(d: dict, problems: list, inherit=None) -> tuple[dict, list]:
    grants, choices = [], []
    resource = resource_id(d["resourceName"]) if d.get("resourceName") else None   # e.g. "focus_points"
    ability = d.get("ability")
    if isinstance(ability, dict) and "choose" in ability:
        choices.append(pool("spell_ability", ability["choose"], 1, label="Spellcasting Ability"))
        choices[-1]["id"] = "spell_ability"
        ability = {"choice": "spell_ability"}
    elif ability == "inherit":
        # "the ability you increased with this feat"
        if inherit is None:
            problems.append("spells: ability 'inherit' but the entry has no ability to inherit")
        ability = inherit
    elif ability is not None and ability not in ABILITIES:
        problems.append(f"spells: can't read ability {ability!r}")
        ability = None

    def content(c, how, at, uses, at_sl):
        if isinstance(c, list):
            for x in c:
                if isinstance(x, str):
                    grants.append(spell_grant(x, how, at, uses, ability, at_sl))
                elif isinstance(x, dict) and "choose" in x:
                    ch = x["choose"]
                    if isinstance(ch, dict):     # pick from a short list of spells
                        frm, count = [ref_id(sp) for sp in ch.get("from", [])], ch.get("count", x.get("count", 1))
                    else:
                        frm, count = spell_filter(ch, problems), x.get("count", 1)
                    choices.append(pool("spells", frm, count, how=how, at=at, at_spell_level=at_sl,
                                        uses=uses, ability=ability))
                else:
                    problems.append(f"spells: can't read {x!r}")
        elif isinstance(c, dict):
            for k, v in c.items():
                if k == "_":
                    content(v, how, at, uses, at_sl)
                elif k == "will":
                    content(v, how, at, "at_will", at_sl)
                elif k == "ritual":
                    content(v, how, at, "ritual", at_sl)
                elif k == "resource":
                    # cast by spending a class resource: {"2": ["thunderwave"]} = 2 ki
                    for cost, spells_ in v.items():
                        if not str(cost).isdigit():
                            problems.append(f"spells: can't read resource cost {cost!r}")
                            continue
                        content(spells_, how, at, {"resource": resource or "resource", "cost": int(cost)}, at_sl)
                elif k in ("daily", "rest"):
                    for n, spells_ in v.items():
                        n = n.rstrip("e")
                        mx = ("pb" if n == "pb" else int(n) if n.isdigit()
                              else f"max(1, {n}_mod)" if n in ABILITIES else None)   # daily.int: Int mod times
                        if mx is None:
                            problems.append(f"spells: can't read {k}.{n}")
                            continue
                        content(spells_, how, at, {"max": mx, "reset": "long" if k == "daily" else "short"}, at_sl)
                else:
                    problems.append(f"spells: can't read '{k}'")
        else:
            problems.append(f"spells: can't read {c!r}")

    for section, how in (("known", "known"), ("prepared", "prepared"), ("innate", "prepared")):
        for lvl, c in (d.get(section) or {}).items():
            lvl = str(lvl)
            if lvl == "_":
                content(c, how, 1, None, None)
            elif lvl.isdigit():
                content(c, how, int(lvl), None, None)
            elif lvl[:1] == "s" and lvl[1:].isdigit():
                # unlocked when you can cast spells of that level, not at a character level
                content(c, how, None, None, int(lvl[1:]))
            else:
                problems.append(f"spells: can't read level '{lvl}'")
    for key, spells_ in (d.get("expanded") or {}).items():
        for x in spells_ if isinstance(spells_, list) else [spells_]:
            if isinstance(x, str):
                grants.append(spell_grant(x, "list", 1, None, None))
            else:
                problems.append(f"spells: can't read expanded {x!r}")
    extra = set(d) - {"ability", "known", "prepared", "innate", "expanded", "name", "resourceName"}
    if extra:
        problems.append(f"spells: can't read {sorted(extra)}")
    return ({"spells": grants} if grants else {}), choices


def spells(raw: list | None, problems: list, inherit=None) -> tuple[dict, list]:
    """additionalSpells. Several dicts are alternatives; their `name` (if
    any) labels the option. `inherit` is what `ability: "inherit"` means
    for this entry (usually {"choice": "ability"})."""
    raw = raw or []
    if len(raw) <= 1:
        return alternatives(raw, lambda d, p: _spells_one(d, p, inherit), "Spells", problems)
    options = []
    for i, d in enumerate(raw):
        g, ch = _spells_one(d, problems, inherit)
        options.append(option(snake(d["name"]) if d.get("name") else chr(97 + i),
                              d.get("name") or describe(g, ch), g, ch))
    return {}, [bundle("Spells", options)]


# ---------- other grants (feats, races) ----------

def defenses(entry: dict, problems: list) -> tuple[dict, list]:
    """resist (fixed or "choose"), immune, vulnerable, conditionImmune."""
    out, choices = {}, []
    for raw_key, key in (("resist", "resist"), ("immune", "immune"), ("vulnerable", "vulnerable"),
                         ("conditionImmune", "condition_immune")):
        for x in entry.get(raw_key) or []:
            if isinstance(x, str):
                out.setdefault(key, []).append(x)
            elif isinstance(x, dict) and "choose" in x and key == "resist":
                ch = x["choose"]
                choices.append(pool("defenses.resist", ch.get("from", []), ch.get("count", 1)))
            else:
                problems.append(f"{raw_key}: can't read {x!r}")
    return ({"defenses": out} if out else {}), choices


def senses(raw: list | None, problems: list, key: str = "senses") -> dict:
    """senses: [{"blindsight": 10}] -> {"blindsight": 10}."""
    out = {}
    for d in raw or []:
        for k, v in d.items():
            if isinstance(v, int) and k in ("darkvision", "blindsight", "tremorsense", "truesight"):
                out[k] = v
            elif isinstance(v, int) and k == "devilsSight":
                out["devils_sight"] = v      # sees through magical darkness too
            else:
                problems.append(f"{key}: can't read {k}={v!r}")
    return out


def _expertise_one(d: dict, problems: list) -> tuple[dict, list]:
    fixed, choices = [], []
    for k, v in d.items():
        if k == "anyProficientSkill":
            choices.append(pool("expertise", "proficient_skills", v, label="Expertise"))
        elif k == "anyProficient":
            choices.append(pool("expertise", "proficient_skills_tools", v, label="Expertise"))
        elif v is True and snake(k) in SKILLS:
            fixed.append(snake(k))
        else:
            problems.append(f"expertise: can't read {k}={v!r}")
    return ({"expertise": fixed} if fixed else {}), choices


def expertise(raw: list | None, problems: list) -> tuple[dict, list]:
    return alternatives(raw or [], _expertise_one, "Expertise", problems)


def _saves_one(d: dict, problems: list) -> tuple[dict, list]:
    fixed, choices = [], []
    for k, v in d.items():
        if k == "choose":
            choices.append(pool("saves", v.get("from", []), v.get("count", 1), label="Saving Throws"))
        elif k == "any":
            choices.append(pool("saves", list(ABILITIES), v, label="Saving Throws"))
        elif v is True and k in ABILITIES:
            fixed.append(k)
        else:
            problems.append(f"saves: can't read {k}={v!r}")
    return ({"saves": fixed} if fixed else {}), choices


def saves(raw: list | None, problems: list) -> tuple[dict, list]:
    return alternatives(raw or [], _saves_one, "Saving Throws", problems)


# Optional feature types: raw code -> (our type, the class whose list it is, if any).
OPTFEATURE_TYPES = {
    "EI": ("eldritch_invocation", None), "MV:B": ("maneuver", None), "MM": ("metamagic", None),
    "ED": ("elemental_discipline", None), "AI": ("artificer_infusion", None), "AS": ("arcane_shot", None),
    "RN": ("rune", None), "RP": ("renown_perk", None), "PB": ("pact_boon", None),
    "FS:F": ("fighting_style", "fighter"), "FS:R": ("fighting_style", "ranger"),
    "FS:P": ("fighting_style", "paladin"), "FS:B": ("fighting_style", "bard"),
}


def optional_feature_filter(codes: list, problems: list) -> dict:
    """["FS:F"] -> {"feature_type": ["fighting_style"], "class": ["fighter"]}."""
    types, classes = [], []
    for code in codes or []:
        if code not in OPTFEATURE_TYPES:
            problems.append(f"optional features: unknown feature type '{code}'")
            continue
        t, cls = OPTFEATURE_TYPES[code]
        if t not in types:
            types.append(t)
        if cls and cls not in classes:
            classes.append(cls)
    out = {"feature_type": types}
    if classes:
        out["class"] = classes
    return out


def optional_features(raw: list | None, problems: list) -> list:
    """optionalfeatureProgression: "learn 2 Maneuvers" -> a pick from the
    optional-features catalogue by feature type."""
    out = []
    for d in raw or []:
        prog = d.get("progression") or {}
        if set(prog) != {"*"}:
            problems.append(f"optional features: can't read progression {prog!r}")
            continue
        out.append(pool("optional_features", optional_feature_filter(d.get("featureType", []), problems),
                        prog["*"], label=d.get("name") or "Optional Features"))
    return out


FEAT_CATEGORIES = {
    "G": "general", "O": "origin", "EB": "epic_boon",
    "FS": "fighting_style", "FS:P": "fighting_style", "FS:R": "fighting_style",
    "D": "dragonmark", "DG": "dark_gift",
}


def feat_progression(raw: list | None, problems: list) -> list:
    """featProgression: "you gain an Origin feat" -> a pick of feats by category."""
    out = []
    for d in raw or []:
        prog = d.get("progression") or {}
        if set(prog) != {"*"}:
            problems.append(f"feat progression: can't read {prog!r}")
            continue
        cats = [FEAT_CATEGORIES.get(x) for x in d.get("category", [])]
        if None in cats:
            problems.append(f"feat progression: unknown category in {d.get('category')}")
        out.append(pool("feats", {"category": [x for x in cats if x]}, prog["*"], label=d.get("name") or "Feat"))
    return out


# ---------- equipment and money ----------

def cp_to_money(cp: int) -> dict:
    """Copper -> {"gp": …, "sp": …, "cp": …} without zeros. 1500 -> {"gp": 15}."""
    out = {"gp": cp // 100, "sp": cp % 100 // 10, "cp": cp % 10}
    return {k: v for k, v in out.items() if v}


def money_text(m: dict) -> str:
    return " ".join(f"{v} {k.upper()}" for k, v in m.items())


def _add_money(total: dict, cp: int) -> None:
    total["_cp"] = total.get("_cp", 0) + cp


def _items(lst: list, problems: list) -> tuple[dict, list, list]:
    """One list of raw items -> (grants, choices, labels for an option name)."""
    items, choices, money, labels = [], [], {}, []
    for x in lst:
        if isinstance(x, str):
            items.append({"item": ref_id(x)})
            labels.append(title(split_ref(x)["name"]))
            continue
        if not isinstance(x, dict):
            problems.append(f"equipment: can't read {x!r}")
            continue
        qty = x.get("quantity", 1)
        if "equipmentTypes" in x:
            # one item from any of these groups (2024 Monk: a musical instrument or artisan's tools)
            groups = [EQUIPMENT_GROUPS.get(t) for t in x["equipmentTypes"]]
            if None in groups:
                problems.append(f"equipment: unknown equipmentTypes {x['equipmentTypes']}")
                continue
            choices.append(pool("items", groups, qty, label=x.get("displayName") or " or ".join(
                title(g.replace("_", " ")) for g in groups)))
            labels.append(choices[-1]["label"])
        elif "equipmentType" in x:
            group = EQUIPMENT_GROUPS.get(x["equipmentType"])
            if not group:
                problems.append(f"equipment: unknown equipmentType '{x['equipmentType']}'")
                continue
            choices.append(pool("items", group, qty, label=x.get("displayName") or title(group.replace("_", " "))))
            labels.append(choices[-1]["label"])
        elif "item" in x or "special" in x:
            it = {"item": ref_id(x["item"])} if "item" in x else {"name": x["special"]}
            shown = x.get("displayName") or (split_ref(x["item"])["name"] if "item" in x else x["special"])
            labels.append((f"{qty} " if qty != 1 else "") + title(shown))
            if x.get("displayName"):
                it["name"] = x["displayName"]
            if qty != 1:
                it["qty"] = qty
            if x.get("containsValue"):
                it["contains"] = cp_to_money(x["containsValue"])
            if x.get("worthValue"):
                it["worth"] = cp_to_money(x["worthValue"])
            items.append(it)
        elif set(x) == {"value"}:
            _add_money(money, x["value"])
        else:
            problems.append(f"equipment: can't read {x!r}")
    g = {}
    if items:
        g["items"] = items
    if money:
        g["currency"] = cp_to_money(money["_cp"])
        labels.append(money_text(g["currency"]))
    return g, choices, labels


def equipment(raw: list | None, problems: list) -> tuple[dict, list]:
    """startingEquipment: each dict is a slot. `_` is fixed; letters
    (a/b/A/B…) are a pick-one."""
    grants, choices = {}, []
    for slot in raw or []:
        if "_" in slot:
            g, ch, _ = _items(slot["_"], problems)
            if "currency" in g and "currency" in grants:
                merged = {k: grants["currency"].get(k, 0) + g["currency"].get(k, 0) for k in ("gp", "sp", "cp")}
                g["currency"] = {k: v for k, v in merged.items() if v}
            add_grants(grants, g)
            choices += ch
        letters = sorted(k for k in slot if k != "_")
        if letters:
            options = []
            for k in letters:
                g, ch, labels = _items(slot[k], problems)
                options.append(option(k.lower(), ", ".join(labels) or "—", g, ch))
            choices.append(bundle("Starting Equipment", options))
    return grants, choices


# ---------- edition (for categories whose entries don't say) ----------

# The day the 2024 Player's Handbook came out. Books published on or after
# it are written for the 2024 rules.
EDITION_ONE_FROM = "2024-09-17"
EDITION_SOURCES = ("backgrounds", "races", "feats", "optionalfeatures", "spells")

_book_tables: dict = {}
_book_dates: dict | None = None


def book_editions(exclude: str | None = None) -> dict[str, set]:
    """{source: {editions}} from what's already cleaned (backgrounds, races
    with subraces, feats with options, optional features), leaving out the
    category being cleaned (its old output must not decide its new one)."""
    if exclude not in _book_tables:
        from ..data_files import CLEANED_PATH, read_list
        found: dict[str, set] = {}

        def add(e):
            if e.get("source") and e.get("edition"):
                found.setdefault(str(e["source"]).lower(), set()).add(e["edition"])

        for cat in EDITION_SOURCES:
            if cat == exclude:
                continue
            for e in read_list(CLEANED_PATH, cat):
                add(e)
                for child in (e.get("subraces") or []) + (e.get("options") or []):
                    add(child)
        _book_tables[exclude] = found
    return _book_tables[exclude]


def book_dates() -> dict[str, str]:
    """{source: "YYYY-MM-DD"} from 5etools' books.json and adventures.json
    (extracted/books.json)."""
    global _book_dates
    if _book_dates is None:
        from ..data_files import EXTRACTED_PATH, load_json
        path = EXTRACTED_PATH / "books.json"
        data = load_json(path) if path.is_file() else {}
        _book_dates = {}
        for lst in ("book", "adventure"):
            for b in data.get(lst, []) or []:
                src = b.get("source") or b.get("id")
                if src and b.get("published"):
                    _book_dates[str(src).lower()] = str(b["published"])[:10]
    return _book_dates


def edition_of(entry: dict, problems: list, category: str) -> str | None:
    """For entries without an `edition` key (spells, optional features).
    Only what the data says, in this order:
      1. the entry's own `edition` (or one from the `_book_editions` patch);
      2. the SRD / basic rules flags: srd52, basicRules2024 -> one;
         srd (5.1), basicRules -> classic;
      3. `reprintedAs`: a newer book reprinted it -> classic (except a UA
         playtest reprinted into a 2024 book: that playtested the new rules);
      4. a prerequisite naming a 2024 class (class source XPHB) -> one;
      5. its book, when everything already cleaned from that book is one edition;
      6. its book's publication date: on or after the 2024 Player's Handbook -> one.
    Still undecided: reported, and the entry is left out."""
    if entry.get("edition"):
        return entry["edition"]
    new = bool(entry.get("srd52") or entry.get("basicRules2024"))
    old = bool(entry.get("srd") or entry.get("basicRules"))
    if new != old:
        return "one" if new else "classic"
    source = str(entry.get("source", "")).lower()
    reprints = entry.get("reprintedAs") or []
    if reprints:
        targets = [split_ref(r if isinstance(r, str) else r.get("uid", ""))["source"] for r in reprints]
        into_2024 = any(book_editions(category).get(t) == {"one"} or t == "xphb" for t in targets)
        if not (into_2024 and source.startswith("ua")):
            return "classic"
    for p in entry.get("prerequisite") or []:
        lvl = p.get("level") if isinstance(p, dict) else None
        cls = lvl.get("class") if isinstance(lvl, dict) else None
        if isinstance(cls, dict) and str(cls.get("source", "")).upper() == "XPHB":
            return "one"
    eds = book_editions(category).get(source)
    if eds and len(eds) == 1:
        return next(iter(eds))
    date = book_dates().get(source)
    if date:
        return "one" if date >= EDITION_ONE_FROM else "classic"
    why = "has both editions in other categories" if eds else "has no edition anywhere in the cleaned data"
    problems.append(f"edition: can't tell (book {entry.get('source')} {why}, and no publication date); "
                    f"add it to _book_editions in patches/{category}.json")
    return None


# ---------- header ----------

def srd_name(entry: dict) -> str | None:
    """The SRD's own name for an entry, when it has one ("Bigby's Hand" is
    "Arcane Hand" in the SRD). 5.2 first."""
    for key in ("srd52", "srd"):
        if isinstance(entry.get(key), str) and entry[key].strip():
            return entry[key].strip()
    return None


def display_name(entry: dict) -> str | None:
    """Rule: the SRD name wins over the book name, in every category."""
    return srd_name(entry) or entry.get("name")


def header(entry: dict, kind: str, problems: list, read_prerequisite: bool = True) -> dict:
    """The shared top of every entry. The id always comes from the book
    name (that's what other entries use to point at it: "bigby's hand|xphb"),
    while `name` is the SRD name when there is one; the book name then
    becomes an alias, so searching for it still works."""
    name, source = entry.get("name"), entry.get("source")
    out = {"id": entry_id(name, source), "kind": kind, "name": display_name(entry), "source": source}

    edition = entry.get("edition") or "classic"
    if edition not in ("classic", "one"):
        problems.append(f"unknown edition '{edition}'")
    out["edition"] = edition

    srd = {}
    for key, ver in (("srd", "5.1"), ("srd52", "5.2")):
        v = entry.get(key)
        if v is True:
            srd[ver] = name
        elif isinstance(v, str):
            srd[ver] = v
    if srd:
        out["srd"] = srd

    reprints = []
    for r in entry.get("reprintedAs") or []:
        if isinstance(r, str):
            reprints.append(ref_id(r))
        elif isinstance(r, dict) and "uid" in r:
            reprints.append({"kind": r.get("tag", kind), "id": ref_id(r["uid"])})
    if reprints:
        out["reprinted_as"] = reprints

    aliases = list(entry.get("alias") or [])
    if out["name"] != name and name and name not in aliases:
        aliases.insert(0, name)
    if aliases:
        out["aliases"] = aliases
    tags = list(entry.get("traitTags") or []) + list(entry.get("creatureTypeTags") or [])
    if tags:
        out["tags"] = tags

    campaigns = []
    for p in (entry.get("prerequisite") or []) if read_prerequisite else []:
        for k, v in p.items():
            if k == "campaign":
                campaigns += v
            else:
                problems.append(f"prerequisite '{k}' not handled")
    if campaigns:
        out["campaigns"] = campaigns
    out["text"] = entry_text(entry, problems)
    return out


def entry_text(entry: dict, problems: list) -> str:
    """The entry's clean text, made by code (text_renderer.py): its text
    blocks minus Age, Alignment and Suggested Characteristics, plus a
    spell's higher-level block. The LLM step gets exactly this text."""
    from ..text_renderer import kept_entries, render
    return render(kept_entries(entry.get("entries")) + list(entry.get("entriesHigherLevel") or []), problems)


def unhandled(entry: dict, handled: set, dropped: set, problems: list) -> None:
    """Report raw keys no cleaner step looked at."""
    for k in entry:
        if k not in handled and k not in dropped and k != "_book":
            problems.append(f"key '{k}' not handled")
