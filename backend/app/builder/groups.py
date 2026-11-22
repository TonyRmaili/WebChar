"""What a named group in a pool choice holds ("all_skills", "gaming_sets",
"martial_weapons"…), so the randomizer can pick from it and the wizard
can list it.

The group names are the cleaners' (schemas/common_schema.GROUPS plus the
equipment groups). Members come from the catalogue where it has them
(tools, instruments, gaming sets, weapons, focuses are items), so
homebrew items join their group too. Skills and languages are fixed.

members(group, kind, cat, have) -> [values]
    kind   the pool's grant: "skills", "tools", "languages", "items",
           "weapons", "weapon_masteries", "expertise"…
    have   the grants the character has so far (for "proficient_…")
"""

import re

SKILLS = [
    "acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
    "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion",
    "sleight_of_hand", "stealth", "survival",
]
STANDARD_LANGUAGES = ["common", "common_sign_language", "draconic", "dwarvish", "elvish", "giant", "gnomish", "goblin", "halfling", "orc"]
RARE_LANGUAGES = ["abyssal", "celestial", "deep_speech", "infernal", "primordial", "sylvan", "undercommon", "aquan", "auran", "terran"]
OTHER_TOOLS = ["disguise_kit", "forgery_kit", "herbalism_kit", "navigators_tools", "poisoners_kit", "thieves_tools"]
VEHICLES = ["vehicles_land", "vehicles_water", "vehicles_air"]

# Item groups: which item_types (and focus type) belong.
ITEM_GROUPS = {
    "gaming_sets": ("gaming_set",),
    "musical_instruments": ("instrument",),
    "artisans_tools": ("artisans_tools",),
    "arcane_focuses": ("spellcasting_focus", "arcane"),
    "druidic_focuses": ("spellcasting_focus", "druidic"),
    "holy_symbols": ("spellcasting_focus", "holy"),
}
WEAPON_GROUPS = {
    "simple_weapons": ("simple", None), "martial_weapons": ("martial", None),
    "simple_melee_weapons": ("simple", "melee_weapon"), "martial_melee_weapons": ("martial", "melee_weapon"),
    "all_weapons": (None, None),
}


def snake(name):
    return re.sub(r"[^a-z0-9]+", "_", str(name).lower().replace("'", "")).strip("_")


def _mundane(item):
    return str(item.get("rarity") or "none").lower() in ("none", "mundane", "unknown")


def _items_of(cat, types, focus=None):
    out = []
    for it in cat.all("items"):
        if not _mundane(it) or not set(types) & set(it.get("item_types") or []):
            continue
        if focus and focus not in str(it.get("focus_type") or it.get("name") or "").lower():
            continue
        out.append(it)
    return out


def _weapons(cat, category=None, item_type=None):
    out = []
    for it in cat.all("items"):
        w = it.get("weapon") or {}
        if not w or not it.get("base") or not _mundane(it):
            continue
        if category and w.get("category") != category:
            continue
        if item_type and item_type not in (it.get("item_types") or []):
            continue
        out.append(it)
    return out


def _dedupe(values):
    return list(dict.fromkeys(values))


def tool_ids(cat, group):
    """Tool proficiencies are snake names ("thieves_tools", "lute")."""
    if group in ITEM_GROUPS:
        types, *focus = ITEM_GROUPS[group]
        return _dedupe(snake(i["name"]) for i in _items_of(cat, (types,), focus[0] if focus else None))
    if group == "vehicles":
        return list(VEHICLES)
    # all_tools
    return _dedupe(
        [snake(i["name"]) for g in ("artisans_tools", "gaming_sets", "musical_instruments") for i in _items_of(cat, ITEM_GROUPS[g][:1])]
        + OTHER_TOOLS + VEHICLES
    )


def members(group, kind, cat, have=None):
    have = have or {}
    if kind in ("skills", "expertise"):
        if group in ("proficient_skills", "proficient_skills_tools"):
            return list(have.get("skills") or []) + (list(have.get("tools") or []) if group.endswith("tools") else [])
        return list(SKILLS)
    if kind == "languages":
        if group == "standard_languages":
            return list(STANDARD_LANGUAGES)
        if group == "rare_languages":
            return list(RARE_LANGUAGES)
        return STANDARD_LANGUAGES + RARE_LANGUAGES
    if kind == "tools":
        return tool_ids(cat, group)
    if kind == "weapons":  # a proficiency: the group itself or one weapon
        cat_name, typ = WEAPON_GROUPS.get(group, (None, None))
        return _dedupe(snake(i["name"]) for i in _weapons(cat, cat_name, typ))
    if kind == "weapon_masteries":
        # proficient_weapons: every weapon the character can use that has a mastery
        prof = set(have.get("weapons") or [])
        out = []
        for it in _weapons(cat):
            w = it["weapon"]
            if not w.get("mastery"):
                continue
            if f"{w.get('category')}_weapons" in prof or snake(it["name"]) in prof or group != "proficient_weapons":
                out.append(snake(it["name"]))
        return _dedupe(out)
    if kind == "items":
        if group in ITEM_GROUPS:
            types, *focus = ITEM_GROUPS[group]
            return [i["id"] for i in _items_of(cat, (types,), focus[0] if focus else None)]
        if group in WEAPON_GROUPS:
            return [i["id"] for i in _weapons(cat, *WEAPON_GROUPS[group])]
    return []
