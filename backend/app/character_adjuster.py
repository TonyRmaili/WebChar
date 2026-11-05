import itertools
import os
import random
import re
import time

# Works whether the app imports this as part of the `app` package or you run
# the file straight from a terminal. If you'd rather not have the try/except,
# run it as a module from the project root instead:
#     python -m app.character_adjuster
# and keep only the first line.
try:
    from app.file_handler import FileHandler
except ImportError:
    from file_handler import FileHandler


# ── paths ───────────────────────────────────────────────────────────
# Anchored to THIS FILE's folder, not the current working directory, so
# they resolve the same from uvicorn, from a terminal, or from anywhere
# else. os.path.abspath(__file__) is this module's full path and dirname
# strips the filename off, leaving the folder it lives in.
APP_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(APP_DIR, "output")
# Test in/out files, which sit one level above the app folder.
TEST_DIR = os.path.join(APP_DIR, "..")

BG_DATA_PATH = os.path.join(OUTPUT_DIR, "backgrounds", "backgrounds")
RACES_DATA_PATH = os.path.join(OUTPUT_DIR, "races", "all_races_final")
# One file per class, keyed by edition: {"one": {...}, "classic": {...}}
CLASSES_DATA_PATH = os.path.join(OUTPUT_DIR, "classes")
FEATS_DATA_PATH = os.path.join(OUTPUT_DIR, "feats", "feats")
SPELLS_DATA_PATH = os.path.join(OUTPUT_DIR, "spells", "spells")


ABILITIES = ["str", "dex", "con", "int", "wis", "cha"]

# The four lists `defenses` can carry. Measured across all 157 races.
DEFENSE_KEYS = ("resistances", "immunities", "vulnerabilities", "condition_advantages")


# ── class / randomizer constants ────────────────────────────────────
MAX_CHARACTER_LEVEL = 20

# Edition used for anything the randomizer invents.
RANDOM_EDITION = "one"

# Chance of adding ANOTHER new class on top of the ones already rolled.
# The roll repeats, so the odds compound downward — measured over 200k
# runs: 1 class 59.9%, 2 at 24.1%, 3 at 9.6%, 4 at 3.8%.
EXTRA_CLASS_CHANCE = 0.4

# Chance of leaving a hand-picked build completely alone when the player
# left the total level on "random". Only applies if they picked classes.
KEEP_AS_IS_CHANCE = 0.25

# Epic Boons need One D&D and a single class's OWN level at 19+.
EPIC_BOON_LEVEL = 19

# ── ability scores ──────────────────────────────────────────────────
ABILITY_SCORE_CAP = 20

# The classic array, handed out highest-first to the highest priority.
STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

# Point buy: every score starts at 8 and costs climb past 13.
POINT_BUY_BUDGET = 27
POINT_BUY_COST = {8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9}
POINT_BUY_MIN = 8
POINT_BUY_MAX = 15


# The only feat category legal in an ASI slot. Epic Boons join the pool
# once a class's own level reaches 19; origin feats come from backgrounds
# and fighting_style from class features, so neither belongs here.
ASI_FEAT_CATEGORY = "general"

# Feat proficiency blocks, and which final_build list each one feeds.
FEAT_PROFICIENCY_BLOCKS = (
    ("skillProficiencies", "skill_proficiencies"),
    ("toolProficiencies", "tool_proficiencies"),
    ("languageProficiencies", "language_proficiencies"),
    ("armorProficiencies", "armor_proficiencies"),
    ("weaponProficiencies", "weapon_proficiencies"),
    ("expertise", "skill_expertise"),
    ("savingThrowProficiencies", "saving_throw_proficiencies"),
)

# clean_entries.effects groups its action rows under these keys; the value
# is the action_type Effects.jsx expects.
ACTION_CATEGORIES = {
    "actions": "action",
    "bonus_actions": "bonus_action",
    "reactions": "reaction",
    "passives": "passive",
}

# How a spell may be cast, keyed by the use type found in race, class
# and feat data. Matches the three modes on the spell card:
#   at_will  always prepared, costs no spell slot
#   innate   always prepared, uses a slot unless `uses` limits it
#   normal   on the list, prepared by the player
SPELL_USE_MODES = {
    "at_will": "at_will",
    "will": "at_will",
    "per_long_rest": "innate",
    "per_short_rest": "innate",
    "daily": "innate",
    "rest": "innate",
    "free_cast": "innate",
    "prepared": "innate",
    "granted": "innate",
    "resource": "innate",
    "ritual": "normal",
    "known": "normal",
    "expanded": "normal",
    "class_list_addition": "normal",
}

PREFERRED_SPELL_SOURCE = "xphb"

# Use types that come with a limited number of casts, and when the casts
# come back. free_cast is decided from its own `recharge` value.
LIMITED_USE_RESET = {
    "per_long_rest": "long",
    "daily": "long",
    "per_short_rest": "short",
    "rest": "short",
}

# A feat-or-ability-score choice appears wherever level_progression names
# an "Ability Score Improvement" feature — the signal the rules use.
ASI_RE = re.compile(r"ability score improvement", re.I)

# ONLY used for a genuine multiclass. A single spellcasting class reads
# its slots from its own level_progression[].spell_slots, so nothing is
# hardcoded in the common case.
SPELLSLOT_PROGRESSION = [
    [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
    [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
    [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1],
    [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 2, 1, 1],
]


# ── equipment constants ─────────────────────────────────────────────
# A group under this key is always granted. Anything else is one branch
# of a pick-one choice. Mirrors EQUIPMENT_GRANTED_KEY in Constants.js.
GRANTED_KEY = "_"

# Placeholders standing in for "an item of this category", usually the one
# picked elsewhere in the same background. Mirrors EQUIPMENT_TYPE_LABELS.
EQUIPMENT_TYPE_LABELS = {
    "toolArtisan": "Artisan's Tools (as chosen)",
    "weaponMartial": "Martial Weapon (your choice)",
    "weaponSimple": "Simple Weapon (your choice)",
    "weaponMartialMelee": "Martial Melee Weapon (your choice)",
    "weaponSimpleMelee": "Simple Melee Weapon (your choice)",
    "instrumentMusical": "Musical Instrument (your choice)",
    "setGaming": "Gaming Set (your choice)",
    # Class kits only — these do not appear in background equipment.
    "focusSpellcastingArcane": "Arcane Focus (your choice)",
    "focusSpellcastingDruidic": "Druidic Focus (your choice)",
    "focusSpellcastingHoly": "Holy Symbol (your choice)",
}

# Weapon proficiency granted by category rather than by named item.
WEAPON_CATEGORIES = {"simple", "martial"}


# ── ported from utils/Constants.js ──────────────────────────────────
# The canonical pools. Kept in the same order and spelling as the
# frontend so a value normalized here matches one normalized there.

DEFAULT_ABILITY_SCORES = {
    "str": {"label": "Strength"},
    "dex": {"label": "Dexterity"},
    "con": {"label": "Constitution"},
    "int": {"label": "Intelligence"},
    "wis": {"label": "Wisdom"},
    "cha": {"label": "Charisma"},
}

# camelCase keys, matching DEFAULT_SKILLS in Constants.js.
DEFAULT_SKILLS = {
    "acrobatics": ("Acrobatics", "Dexterity"),
    "animalHandling": ("Animal Handling", "Wisdom"),
    "arcana": ("Arcana", "Intelligence"),
    "athletics": ("Athletics", "Strength"),
    "deception": ("Deception", "Charisma"),
    "history": ("History", "Intelligence"),
    "insight": ("Insight", "Wisdom"),
    "intimidation": ("Intimidation", "Charisma"),
    "investigation": ("Investigation", "Intelligence"),
    "medicine": ("Medicine", "Wisdom"),
    "nature": ("Nature", "Intelligence"),
    "perception": ("Perception", "Wisdom"),
    "performance": ("Performance", "Charisma"),
    "persuasion": ("Persuasion", "Charisma"),
    "religion": ("Religion", "Intelligence"),
    "sleightOfHand": ("Sleight of Hand", "Dexterity"),
    "stealth": ("Stealth", "Dexterity"),
    "survival": ("Survival", "Wisdom"),
}
ALL_SKILL_KEYS = list(DEFAULT_SKILLS)

ARTISAN_TOOLS = [
    "alchemist's supplies", "brewer's supplies", "calligrapher's supplies",
    "carpenter's tools", "cartographer's tools", "cobbler's tools",
    "cook's utensils", "glassblower's tools", "jeweler's tools",
    "leatherworker's tools", "mason's tools", "painter's supplies",
    "potter's tools", "smith's tools", "tinker's tools", "weaver's tools",
    "woodcarver's tools",
]
OTHER_TOOLS = [
    "disguise kit", "forgery kit", "herbalism kit", "navigator's tools",
    "poisoner's kit", "thieves' tools",
]
MUSICAL_INSTRUMENTS = [
    "bagpipes", "drum", "dulcimer", "flute", "horn", "lute", "lyre",
    "pan flute", "shawm", "viol",
]
GAMING_SETS = [
    "dice set", "dragonchess set", "playing card set", "three-dragon ante set",
]
VEHICLE_TOOLS = ["vehicles (land)", "vehicles (water)", "vehicles (air)"]

TOOL_OPTIONS = (
    ARTISAN_TOOLS + OTHER_TOOLS + MUSICAL_INSTRUMENTS + GAMING_SETS + VEHICLE_TOOLS
)

STANDARD_LANGUAGES = [
    "Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin",
    "Halfling", "Orc",
]
EXOTIC_LANGUAGES = [
    "Abyssal", "Celestial", "Deep Speech", "Draconic", "Infernal",
    "Primordial", "Sylvan", "Undercommon",
]
PC_LANGUAGE_OPTIONS = STANDARD_LANGUAGES + EXOTIC_LANGUAGES

WEAPON_OPTIONS = [
    "club", "dagger", "greatclub", "handaxe", "javelin", "light hammer",
    "mace", "quarterstaff", "sickle", "spear",
    "light crossbow", "dart", "shortbow", "sling",
    "battleaxe", "flail", "glaive", "greataxe", "greatsword", "halberd",
    "lance", "longsword", "maul", "morningstar", "pike", "rapier",
    "scimitar", "shortsword", "trident", "war pick", "warhammer", "whip",
    "blowgun", "hand crossbow", "heavy crossbow", "longbow", "musket",
    "pistol", "net",
]
ARMOR_OPTIONS = [
    "padded", "leather", "studded leather",
    "hide", "chain shirt", "scale mail", "breastplate", "half plate",
    "ring mail", "chain mail", "splint", "plate",
    "shield",
]

# Minimum XP to be at each level; index is the level, 0 unused.
XP_BY_LEVEL = [
    0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000,
    305000, 355000,
]

# Category token -> the pool it stands for. Both the data's own spellings
# and the camelCase forms that appear in toolProficiencies are included.
TOOL_CATEGORY_TOKENS = {
    "artisan's tools": ARTISAN_TOOLS,
    "artisans tools": ARTISAN_TOOLS,
    "artisan tools": ARTISAN_TOOLS,
    "toolartisan": ARTISAN_TOOLS,
    "any_artisan_tool": ARTISAN_TOOLS,
    "any_artisans_tool": ARTISAN_TOOLS,
    "gaming set": GAMING_SETS,
    "gaming sets": GAMING_SETS,
    "any_gaming_set": GAMING_SETS,
    "musical instrument": MUSICAL_INSTRUMENTS,
    "musical instruments": MUSICAL_INSTRUMENTS,
    "any_musical_instrument": MUSICAL_INSTRUMENTS,
    "instrumentmusical": MUSICAL_INSTRUMENTS,
    "vehicle": VEHICLE_TOOLS,
    "vehicles": VEHICLE_TOOLS,
    "any_vehicle": VEHICLE_TOOLS,
}

LANGUAGE_CATEGORY_TOKENS = {
    "standard": STANDARD_LANGUAGES,
    "any_standard": STANDARD_LANGUAGES,
    "exotic": EXOTIC_LANGUAGES,
    "any_exotic": EXOTIC_LANGUAGES,
    "any": PC_LANGUAGE_OPTIONS,
    "other": PC_LANGUAGE_OPTIONS,
    "any_language": PC_LANGUAGE_OPTIONS,
}

# The whole family, for a bare "any" / "other" declared under it.
WHOLE_FAMILY = {
    "skills": lambda: list(ALL_SKILL_KEYS),
    "tools": lambda: list(TOOL_OPTIONS),
    "languages": lambda: list(PC_LANGUAGE_OPTIONS),
    "weapons": lambda: list(WEAPON_OPTIONS),
    "armor": lambda: list(ARMOR_OPTIONS),
}

# toolProficiencies spells its categories in camelCase, squashed to
# letters here so punctuation and casing stop mattering.
CAMEL_TOOL_CATEGORIES = {
    "anyartisanstool": "any_artisan_tool",
    "anyartisanstools": "any_artisan_tool",
    "anymusicalinstrument": "any_musical_instrument",
    "anygamingset": "any_gaming_set",
    "anytool": "any_tool",
}

# final_build key -> the family used in the frontend's choice ids, so
# "skill_proficiencies" lines up with the id "bg.prof.skills".
PROFICIENCY_FAMILY = {
    "skill_proficiencies": "skills",
    "tool_proficiencies": "tools",
    "language_proficiencies": "languages",
    "weapon_proficiencies": "weapons",
    "armor_proficiencies": "armor",
}


# ── string helpers ──────────────────────────────────────────────────
# Ported from wizardHelpers.js so backend labels come out identical to
# the ones the frontend produced.

def strip_source(token):
    """"dagger|xphb" -> "dagger"; "holy symbol|phb" -> "holy symbol"."""
    return str(token or "").split("|")[0].strip()


def title_case(value):
    """
    "holy symbol" -> "Holy Symbol".

    Splits on underscores and whitespace and uppercases the first letter
    of each word, leaving the rest alone — so "Book (Prayers)" survives
    unchanged. Deliberately NOT str.capitalize(), which would lowercase
    everything after the first letter.
    """
    parts = [part for part in re.split(r"[_\s]+", str(value or "")) if part]
    return " ".join(part[0].upper() + part[1:] for part in parts)


def as_list(value):
    """
    Force a value that is sometimes a list and sometimes a bare string
    into a list.

    `choose.options` does exactly this: 16 of the language choices store
    the string "any_standard" rather than ["any_standard"], and the same
    happens for skills ("any") and tools ("any_tool"). Iterating the
    string directly would loop over its CHARACTERS, which silently
    produces nonsense instead of crashing.
    """
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return value
    return [value]


def squash(text):
    """"Sleight of Hand" -> "sleightofhand", for case-blind matching."""
    return re.sub(r"[^a-z0-9]", "", str(text or "").lower())


def _by_squash(pool):
    return {squash(item): item for item in pool}


_SKILL_BY_SQUASH = _by_squash(ALL_SKILL_KEYS)
_TOOL_BY_SQUASH = _by_squash(TOOL_OPTIONS)
_LANG_BY_SQUASH = _by_squash(PC_LANGUAGE_OPTIONS)
_WEAPON_BY_SQUASH = _by_squash(WEAPON_OPTIONS)
_ARMOR_BY_SQUASH = _by_squash(ARMOR_OPTIONS)


def norm_value(value, family):
    """
    The canonical spelling of a proficiency.

    The sources disagree: race data says "sleight of hand", the skill
    tables key it "sleightOfHand", and languages are lowercase in the
    data but Title Case in the options list. Without one canonical form
    "common" and "Common" look like two different languages and the
    dedupe in grant() silently keeps both.

    An unrecognised value (a monster-only language like "auran") falls
    back to lowercase rather than being dropped.
    """
    if value is None:
        return None

    bare = strip_source(value)
    key = squash(bare)

    table = {
        "skills": _SKILL_BY_SQUASH,
        "tools": _TOOL_BY_SQUASH,
        "languages": _LANG_BY_SQUASH,
        "weapons": _WEAPON_BY_SQUASH,
        "armor": _ARMOR_BY_SQUASH,
    }.get(family)

    if table and key in table:
        return table[key]

    return bare.lower()


def ability_mod(score):
    """D&D's modifier: floor((score - 10) / 2). None stays None."""
    if score is None:
        return None
    return (to_int(score, 10) - 10) // 2


def die_faces(die):
    """"d10" -> 10, anything unrecognised -> 0."""
    match = re.match(r"^d(\d+)$", str(die or "").strip().lower())
    return int(match.group(1)) if match else 0


def to_int(value, default=0):
    """
    Numbers that are not always numbers.

    `extras.rages`, `extras.second_wind` and `extras.weapon_mastery` are
    STRINGS ("3"), while `extras.magic_items` and `extras.plans_known`
    use the em dash "—" to mean none. Nothing is trusted to already be an
    int.
    """
    if value is None or isinstance(value, bool):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def snake(text):
    """"Second Wind" -> "second_wind"."""
    return re.sub(r"[^a-z0-9]+", "_", str(text or "").lower()).strip("_")


def resolve_extras_key(name, extras):
    """
    Match a resource name to its column in that class's level_progression
    extras — "Focus Point" to `focus_points`, "Rage" to `rages`.

    Matched against the keys ACTUALLY PRESENT on that class's row rather
    than a hardcoded table: a class only carries two or three of these, so
    the candidate set is tiny and a wrong match is near-impossible. It
    also survives the data gaining new columns.

    Returns None when nothing matches, which is correct for resources that
    have no per-level column (Action Surge, Arcane Recovery).
    """
    if not extras:
        return None

    keys = set(extras)
    base = snake(name)

    def variants(word):
        yield word
        yield word + "s"
        if word.endswith("s"):
            yield word[:-1]

    for candidate in variants(base):
        if candidate in keys:
            return candidate

    # "Eldritch Invocations" is stored as just `invocations`.
    for candidate in variants(base.rsplit("_", 1)[-1]):
        if candidate in keys:
            return candidate

    return None


def gp_from_cp(copper):
    """
    Equipment data stores money in COPPER: {"value": 800} is 8 GP and
    {"value": 5000} is 50 GP, which is what the Acolyte notes text says.
    """
    try:
        number = float(copper)
    except (TypeError, ValueError):
        return None
    gold = number / 100
    return int(gold) if gold.is_integer() else round(gold, 2)


def format_gp(copper):
    gold = gp_from_cp(copper)
    return "" if gold is None else f"{gold} GP"


def split_feat_token(raw):
    """
    "magic initiate; cleric" -> ("magic initiate", "cleric").

    The part after the semicolon names a variant — which spell list,
    which giant type — and matches an entry in the feat's own `versions`.
    """
    text = str(raw or "").strip()
    if ";" not in text:
        return text, None
    base, _, subtype = text.partition(";")
    return base.strip(), (subtype.strip() or None)


def is_one_edition_feat(feat):
    """
    Feats carry no `edition` key, but `category` was only added for the
    2024 rules, so its presence is the edition marker. 157 of the 265
    feats have one; the rest are classic.
    """
    return bool((feat or {}).get("category"))


def parse_spell_ref(raw):
    """
    A spell reference from additionalSpells.

      "dimension door|xphb"     -> name + source
      "minor illusion|xphb#c"   -> same, and the #c marks it a cantrip

    Returns None for anything empty so callers can filter.
    """
    text = str(raw or "").strip()
    if not text:
        return None

    parts = text.split("|")
    name = parts[0].strip()
    source = parts[1].strip() if len(parts) > 1 else None
    cantrip = False

    if source and "#" in source:
        source, _, flag = source.partition("#")
        cantrip = flag.strip().lower() == "c"

    if not name:
        return None

    return {"name": name, "source": source or None, "is_cantrip": cantrip}


def parse_tag_id(raw):
    """
    "{@item club|phb|clubs}" -> "club".

    The identity is the FIRST segment, not the last. The last is the
    plural display form ("clubs"), which would never match an item.
    """
    match = re.search(r"\{@\w+\s([^}]+)\}", str(raw or ""))
    if not match:
        return strip_source(raw).lower()
    return (match.group(1).split("|")[0] or "").strip().lower()


def parse_filter_tag(raw):
    """
    Pull the filter out of an embedded @filter tag.

      "Martial weapons that have the {@filter Light|items|
       type=martial weapon|property=light} property"
        -> "type=martial weapon|property=light"

    The first two segments are the display label and the catalogue name;
    everything after is the filter itself — the same syntax that
    weaponProficiencies[].all.fromFilter uses, so both paths can be
    treated identically.
    """
    match = re.search(r"\{@filter\s([^}]+)\}", str(raw or ""))
    if not match:
        return None
    segments = [segment.strip() for segment in match.group(1).split("|")]
    return "|".join(segments[2:]) or None


def clean_dice(raw):
    """"{@dice 5d4 × 10|5d4 × 10|Starting Gold}" -> "5d4 × 10 gp"."""
    match = re.search(r"\{@dice\s([^|}]+)", str(raw or ""))
    text = (match.group(1) if match else str(raw or "")).strip()
    return f"{text} gp"


def roll_gold(raw, rng=random):
    """
    Roll a goldAlternative expression into an actual amount of gold.

    "5d4 × 10" rolls five d4 and multiplies by ten. Returns None when the
    expression doesn't parse, so the caller can leave it unresolved
    rather than inventing a number.
    """
    match = re.search(r"\{@dice\s([^|}]+)", str(raw or ""))
    text = (match.group(1) if match else str(raw or "")).strip()

    dice = re.match(r"(\d+)\s*d\s*(\d+)", text)
    if not dice:
        return None

    count, faces = int(dice.group(1)), int(dice.group(2))
    total = sum(rng.randint(1, faces) for _ in range(count))

    multiplier = re.search(r"[×x*]\s*(\d+)", text)
    if multiplier:
        total *= int(multiplier.group(1))

    return total


def quantity_suffix(element):
    """Quantity rides in the NAME ("Parchment ×10"), as the frontend does."""
    quantity = element.get("quantity")
    return f" ×{quantity}" if quantity and quantity > 1 else ""


def make_id_generator():
    """Matches the Effects.jsx idGen format: "mia3liyy-2llt26"."""
    def next_id():
        stamp = format(int(time.time() * 1000), "x")
        tail = "".join(random.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(6))
        return f"{stamp}-{tail}"
    return next_id


def make_row_id_generator():
    """Matches the GeneralStats / Inventory row format: "1762548829117_bzgrxy"."""
    def next_row_id():
        tail = "".join(random.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(6))
        return f"{int(time.time() * 1000)}_{tail}"
    return next_row_id


def read_subrace(value):
    """
    The creation payload sends a subrace as {name, source}, or null when
    there is none. A bare name is still accepted. The source is needed
    because two subraces can share a name (Elf/PHB's two Eladrin entries).
    """
    if isinstance(value, dict):
        return value.get("name") or None, value.get("source") or None
    return (value or None), None


def trait_copies(traits):
    """
    Race and subrace traits, copied onto the character as editable
    {name, notes} rows. The effects are still built from the original
    data by add_trait_effects.
    """
    copies = []
    for trait in traits or []:
        if isinstance(trait, dict) and trait.get("name"):
            copies.append({"name": trait["name"], "notes": trait.get("notes") or ""})
    return copies


class CharacterAdjuster:
    def __init__(self, payload, user_name, char_name, save_path):

        # paths
        self.save_path = os.path.join(save_path, user_name, "characters", char_name)

        self.bg_data_path = BG_DATA_PATH
        self.races_data_path = RACES_DATA_PATH
        self.classes_data_path = CLASSES_DATA_PATH
        self.feats_data_path = FEATS_DATA_PATH
        self.spells_data_path = SPELLS_DATA_PATH

        # data extract
        self.payload = payload

        # Everything the player chose lives under selections, and nothing
        # derived is sent at all — see claude/payload-contract.md.
        selections = self.payload.get("selections") or {}
        self.selections = selections
        self.sel_race = selections.get("race")
        self.sel_background = selections.get("background")
        self.sel_classes = selections.get("classes") or []
        # { "bg.equipment.0": ["A"], "bg.asi": {"mode": ..., "picks": [...]} }
        self.choices = selections.get("choices") or {}

        self.randomize = self.payload.get("random", False)

        # imports
        self.filehandler = FileHandler()
        self.next_id = make_id_generator()
        self.next_row_id = make_row_id_generator()

        # Each class file is read at most once.
        self._class_cache = {}
        self._feats_cache = None

        self._spells_index = None

        # Feats already on the character, by squashed name, so a feat is
        # not handed out twice unless it is marked repeatable.
        self._taken_feats = set()

        # final build
        self.final_build = {
            "name": char_name,
            "race": {},
            "background": {},

            # The page's own profile block, empty until the player fills
            # it in. Shape matches Biography.jsx.
            "character_profile": {
                "alignment": {"prefix": "", "suffix": ""},
                "appearance": "",
                "height": 0,
                "age": 0,
                "weight": 0,
                "personality_traits": "",
                "ideals": "",
                "bonds": "",
                "flaws": "",
                "backstory": "",
            },

            "classes": [],
            "total_level": 0,
            "caster_level": 0,
            "feats": [],

            # Racial and background bonuses accumulate here rather than
            # being applied to scores, since ability scores are settled
            # after race and class have both had their say.
            "ability_bonuses": {},

            "skill_proficiencies": [],
            "skill_expertise": [],
            "tool_proficiencies": [],
            "language_proficiencies": [],
            "weapon_proficiencies": [],
            "armor_proficiencies": [],
            "saving_throw_proficiencies": [],

            # The player's own numbers, with any blanks filled in. Kept
            # apart from ability_scores so the bonuses stay unpickable.
            "base_scores": {},

            # Ability choices parked until every source has been read —
            # see defer_ability_choice.
            "pending_ability_choices": [],

            # Feat bonuses are kept apart from the racial, background and
            # class ones so each feat's contribution stays visible.
            # finalize() merges them when computing the scores.
            "feat_ability_bonuses": {},

            # Features that raise an ability's ceiling past 20 (barbarian's
            # capstone sets 25, epic boons set 30).
            "ability_max_override": {},

            # Limited-use class features in one uniform shape, so the page
            # can be built against a single list later. `max` is null when
            # it depends on ability scores, with the formula in scales_with.
            "resources": [],

            # Spell slots come from each class's own progression table;
            # pact slots are tracked separately and never mix in.
            # Individual spells from every source, keeping
            # level_available so they can be filtered once the character
            # level is known.
            "spellbook": {
                "spellslots": [],
                "pactslots": [],
                "spells": [],
                "metamagic": [],
                "invocations": [],
                "sorcery_points": {"max_charges": 0, "current_charges": 0, "reset_amount": 0},
                "max_prepared_spells": 0,
                "cantrips_known": 0,
            },

            "speed": {},
            "senses": {},
            "defenses": {key: [] for key in DEFENSE_KEYS},

            # One row per race trait, shaped like Effects.jsx expects.
            "effects": [],

            # "every Wizard spell of level 3 or lower is added to your
            # list" — a rule over the spell catalogue rather than a set
            # of named spells, so it is kept separately.
            "spell_list_rules": [],

            # Same shape Inventory.jsx reads, so it saves with no further
            # transform. Money is kept in GP here; the copper in the data
            # is converted on the way in.
            "inventory": {
                "magic": [],
                "mundane": [],
                "currency": {"gp": 0, "sp": 0, "cp": 0, "ep": 0, "pp": 0},
                "max_attunment": 3,
            },

            "unresolved": []
        }


# -------- HELPERS ----------------------
    def resolved_choice(self, choice_id):
        """
        What the player picked for this choice, or None if it is still open.

        This is the whole reason `pending.unresolved` no longer travels: a
        missing key here IS "unresolved", read straight from the raw
        selections instead of from a second list that could drift.
        """
        value = self.choices.get(choice_id)
        if not value:
            return None
        return value

    def add_unresolved(self, key, choice_id, **extra):
        """
        Record something the build could not settle.

        None values are dropped: a missing key and an explicit null say
        the same thing, and callers pass `reason=None` when there is
        nothing to explain.
        """
        entry = {"id": choice_id}
        entry.update({k: v for k, v in extra.items() if v is not None})
        self.final_build["unresolved"].append({key: entry})

    def grant(self, key, values):
        """
        Add proficiencies to a family list, normalized and deduped.

        Normalizing matters: without it the race's "sleight of hand" and
        a class's "sleightOfHand" become two entries, and so do "common"
        and "Common".
        """
        family = PROFICIENCY_FAMILY.get(key)
        for value in values:
            normalized = norm_value(value, family) if family else value
            if normalized and normalized not in self.final_build[key]:
                self.final_build[key].append(normalized)

    def expand_token(self, token, family):
        """
        Expand a category token into the concrete options it stands for,
        or None when the token is already concrete.

        Cross-family tokens win over the group they were declared under:
        "any_tool" inside a skills block really does mean tools, which is
        how "four skills or tools" gets expressed.
        """
        text = str(token or "").lower().strip()

        if text == "any_skill":
            return list(ALL_SKILL_KEYS)
        if text == "any_tool":
            return list(TOOL_OPTIONS)
        if text == "any_weapon":
            return list(WEAPON_OPTIONS)
        if text == "any_armor":
            return list(ARMOR_OPTIONS)

        if family == "tools":
            pool = TOOL_CATEGORY_TOKENS.get(text) or TOOL_CATEGORY_TOKENS.get(squash(text))
            if pool:
                return list(pool)

        if family == "languages":
            pool = LANGUAGE_CATEGORY_TOKENS.get(text)
            if pool:
                return list(pool)

        if text in ("any", "all", "other"):
            builder = WHOLE_FAMILY.get(family)
            return builder() if builder else None

        return None

    def expand_options(self, raw_options, family):
        """Flatten an option list, expanding any category tokens in it."""
        out = []
        seen = set()

        for token in as_list(raw_options):
            if not isinstance(token, str):
                continue
            for option in self.expand_token(token, family) or [token]:
                normalized = norm_value(option, family)
                if normalized and normalized not in seen:
                    seen.add(normalized)
                    out.append(option)

        return out

    def resolve_proficiency_choice(self, key, choice_id, raw_options, count,
                                   owner=None, **extra):
        """
        Settle one proficiency choice: the player's pick if they made
        one, a roll from the expanded pool when the randomizer is on, and
        otherwise an unresolved entry carrying the real options.
        """
        picked = self.resolved_choice(choice_id)
        if picked:
            self.grant(key, as_list(picked))
            return

        family = PROFICIENCY_FAMILY.get(key)
        options = self.expand_options(raw_options, family)

        if not self.randomize:
            self.add_unresolved(key, choice_id, owner=owner, count=count,
                                options=options, **extra)
            return

        held = set(self.final_build[key])
        pool = [o for o in options if norm_value(o, family) not in held]

        if len(pool) < count:
            self.add_unresolved(key, choice_id, owner=owner, count=count,
                                options=options,
                                reason="not enough options left to choose from",
                                **extra)
            return

        self.grant(key, random.sample(pool, count))

    def extract_proficiencies(self, data, key, scope="bg"):
        """
        Pull proficiencies out of one family block.

        Three shapes appear in the data, and a block can carry more than
        one of them at once:

            fixed       ["perception"]                  granted outright
            categories  ["light"] / ["martial"]         a whole category,
                                                        armor and weapons only
            choose      {options, count}                the player picks

        A `choose` is taken from the player's pick when they made one,
        rolled when the randomizer is on, and otherwise left unresolved.

        `scope` is the prefix of the frontend's choice id — "bg" for a
        background, "race" or "race.sub" for a race.
        """
        if not isinstance(data, dict):
            return

        family = PROFICIENCY_FAMILY.get(key, key)

        for index, token in enumerate(as_list(data.get("fixed"))):
            if not isinstance(token, str):
                continue
            # A category sitting in a GRANTED slot is really a pick the
            # player still owes — Carouser lists "gaming set" as fixed
            # when its own text says "choose one kind of Gaming Set".
            # choiceEngine promotes these to `.inferred.<i>` choices, so
            # the ids have to match or the player's pick won't apply.
            if self.expand_token(token, family):
                self.resolve_proficiency_choice(
                    key, f"{scope}.prof.{family}.inferred.{index}",
                    [token], 1, inferred_from=token,
                )
            else:
                self.grant(key, [token])

        # Only armor and weapons use this, and armor uses it exclusively —
        # it never carries `fixed` at all.
        self.grant(key, as_list(data.get("categories")))

        choose = data.get("choose")
        if not isinstance(choose, dict):
            return

        # Backgrounds spell the option list as `from`, races as `options`,
        # and either can be a bare string instead of a list.
        raw_options = choose.get("from")
        if raw_options is None:
            raw_options = choose.get("options")

        self.resolve_proficiency_choice(
            key,
            f"{scope}.prof.{PROFICIENCY_FAMILY.get(key, key)}",
            raw_options,
            to_int(choose.get("count"), 1),
        )


    def make_effect(self, name, trait, notes=""):
        """
        A blank effect row, matching createDefaultAction() in Effects.jsx.

        Race traits carry only `name` and `notes` — there is no
        action_type, attack, save or charge data anywhere in the race
        files — so every racial effect starts passive with charges off.
        Nothing is invented to fill those in.
        """
        return {
            "id": self.next_id(),
            "name": name,
            "action_type": "passive",
            "kind": "none",
            "trait": trait,
            "active": True,
            "attack": {"attack_type": "", "hit_bonus": None, "range_ft": None},
            "save": {"target": "", "ability": "", "dc_bonus": None},
            "damages": [],
            "notes": notes,
            "charges": {"has": False, "max_charges": "", "reset_amount": 0, "current_charges": ""},
            "linked_effect_ids": [],
        }

    def add_trait_effects(self, traits, trait="race"):
        existing = {effect["name"] for effect in self.final_build["effects"]}

        for entry in traits or []:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name")
            if not name or name in existing:
                continue
            existing.add(name)
            self.final_build["effects"].append(
                self.make_effect(name, trait, entry.get("notes") or "")
            )


# -------- EQUIPMENT ----------------------
# Ported from parseEquipItem / parseStartingEquipment / buildInventory so
# the rows come out byte-identical to the ones the frontend used to send.

    def parse_equip_item(self, element):
        """
        One entry from an equipment list. The data mixes five shapes and
        every one of them appears in real backgrounds.
        """
        if element is None:
            return None

        # "dagger|xphb"
        if isinstance(element, str):
            item_id = strip_source(element)
            return {"id": item_id, "label": title_case(item_id)}

        if not isinstance(element, dict):
            return None

        # {"value": 5000} — loose coin, no item attached
        if (element.get("value") is not None
                and element.get("item") is None
                and element.get("special") is None):
            value = element["value"]
            return {
                "id": f"gold:{value}",
                "label": format_gp(value),
                "gp": gp_from_cp(value),
            }

        # {"equipmentTypes": ["instrumentMusical", "toolArtisan"]} — the
        # PLURAL form, a choice between categories. Checked before the
        # singular key below, which it otherwise shadows.
        equipment_types = as_list(element.get("equipmentTypes"))
        if equipment_types:
            labels = [
                EQUIPMENT_TYPE_LABELS.get(kind, title_case(kind))
                for kind in equipment_types
            ]
            return {
                "id": "type:" + "|".join(snake(kind) for kind in equipment_types),
                "label": f"{' or '.join(labels)}{quantity_suffix(element)}",
                "placeholder": True,
                "equipment_types": equipment_types,
                "quantity": element.get("quantity", 1),
            }

        # {"equipmentType": "toolArtisan"} — a placeholder for a pick made
        # elsewhere, or a category still to be chosen from.
        equipment_type = element.get("equipmentType")
        if equipment_type:
            label = EQUIPMENT_TYPE_LABELS.get(equipment_type, title_case(equipment_type))
            return {
                "id": f"type:{str(equipment_type).lower()}",
                "label": f"{label}{quantity_suffix(element)}",
                "placeholder": True,
                "equipment_type": equipment_type,
                "quantity": element.get("quantity", 1),
            }

        # {"item": "pouch|phb", "containsValue": 1500}
        item = element.get("item")
        if item:
            item_id = strip_source(item)
            display = element.get("displayName") or item_id
            contains = element.get("containsValue")
            if contains is not None:
                return {
                    "id": item_id,
                    "gp": gp_from_cp(contains),
                    "label": f"{title_case(display)} ({format_gp(contains)})",
                }
            return {
                "id": item_id,
                "label": f"{title_case(display)}{quantity_suffix(element)}",
            }

        # {"special": "vestments", "quantity": 5}
        special = element.get("special")
        if special:
            return {
                "id": f"special:{str(special).lower()}",
                "label": f"{title_case(special)}{quantity_suffix(element)}",
            }

        return None

    def parse_branch(self, elements):
        if not isinstance(elements, list):
            return []
        parsed = [self.parse_equip_item(element) for element in elements]
        return [item for item in parsed if item]

    def parse_starting_equipment(self, starting_equipment):
        """
        Split a starting_equipment array into what's granted outright and
        what the player has to pick.

        Returns (granted, choice_groups) where choice_groups is
        [{"index": 0, "branches": {"A": [items], "B": [items]}}].

        `index` is the position in the RAW array, which is what the
        frontend's choice id counts — so bg.equipment.2 can be the first
        actual choice. A group keyed "_" is granted, and a group with only
        one lettered key is granted too, since there's no alternative to
        choose between. Branch keys are uppercased because the books
        disagree: XPHB writes "A"/"B", EFA and ABH write "a"/"b".
        """
        granted = []
        choice_groups = []

        for index, group in enumerate(starting_equipment or []):
            if not isinstance(group, dict):
                continue

            if GRANTED_KEY in group:
                granted.extend(self.parse_branch(group[GRANTED_KEY]))

            branch_keys = [key for key in group.keys() if key != GRANTED_KEY]

            if len(branch_keys) > 1:
                branches = {}
                for key in sorted(branch_keys, key=lambda k: k.lower()):
                    branches[key.upper()] = self.parse_branch(group[key])
                choice_groups.append({"index": index, "branches": branches})

            elif len(branch_keys) == 1:
                granted.extend(self.parse_branch(group[branch_keys[0]]))

        return granted, choice_groups

    def add_equipment_items(self, items):
        """
        Add parsed items to the inventory. Quantity lives in the name and
        `amount` stays 1, matching the frontend. Loose coin adds to the
        purse and creates no row.
        """
        inventory = self.final_build["inventory"]

        for item in items:
            if item.get("gp"):
                inventory["currency"]["gp"] += item["gp"]

            if str(item.get("id", "")).startswith("gold:"):
                continue

            inventory["mundane"].append({
                "id": self.next_row_id(),
                "name": item.get("label") or title_case(item.get("id")),
                "amount": 1,
                "notes": "",
                "consumed": False,
            })


# -------- RACE HANDLING ----------------------
    def get_race_data(self, name, source=None, edition=None):
        all_races = self.filehandler.load_json(self.races_data_path)

        for race in all_races:
            if race.get("name") != name:
                continue
            # Two Elves exist (PHB and LFL) with entirely different traits
            # and subraces, so the source is what tells them apart.
            if source and race.get("source") != source:
                continue
            if edition and race.get("edition", "classic") != edition:
                continue
            return race

        return None

    def get_subrace_data(self, race_data, name, source=None):
        for subrace in race_data.get("sub_races") or []:
            if subrace.get("name") != name:
                continue
            # Elf/PHB carries two subraces both named "Eladrin", from DMG
            # and MTF, with different ability bonuses and traits. Their
            # display_name matches too, so only source separates them.
            if source and subrace.get("source") != source:
                continue
            return subrace
        return None

    def randomize_subrace(self, race_data):
        sub_races = race_data.get("sub_races") or []
        return random.choice(sub_races) if sub_races else None

    def randomize_race(self):
        """
        Roll a race, and a subrace when the race has any.

        Defaults to edition "one". Only 15 of the 157 races carry an
        `edition` key, so the pool here is small — anything without one
        reads as classic and is skipped.
        """
        all_races = self.filehandler.load_json(self.races_data_path)

        one_edition = [race for race in all_races if "edition" in race]
        if not one_edition:
            print("no edition one races available to randomize")
            return None, None

        race_data = random.choice(one_edition)
        return race_data, self.randomize_subrace(race_data)

    def handle_abilities(self, data, scope):
        """
        Racial ability bonuses, accumulated rather than applied.

        `fixed` values can be NEGATIVE — several variant races carry
        penalties down to -6 — so nothing here assumes a bonus. `choose`
        carries an optional `amount`, which is +1 when absent and +2 in
        the handful of entries that state it.
        """
        abilities = data.get("abilities")
        if not isinstance(abilities, dict):
            return

        bonuses = self.final_build["ability_bonuses"]

        fixed = abilities.get("fixed")
        if isinstance(fixed, dict):
            for key, value in fixed.items():
                if value is None:
                    continue
                bonuses[key] = bonuses.get(key, 0) + int(value)

        choose = abilities.get("choose")
        if not isinstance(choose, dict):
            return

        choice_id = f"{scope}.abilities"
        count = to_int(choose.get("count"), 1)
        amount = to_int(choose.get("amount"), 1)
        options = [option for option in as_list(choose.get("options")) if option in ABILITIES]

        picked = self.resolved_choice(choice_id)
        if picked:
            for key in as_list(picked):
                if key in ABILITIES:
                    bonuses[key] = bonuses.get(key, 0) + amount
            return

        # Nothing is chosen here: the class list is not read yet, so the
        # priorities this should follow are not known. It waits.
        self.defer_ability_choice(
            choice_id, options or list(ABILITIES), [amount] * count,
            target="ability_bonuses", owner=data.get("name"),
        )

    def merge_movement(self, target, values):
        """
        Merge speed or senses one key at a time, so a subrace replaces
        only what it mentions.

        Drow's darkvision 120 overrides Elf's 60, Wood Elf's walk 35
        overrides 30, and Sea Elf's swim 30 is added while its unmentioned
        walk speed survives. Replacing the whole dict would lose that.
        """
        if not isinstance(values, dict):
            return
        for key, value in values.items():
            target[key] = value

    def add_defenses(self, defenses):
        if not isinstance(defenses, dict):
            return
        for key in DEFENSE_KEYS:
            target = self.final_build["defenses"][key]
            for entry in as_list(defenses.get(key)):
                if entry not in target:
                    target.append(entry)

    def add_spells(self, spells, owner):
        """
        Race spells. `uses.type` is at_will, per_long_rest,
        per_short_rest or class_list_addition, and `uses.count` is a
        number or "proficiency_bonus". `level_available` is a CHARACTER
        level, so prune_spells filters these at the end.
        """
        for spell in spells or []:
            if not isinstance(spell, dict):
                continue
            uses = spell.get("uses") or {}
            self.push_spell(
                spell.get("name"),
                granted_by=owner,
                available_at=spell.get("level_available"),
                uses_type=uses.get("type") or spell.get("category"),
                count=uses.get("count"),
                scope="race",
            )

    def handle_spell_ability(self, data, scope):
        """
        The ability used for a race's innate spells.

        Either a plain string ("cha") or a choice ({options, count}).
        `raceChoices` in choiceEngine.js never emits an id for this, so
        the player is never asked — without the randomizer on it always
        ends up unresolved.
        """
        spell_ability = data.get("spell_ability")
        if not spell_ability:
            return

        if isinstance(spell_ability, str):
            self.final_build["race"]["spell_ability"] = spell_ability
            return

        if not isinstance(spell_ability, dict):
            return

        choice_id = f"{scope}.spell_ability"
        options = as_list(spell_ability.get("options"))

        picked = self.resolved_choice(choice_id)
        if picked:
            self.final_build["race"]["spell_ability"] = as_list(picked)[0]
            return

        if self.randomize and options:
            self.final_build["race"]["spell_ability"] = random.choice(options)
            return

        self.add_unresolved(
            "spell_ability", choice_id,
            options=options,
            count=spell_ability.get("count", 1),
        )

    def handle_size(self, sizes):
        """
        `sizes` lists the sizes a race allows. A single size is published
        as it is. When there are several, the player's pick settles it,
        a roll does when the randomizer is on, and otherwise it is left
        unresolved with the options.

        Only the settled size is saved — the list itself is not. When
        nothing is settled, `size` stays empty and the player sets it.
        """
        sizes = as_list(sizes)
        if not sizes:
            return

        if len(sizes) == 1:
            self.final_build["race"]["size"] = sizes[0]
            return

        picked = self.resolved_choice("race.size")
        if picked:
            self.final_build["race"]["size"] = as_list(picked)[0]
        elif self.randomize:
            self.final_build["race"]["size"] = random.choice(sizes)
        else:
            self.add_unresolved("size", "race.size", options=sizes)

    def apply_race_block(self, data, scope, trait="race"):
        """
        Everything a race and a subrace express in the same way, so both
        run through here. Called for the race first and the subrace
        second, which is what lets subrace values override.
        """
        self.handle_abilities(data, scope)

        proficiencies = data.get("proficiencies") or {}
        self.extract_proficiencies(proficiencies.get("skills"), "skill_proficiencies", scope)
        self.extract_proficiencies(proficiencies.get("tools"), "tool_proficiencies", scope)
        self.extract_proficiencies(proficiencies.get("languages"), "language_proficiencies", scope)
        self.extract_proficiencies(proficiencies.get("weapons"), "weapon_proficiencies", scope)
        self.extract_proficiencies(proficiencies.get("armor"), "armor_proficiencies", scope)

        self.merge_movement(self.final_build["speed"], data.get("speed"))
        self.merge_movement(self.final_build["senses"], data.get("senses"))
        self.add_defenses(data.get("defenses"))
        self.add_trait_effects(data.get("traits"), trait=trait)
        self.add_spells(data.get("spells"), owner=data.get("name"))
        self.handle_spell_ability(data, scope)

    def build_race(self, race_data, subrace_data=None):
        race_final = self.final_build["race"]

        race_final["name"] = race_data.get("name")
        race_final["source"] = race_data.get("source")
        race_final["edition"] = race_data.get("edition", "classic")
        race_final["creature_type"] = race_data.get("creature_type")

        # Size and spellcasting ability start empty. The data fills them
        # only when it settles them; otherwise the player sets them.
        race_final["size"] = ""
        race_final["spell_ability"] = ""

        # The race's own traits, copied as editable rows. The effects are
        # still built from the same list by apply_race_block.
        race_final["traits"] = trait_copies(race_data.get("traits"))

        self.handle_size(race_data.get("sizes"))
        self.apply_race_block(race_data, "race")

        race_final["subrace"] = ""
        race_final["subrace_source"] = ""
        race_final["subrace_traits"] = []

        if not subrace_data:
            return

        race_final["subrace"] = subrace_data.get("name")
        race_final["subrace_source"] = subrace_data.get("source")
        race_final["subrace_traits"] = trait_copies(subrace_data.get("traits"))

        # Second, so its speed and senses win over the base race's.
        self.apply_race_block(subrace_data, "race.sub")

    def handle_race(self):

        if self.sel_race:
            name = self.sel_race["name"]
            source = self.sel_race.get("source")
            edition = self.sel_race.get("edition")
            race_data = self.get_race_data(name, source, edition)

            if not race_data:
                print(f"no race found for {name} {source} {edition}")
                return

            subrace_data = None
            sub_races = race_data.get("sub_races") or []
            sub_name, sub_source = read_subrace(self.sel_race.get("subrace"))

            if sub_name:
                subrace_data = self.get_subrace_data(race_data, sub_name, sub_source)
                if not subrace_data:
                    print(f"no subrace {sub_name} {sub_source} under {name} {source}")

            elif sub_races and self.randomize:
                subrace_data = self.randomize_subrace(race_data)

            elif sub_races:
                self.add_unresolved(
                    "subrace", "race.subrace",
                    options=[
                        {
                            "name": subrace.get("name"),
                            "source": subrace.get("source"),
                            "display_name": subrace.get("display_name"),
                        }
                        for subrace in sub_races
                    ],
                )

            self.build_race(race_data, subrace_data)

        elif self.randomize:
            race_data, subrace_data = self.randomize_race()
            if race_data:
                self.build_race(race_data, subrace_data)

        else:
            # Nothing picked and no randomizer: the player fills it in later.
            self.add_unresolved("race", "race")


# -------- CLASS DATA ----------------------
    def load_class_file(self, key):
        """One class's file, read once. Keyed by edition inside."""
        if key not in self._class_cache:
            loadpath = os.path.join(self.classes_data_path, key)
            self._class_cache[key] = self.filehandler.load_json(loadpath)
        return self._class_cache[key]

    def get_class_variant(self, key, edition):
        """The {class, subclasses, class_features} block for one edition."""
        try:
            return (self.load_class_file(key) or {}).get(edition)
        except Exception as error:
            print(f"could not load class {key}: {error}")
            return None

    def available_class_keys(self, taken):
        """Class keys the randomizer may still use: one file per class."""
        taken_lower = {str(name).lower() for name in taken if name}
        keys = []

        try:
            filenames = sorted(os.listdir(self.classes_data_path))
        except OSError as error:
            print(f"could not list {self.classes_data_path}: {error}")
            return []

        for filename in filenames:
            stem, extension = os.path.splitext(filename)
            if extension.lower() != ".json" or stem.lower() in taken_lower:
                continue
            if self.get_class_variant(stem, RANDOM_EDITION):
                keys.append(stem)

        return keys

    def progression_rows(self, variant, level):
        """level_progression rows at or below `level`, in level order."""
        rows = []
        for row in ((variant.get("class") or {}).get("level_progression") or []):
            row_level = row.get("level")
            if row_level is None or to_int(row_level, 0) > level:
                continue
            rows.append(row)
        return sorted(rows, key=lambda row: to_int(row.get("level"), 0))

    def progression_row_at(self, variant, level):
        """The highest row at or below `level` — the character's current row."""
        rows = self.progression_rows(variant, level)
        return rows[-1] if rows else None


# -------- CLASS LEVELS ----------------------
# The player's own class levels are never touched. Any level the total
# allows for but nobody assigned goes into brand NEW classes, and each
# additional new class is less likely than the one before it.

    def pick_target_total(self, assigned):
        """
        The character's final total level.

          a number  -> a hard cap, and every spare level gets spent
          "random"  -> no cap; roll a total, favouring low levels
          None      -> the randomizer was off, so nothing changes
        """
        target = self.payload.get("target_level")

        if target is None or isinstance(target, bool):
            return assigned

        if isinstance(target, (int, float)):
            return max(assigned, min(int(target), MAX_CHARACTER_LEVEL))

        if assigned >= MAX_CHARACTER_LEVEL:
            return assigned

        # They put work into picking classes, so give that build a real
        # chance to stand exactly as they left it.
        if assigned > 0 and random.random() < KEEP_AS_IS_CHANCE:
            return assigned

        return self.weighted_level(low=max(1, assigned + 1))

    def weighted_level(self, low, high=MAX_CHARACTER_LEVEL):
        """
        A level between low and high, favouring low levels.

        Weight is (21 - level), so level 1 is twenty times as likely as
        level 20 and the mean lands near 7 — normal play territory.
        """
        levels = list(range(low, high + 1))
        weights = [(MAX_CHARACTER_LEVEL + 1) - level for level in levels]
        return random.choices(levels, weights=weights, k=1)[0]

    def pick_new_class_count(self, spare, pool_size):
        """
        How many NEW classes to spread the spare levels over.

        One is the baseline; every extra needs another EXTRA_CLASS_CHANCE
        roll and the rolls stack, so the odds fall away quickly. Never
        more classes than there are spare levels to give them.
        """
        ceiling = min(spare, pool_size)
        count = 1
        while count < ceiling and random.random() < EXTRA_CLASS_CHANCE:
            count += 1
        return count

    def split_levels(self, total, parts):
        """
        Split `total` levels into `parts` piles, each at least 1, with
        every possible split equally likely.
        """
        if parts <= 1:
            return [total]

        cuts = sorted(random.sample(range(1, total), parts - 1))
        piles = []
        previous = 0
        for cut in cuts:
            piles.append(cut - previous)
            previous = cut
        piles.append(total - previous)
        return piles

    def build_class_entry(self, key, edition, level, subclass, primary, feats=None):
        variant = self.get_class_variant(key, edition)
        if not variant:
            return None

        core = variant.get("class") or {}
        return {
            "key": key,
            "name": key,
            "display_name": core.get("name") or title_case(key),
            "edition": edition,
            "level": to_int(level, 0),
            "subclass": subclass,
            "primary": bool(primary),
            "hit_dice": core.get("hit_dice"),
            "feats": list(feats or []),
            # Working state only — stripped before the build is saved.
            "_variant": variant,
        }

    def randomize_levels(self):
        """Fill the gap between assigned levels and the target, with new classes."""
        entries = self.final_build["classes"]
        had_picked = bool(entries)

        assigned = sum(entry["level"] for entry in entries)
        target = self.pick_target_total(assigned)
        spare = target - assigned
        if spare <= 0:
            return

        pool = self.available_class_keys([entry["key"] for entry in entries])
        if not pool:
            print("no classes left to randomize into")
            return

        count = self.pick_new_class_count(spare, len(pool))
        keys = random.sample(pool, count)
        piles = self.split_levels(spare, count)

        for index, (key, level) in enumerate(zip(keys, piles)):
            entry = self.build_class_entry(
                key, RANDOM_EDITION, level, None,
                # With no hand-picked classes at all, the first rolled
                # class becomes the primary one.
                primary=(not had_picked and index == 0),
            )
            if entry:
                entry["randomized"] = True
                entries.append(entry)


# -------- SUBCLASS / FEAT SLOTS ----------------------
    def find_subclass(self, variant, name):
        if not name:
            return None
        for subclass in variant.get("subclasses") or []:
            if subclass.get("name") == name:
                return subclass
        return None

    def subclass_min_level(self, subclass):
        levels = [
            to_int(feature.get("level"), 0)
            for feature in subclass.get("features") or []
            if feature.get("level") is not None
        ]
        return min(levels) if levels else None

    def subclass_unlock_level(self, variant):
        """
        Read from the data, never hardcoded — the feature is named
        differently per edition ("Martial Archetype" vs "Fighter
        Subclass"), but the lowest level any subclass has a feature at is
        reliable. Wizard/classic unlocks at 2, not 3.
        """
        levels = [
            self.subclass_min_level(subclass)
            for subclass in variant.get("subclasses") or []
        ]
        levels = [level for level in levels if level is not None]
        return min(levels) if levels else None

    def roll_subclass(self, variant, level):
        eligible = [
            subclass.get("name")
            for subclass in variant.get("subclasses") or []
            if (self.subclass_min_level(subclass) or MAX_CHARACTER_LEVEL + 1) <= level
        ]
        return random.choice(eligible) if eligible else None

    def resolve_subclass(self, entry):
        """
        Settle this class's subclass.

        With the randomizer on, a gap the player left inside their OWN
        picked class gets filled too — without a subclass every one of its
        features is silently missing from the sheet.
        """
        variant = entry["_variant"]
        unlock = self.subclass_unlock_level(variant)

        if unlock is None or entry["level"] < unlock:
            entry["subclass"] = None
            return

        if entry["subclass"] and self.find_subclass(variant, entry["subclass"]):
            return

        choice_id = f"class.{entry['key']}.subclass"
        picked = as_list(self.resolved_choice(choice_id))

        if picked and self.find_subclass(variant, picked[0]):
            entry["subclass"] = picked[0]
            return

        if self.randomize:
            entry["subclass"] = self.roll_subclass(variant, entry["level"])
            return

        entry["subclass"] = None
        self.add_unresolved(
            "subclass_class", choice_id,
            owner=entry["display_name"],
            unlock_level=unlock,
            options=[s.get("name") for s in variant.get("subclasses") or []],
        )

    def asi_slots_at(self, variant, level):
        count = 0
        for row in self.progression_rows(variant, level):
            for name in row.get("feature_names") or []:
                if ASI_RE.search(str(name)):
                    count += 1
        return count

    def handle_feat_slots(self, entry):
        """
        Feats for this class's ASI slots.

        The player's own picks are applied first, then the randomizer
        fills whatever is left. An Epic Boon slot is added only when THIS
        class's own level reaches 19 in One D&D — not the multiclass
        total — and it is not reserved for boons: they simply join the
        pool for any of the class's slots.
        """
        variant = entry["_variant"]
        boon_eligible = entry["edition"] == "one" and entry["level"] >= EPIC_BOON_LEVEL
        slots = self.asi_slots_at(variant, entry["level"]) + (1 if boon_eligible else 0)

        chosen = as_list(entry.get("feats"))
        for pick in chosen:
            if isinstance(pick, dict):
                self.apply_feat_token(
                    pick.get("name") or "", owner=entry["display_name"],
                    source=pick.get("source"),
                )
            elif pick:
                self.apply_feat_token(str(pick), owner=entry["display_name"])

        remaining = max(0, slots - len(chosen))
        if remaining <= 0:
            return

        if self.randomize:
            rolled = self.roll_feats(entry, remaining)
            for feat in rolled:
                self.apply_feat(feat, owner=entry["display_name"])
            remaining -= len(rolled)
            if remaining <= 0:
                return

        self.add_unresolved(
            "class_feats", f"class.{entry['key']}.feats",
            owner=entry["display_name"],
            slots=slots,
            remaining=remaining,
            epic_boon_eligible=boon_eligible,
            reason="no eligible feat left to fill the slot" if self.randomize else None,
        )


# -------- CLASS FEATURES ----------------------
    def features_earned(self, variant, level, subclass_name):
        """Class features plus the chosen subclass's own, at or below `level`."""
        earned = []

        for feature in variant.get("class_features") or []:
            if feature.get("level") is None or to_int(feature["level"], 0) > level:
                continue
            earned.append(feature)

        subclass = self.find_subclass(variant, subclass_name)
        for feature in (subclass or {}).get("features") or []:
            if feature.get("level") is None or to_int(feature["level"], 0) > level:
                continue
            earned.append(feature)

        return earned

    def feature_notes(self, feature):
        """
        A feature's prose.

        87 of the 302 One D&D class features carry no `clean_entries` at
        all, and their raw `entries` mixes plain strings with table and
        list dicts, so only the strings are kept.
        """
        clean = feature.get("clean_entries")
        if isinstance(clean, dict) and clean.get("description"):
            return clean["description"]

        plain = [entry for entry in feature.get("entries") or [] if isinstance(entry, str)]
        return "\n\n".join(plain)

    def add_class_effect(self, name, notes, owner, trait="class"):
        if not name:
            return None
        effect = self.make_effect(name, trait, notes)
        effect["owner"] = owner
        self.final_build["effects"].append(effect)
        return effect

    def effect_from_action(self, action, action_type, owner, fallback_notes=""):
        """
        One effect row from a structured action entry.

        These carry real data — {name, effect_summary, consumes, attack,
        save, conditions_applied} — so kind, action_type, damages and
        notes are all filled from the file rather than left at defaults.
        """
        effect = self.make_effect(
            action.get("name") or owner,
            "class",
            action.get("effect_summary") or fallback_notes,
        )
        effect["action_type"] = action_type
        effect["owner"] = owner

        attack = action.get("attack") if isinstance(action.get("attack"), dict) else None
        save = action.get("save") if isinstance(action.get("save"), dict) else None

        if attack and save:
            effect["kind"] = "attack_and_save"
        elif attack:
            effect["kind"] = "attack"
        elif save:
            effect["kind"] = "save"

        if attack:
            effect["attack"] = {
                "attack_type": attack.get("type") or "",
                "hit_bonus": attack.get("hit_bonus"),
                "range_ft": attack.get("range_ft"),
            }

        if save:
            effect["save"] = {
                "target": save.get("target") or "",
                "ability": save.get("ability") or "",
                "dc_bonus": save.get("dc_bonus"),
                # The data names which ability sets the DC; the sheet's
                # save block has no field for it yet, so it rides along.
                "dc_ability": save.get("dc_ability"),
            }

        for source in (attack, save):
            for damage in as_list((source or {}).get("damage")):
                if isinstance(damage, dict):
                    effect["damages"].append({
                        "dice": damage.get("dice"),
                        "modifier": damage.get("modifier"),
                        "type": damage.get("type"),
                    })

        consumes = action.get("consumes")
        if consumes:
            # Links by name to a row in final_build["resources"], so the
            # page can show remaining uses on the action itself.
            effect["consumes"] = consumes
            effect["charges"]["has"] = True

        conditions = [c for c in as_list(action.get("conditions_applied")) if c]
        if conditions:
            effect["conditions_applied"] = conditions

        return effect

    def handle_feature(self, feature, entry):
        variant = entry["_variant"]
        name = feature.get("name")
        notes = self.feature_notes(feature)

        clean = feature.get("clean_entries")
        clean = clean if isinstance(clean, dict) else {}
        effects = clean.get("effects")
        effects = effects if isinstance(effects, dict) else None

        # An unmade choice inside a feature (Eldritch Invocations, a
        # Metamagic pick) is reported rather than guessed.
        options = clean.get("options")
        choices = (options or {}).get("choices") if isinstance(options, dict) else None
        if choices:
            self.add_unresolved(
                "feature_choice", f"class.{entry['key']}.feature.{snake(name)}",
                owner=entry["display_name"], feature=name, choices=choices,
            )

        if not effects:
            self.add_class_effect(name, notes, entry["display_name"])
            return

        made_any = False
        for category, action_type in ACTION_CATEGORIES.items():
            for action in effects.get(category) or []:
                if not isinstance(action, dict):
                    continue
                self.final_build["effects"].append(
                    self.effect_from_action(action, action_type, entry["display_name"], notes)
                )
                made_any = True

        # A feature with only grants and no action rows still belongs on
        # the sheet, so it gets a passive row carrying its prose.
        if not made_any:
            self.add_class_effect(name, notes, entry["display_name"])

        self.apply_feature_grants(effects, entry)
        self.add_resources(effects.get("resources"), entry, variant)

    def apply_feature_grants(self, effects, entry):
        """Everything in clean_entries.effects that is not an action row."""
        self.grant("armor_proficiencies", [t for t in as_list(effects.get("armor_proficiencies")) if t])
        self.grant("weapon_proficiencies", [t for t in as_list(effects.get("weapon_proficiencies")) if t])
        self.grant("language_proficiencies", [t for t in as_list(effects.get("languages")) if t])

        bonuses = self.final_build["ability_bonuses"]
        for block in effects.get("ability_scores") or []:
            if not isinstance(block, dict):
                continue
            ability = block.get("ability")
            if ability not in ABILITIES:
                continue
            bonuses[ability] = bonuses.get(ability, 0) + to_int(block.get("increase"), 0)
            override = to_int(block.get("max_override"), 0)
            if override:
                self.final_build["ability_max_override"][ability] = override

        for block in effects.get("movement") or []:
            if isinstance(block, dict):
                self.apply_movement(block)

        speed_senses = self.final_build["senses"]
        for block in effects.get("senses") or []:
            if not isinstance(block, dict):
                continue
            sense = block.get("type")
            if sense:
                speed_senses[sense] = max(
                    to_int(speed_senses.get(sense), 0), to_int(block.get("range_ft"), 0)
                )

        for key in ("resistances", "immunities", "vulnerabilities"):
            for block in effects.get(key) or []:
                if not isinstance(block, dict):
                    continue
                target = self.final_build["defenses"][key]
                for value in as_list(block.get("damage_types")) + as_list(block.get("conditions")):
                    if value and value not in target:
                        target.append(value)

        for block in effects.get("saving_throws") or []:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "proficiency":
                self.grant("saving_throw_proficiencies",
                           [str(a).lower() for a in as_list(block.get("abilities"))])

        self.apply_skill_grants(effects.get("skill_proficiencies"), entry)
        self.apply_granted_spells(effects.get("spells_granted"), entry)

    def apply_movement(self, block):
        """
        A movement grant: either a flat modifier ("+10"), or a speed set
        equal to or half of the walk speed. Race speed is applied before
        classes run, so walk is already known here.
        """
        speed = self.final_build["speed"]
        kind = block.get("type")
        if not kind:
            return

        modifier = block.get("modifier")
        value = block.get("value")
        walk = to_int(speed.get("walk"), 0)

        if modifier:
            speed[kind] = to_int(speed.get(kind), 0) + to_int(str(modifier).replace("+", ""), 0)
        elif value == "equal_to_walk_speed":
            speed[kind] = walk
        elif value == "half_walk_speed":
            speed[kind] = walk // 2

    def apply_skill_grants(self, blocks, entry):
        """
        Skill grants from a feature are a CHOICE block, not a flat list:
        {choose_count, from[], type: proficiency|expertise}. `from` can be
        ["all"], meaning any skill, which expands to the full list.
        """
        for index, block in enumerate(blocks or []):
            if not isinstance(block, dict):
                continue

            kind = block.get("type") or "proficiency"
            target = "skill_expertise" if kind == "expertise" else "skill_proficiencies"

            self.resolve_proficiency_choice(
                target,
                f"class.{entry['key']}.feature.skills.{index}",
                block.get("from"),
                to_int(block.get("choose_count"), 1),
                owner=entry["display_name"],
            )

    def apply_granted_spells(self, blocks, entry):
        for block in blocks or []:
            if not isinstance(block, dict):
                continue
            for name in as_list(block.get("spells")):
                if name:
                    self.push_spell(
                        name,
                        granted_by=entry["display_name"],
                        available_at=None,
                        uses_type=block.get("type"),
                        scope="class",
                    )


# -------- CLASS RESOURCES ----------------------
    def add_resources(self, resources, entry, variant):
        """
        Limited-use features, in one uniform shape.

        `scaling` decides where the maximum comes from:
          static              -> `base`
          by_class_level      -> the matching extras column on this
                                 class's own progression row
          by_ability_modifier -> base + an ability modifier, which is not
                                 known until ability scores are settled,
                                 so `max` stays null and the formula is
                                 kept in `scales_with` for a later pass
        """
        for resource in resources or []:
            if not isinstance(resource, dict):
                continue

            name = resource.get("name")
            scaling = resource.get("scaling")
            base = to_int(resource.get("base"), 0)
            maximum = base
            pending = None

            if scaling == "by_class_level":
                row = self.progression_row_at(variant, entry["level"])
                extras = (row or {}).get("extras") or {}
                key = resolve_extras_key(name, extras)
                maximum = to_int(extras.get(key), None) if key else None
                if maximum is None:
                    pending = {"scaling": scaling, "base": base, "extras_key": key}

            elif scaling == "by_ability_modifier":
                maximum = None
                pending = {
                    "scaling": scaling,
                    "base": base,
                    "ability": resource.get("scale_ability"),
                }

            self.merge_resource({
                "id": self.next_row_id(),
                "name": name,
                "owner": entry["display_name"],
                "max": maximum,
                "current": maximum,
                "reset_on": resource.get("recharge"),
                "reset_amount": resource.get("recharge_amount"),
                "die": resource.get("die"),
                "scales_with": pending,
            })

    def merge_resource(self, row):
        """
        One row per resource per class. A resource is often declared again
        by a later feature ("Action Surge (two uses)"), so the highest
        maximum wins while the original id is kept.
        """
        for existing in self.final_build["resources"]:
            if existing["name"] == row["name"] and existing["owner"] == row["owner"]:
                if to_int(row["max"], 0) > to_int(existing["max"], 0):
                    keep_id = existing["id"]
                    existing.clear()
                    existing.update(row)
                    existing["id"] = keep_id
                return
        self.final_build["resources"].append(row)



# -------- SPELL CATALOGUE ----------------------
# Every spell row the adjuster writes is built here, from the same
# catalogue the page reads, so both sides store the same shape.

    def load_spells(self):
        """
        The spell catalogue, read once and indexed for lookup.

        Keys are (squashed name, lowercase source), plus (squashed name,
        None) as a fallback, because grants spell the source in lowercase
        ("xphb") or leave it out entirely.
        """
        if self._spells_index is None:
            try:
                data = self.filehandler.load_json(self.spells_data_path)
            except Exception as error:
                print(f"could not load spells from {self.spells_data_path} ({error})")
                data = []
            if isinstance(data, dict):
                data = data.get("spells") or []

            index = {}
            for spell in data if isinstance(data, list) else []:
                if not isinstance(spell, dict) or not spell.get("name"):
                    continue
                key = squash(spell["name"])
                source = str(spell.get("source") or "").lower()
                index.setdefault((key, source), spell)
                index.setdefault((key, None), spell)

            self._spells_index = index
        return self._spells_index

    def find_spell(self, name, source=None):
        """
        A catalogue spell by name. The XPHB version wins whenever it
        exists, whatever source the grant named. Otherwise the named
        source is tried, then the first version found.
        """
        index = self.load_spells()
        key = squash(name)
        for wanted in (PREFERRED_SPELL_SOURCE, source):
            if wanted:
                hit = index.get((key, str(wanted).lower()))
                if hit:
                    return hit
        return index.get((key, None))

    def push_spell(self, raw, *, granted_by, available_at, uses_type,
                   scope, count=None, recharge=None, fallback_level=None):
        """
        Add one spell to the spellbook in the page's shape.

        `raw` is a spell reference ("dispel magic|xphb") or an already
        parsed ref. The catalogue entry supplies everything descriptive;
        the use type decides prepared / innate / at_will / uses.

        Two working keys ride along until finalize():
          _scope  "race" | "feat" | "class", for prune_spells
          _count  the raw use count ("1", "1e", "int",
                  "proficiency_bonus"), for resolve_spell_uses
        """
        ref = raw if isinstance(raw, dict) else parse_spell_ref(raw)
        if not ref:
            return

        entry = self.find_spell(ref["name"], ref.get("source"))

        if entry:
            name = entry.get("name")
            source = entry.get("source") or ""
            level = to_int(entry.get("level"), 0)
        else:
            name = ref["name"]
            source = str(ref.get("source") or "").upper()
            level = 0 if ref.get("is_cantrip") else to_int(fallback_level, 0)
            self.add_unresolved(
                "spell", f"spell.{snake(name)}",
                name=name, source=source or None, owner=granted_by,
                reason="not found in the spell catalogue",
            )

        # One row per spell NAME, whatever the source. find_spell already
        # picked the preferred version, so the first grant wins.
        for existing in self.final_build["spellbook"]["spells"]:
            if squash(existing.get("name")) == squash(name):
                return

        kind = str(uses_type or "").lower()
        mode = SPELL_USE_MODES.get(kind, "normal")

        if kind == "free_cast":
            reset = "short" if "short" in str(recharge or "").lower() else "long"
        else:
            reset = LIMITED_USE_RESET.get(kind)

        entry = entry or {}
        components = entry.get("components") or {}
        material = components.get("m")
        if isinstance(material, dict):
            material_text = material.get("text") or ""
        elif isinstance(material, str):
            material_text = material
        else:
            material_text = ""

        duration = as_list(entry.get("duration"))
        first_duration = duration[0] if duration and isinstance(duration[0], dict) else {}

        gained = to_int(available_at, None) if available_at not in (None, "") else None

        self.final_build["spellbook"]["spells"].append({
            "name": name,
            "source": source,
            "level": level,
            "school": entry.get("school") or "",
            "concentration": bool(first_duration.get("concentration")),
            "ritual": bool(entry.get("ritual")),
            "time": as_list(entry.get("time")),
            "range": entry.get("range"),
            "duration": duration,
            "components": {
                "v": bool(components.get("v")),
                "s": bool(components.get("s")),
                "m": bool(material),
                "material": material_text,
            },
            "granted_by": granted_by,
            # Level 0 and 1 mean "from the start", which needs no label.
            "available_at": gained if gained and gained > 1 else None,
            "prepared": mode != "normal",
            "innate": mode == "innate",
            "at_will": mode == "at_will",
            # Filled in by resolve_spell_uses once PB and scores exist.
            "uses": {"max": 1, "current": 1, "reset": reset} if reset else None,
            "_scope": scope,
            "_count": count if reset else None,
        })






# -------- ADDITIONAL SPELLS ----------------------
# additionalSpells is the deepest shape in the data. One entry looks like:
#
#   { "name": "Arid Land",            optional — one of several variants
#     "ability": "wis",               optional — its own casting ability
#     "resourceName": "Focus Point",  optional — what casting costs
#     "prepared": { "3": ["blur|xphb"], "5": [...] },
#     "known":    { "3": [{"choose": "level=0;1;2|class=Wizard|school=A"}] },
#     "innate":   { "3": {"ritual": ["speak with animals|xphb"]},
#                   "9": {"daily": {"int": ["lesser restoration|xphb"]}} },
#     "expanded": { "13": [{"all": "level=3|class=Wizard"}] } }
#
# So: category -> character level -> either a list of spell refs and
# choice objects, or a usage wrapper keyed "ritual"/"daily"/"resource"
# whose own key is the number of uses ("1", "1e") or an ability modifier
# ("int", "cha"). The level key "_" means no level requirement.

    SPELL_CATEGORIES = ("known", "prepared", "innate", "expanded")

    def handle_additional_spells(self, blocks, entry, owner):
        blocks = [block for block in as_list(blocks) if isinstance(block, dict)]
        if not blocks:
            return

        blocks = self.pick_spell_variant(blocks, entry, owner)

        for block_index, block in enumerate(blocks):
            context_base = {
                "ability": block.get("ability"),
                "resource": block.get("resourceName"),
                "variant": block.get("name"),
                "owner": owner,
            }

            for category in self.SPELL_CATEGORIES:
                group = block.get(category)
                if not isinstance(group, dict):
                    continue

                for level_key, value in group.items():
                    # "_" means the spells apply with no level gate.
                    level = None if str(level_key) == "_" else to_int(level_key, None)

                    # These keys are the CLASS's own level, so a level 9
                    # druid must not receive its level 15 entries.
                    if level is not None and level > entry["level"]:
                        continue

                    context = dict(context_base)
                    context["category"] = category
                    context["level_available"] = level
                    context["choice_id"] = (
                        f"class.{entry['key']}.spells.{block_index}."
                        f"{category}.{level_key}"
                    )
                    self.collect_spell_value(value, context, uses=None)

    def pick_spell_variant(self, blocks, entry, owner):
        """
        Several named entries mean the player picks one — Circle of the
        Land's Arid / Polar / Temperate / Tropical lists. Unnamed entries
        always apply and are kept either way.
        """
        named = [block for block in blocks if block.get("name")]
        if len(named) < 2:
            return blocks

        names = [block["name"] for block in named]
        choice_id = f"class.{entry['key']}.spells.variant"

        picked = as_list(self.resolved_choice(choice_id))
        chosen = picked[0] if picked and picked[0] in names else None

        if chosen is None:
            if self.randomize:
                chosen = random.choice(names)
            else:
                self.add_unresolved(
                    "spell_variant", choice_id, owner=owner, options=names,
                )

        return [
            block for block in blocks
            if not block.get("name") or block.get("name") == chosen
        ]

    def collect_spell_value(self, value, context, uses):
        """
        A level's worth of spells: either a list, or a usage wrapper.

        At this level a dict is a usage wrapper ({"ritual": [...]}); a
        dict INSIDE a list is a choice object instead. The guard below
        covers a bare choice object appearing here anyway.
        """
        if isinstance(value, list):
            for index, item in enumerate(value):
                self.collect_spell_item(item, context, uses, index)
            return

        if not isinstance(value, dict):
            return

        if "choose" in value or "all" in value:
            self.collect_spell_item(value, context, uses, 0)
            return

        for usage, inner in value.items():
            if isinstance(inner, dict):
                # Keyed by how many uses: "1", "1e" (one of each), or an
                # ability like "int" meaning uses equal to that modifier.
                for count_key, spells in inner.items():
                    self.collect_spell_value(
                        spells, context, {"type": usage, "count": count_key}
                    )
            else:
                self.collect_spell_value(inner, context, {"type": usage})

    def collect_spell_item(self, item, context, uses, index):
        if isinstance(item, str):
            ref = parse_spell_ref(item)
            if ref:
                self.add_spell(ref, context, uses)
            return

        if not isinstance(item, dict):
            return

        # {"all": "level=3|class=Wizard"} adds every matching spell to
        # the class list — a rule, not a spell.
        if item.get("all"):
            self.final_build["spell_list_rules"].append({
                "filter": item["all"],
                "category": context["category"],
                "level_available": context["level_available"],
                "variant": context["variant"],
                "owner": context["owner"],
            })
            return

        choose = item.get("choose")
        count = to_int(item.get("count"), 1)
        choice_id = f"{context['choice_id']}.{index}"

        # {"choose": {"count": 1, "from": [...]}} lists real options, so
        # it can actually be settled here.
        if isinstance(choose, dict):
            options = [
                ref for ref in (parse_spell_ref(o) for o in as_list(choose.get("from")))
                if ref
            ]
            self.resolve_spell_choice(
                options, to_int(choose.get("count"), count), context, uses, choice_id
            )
            return

        # {"choose": "level=0;1;2|class=Wizard|school=A"} is a filter over
        # the spell catalogue, which is not loaded here.
        if isinstance(choose, str):
            self.add_unresolved(
                "spell_choice", choice_id,
                owner=context["owner"],
                category=context["category"],
                level_available=context["level_available"],
                choose=choose,
                count=count,
                reason="spell filter needs the spell catalogue",
            )

    def resolve_spell_choice(self, options, count, context, uses, choice_id):
        picked = self.resolved_choice(choice_id)
        if picked:
            for name in as_list(picked):
                ref = parse_spell_ref(name)
                if ref:
                    self.add_spell(ref, context, uses)
            return

        if self.randomize and options:
            for ref in random.sample(options, min(count, len(options))):
                self.add_spell(ref, context, uses)
            return

        self.add_unresolved(
            "spell_choice", choice_id,
            owner=context["owner"],
            category=context["category"],
            level_available=context["level_available"],
            options=[ref["name"] for ref in options],
            count=count,
        )

    def add_spell(self, ref, context, uses):
        """
        One spell from additionalSpells. With no usage wrapper, the
        category decides: innate spells are at will, prepared spells are
        always prepared, and known or expanded spells go on the list.
        """
        uses = uses or {}
        default = "at_will" if context["category"] == "innate" else context["category"]
        self.push_spell(
            ref,
            granted_by=context["owner"],
            available_at=context["level_available"],
            uses_type=uses.get("type") or default,
            count=uses.get("count"),
            scope="class",
        )


# -------- FEATS ----------------------
# Feats carry NO clean_entries, so there is no action_type, attack, save
# or charge data — an effect row is the name plus the `entries` prose,
# the same as a race trait. What they do carry is a lot of structured
# grants, which reuse the readers already here.

    def load_feats(self):
        """The feats catalogue, read once. Returns [] if the path is wrong."""
        if self._feats_cache is None:
            try:
                data = self.filehandler.load_json(self.feats_data_path)
            except Exception as error:
                print(f"could not load feats from {self.feats_data_path} ({error})")
                data = []
            if isinstance(data, dict):
                data = data.get("feats") or []
            self._feats_cache = data if isinstance(data, list) else []
        return self._feats_cache

    def find_feat(self, name, source=None):
        """
        A feat by name, and by source when one is given.

        Matching is case-blind because the catalogue uses Title Case
        ("Magic Initiate") while a background grants it lowercase. A
        name match with the wrong source is kept as a fallback rather
        than discarded, since most grants name no source at all.
        """
        target = squash(name)
        fallback = None

        for feat in self.load_feats():
            if squash(feat.get("name")) != target:
                continue
            if source and feat.get("source") != source:
                fallback = fallback or feat
                continue
            return feat

        return fallback

    def feat_prerequisites_met(self, feat, entry=None):
        """
        Whether the character satisfies a feat's prerequisites.

        Deliberately always True. Which prerequisite types to enforce is
        still undecided, and random rolling ignores them by design, so a
        rolled feat can be one the character would not legally qualify
        for. Every feat row carries its prerequisites regardless, so
        turning enforcement on later means editing this one function
        rather than threading prerequisites through the roller.

        The thirteen types in the data: ability, level (an int OR
        {class, level}), feat, campaign, race, exclusiveFeatCategory,
        spellcasting, proficiency, feature, background, other,
        otherSummary, featCategory.
        """
        return True

    def feat_pool_for(self, entry):
        """
        Feats a class entry may roll. Only `general` is legal in an ASI
        slot, with Epic Boons joining once this class's OWN level reaches
        19 in One D&D — the extra slot they open is not reserved for
        them, so they compete for any of the class's slots.
        """
        categories = {ASI_FEAT_CATEGORY}
        if entry["edition"] == "one" and entry["level"] >= EPIC_BOON_LEVEL:
            categories.add("epic_boon")

        return [
            feat for feat in self.load_feats()
            if is_one_edition_feat(feat)
            and feat.get("category") in categories
            and self.feat_prerequisites_met(feat, entry)
        ]

    def roll_feats(self, entry, count):
        """
        Pick `count` feats for open slots.

        A feat marked `repeatable` can fill more than one slot; anything
        else is taken at most once across the whole character, which is
        why the taken set is shared rather than per class.
        """
        pool = self.feat_pool_for(entry)
        picked = []

        for _ in range(count):
            available = [
                feat for feat in pool
                if feat.get("repeatable")
                or squash(feat.get("name")) not in self._taken_feats
            ]
            if not available:
                break

            feat = random.choice(available)
            self._taken_feats.add(squash(feat.get("name")))
            picked.append(feat)

        return picked

    def apply_feat_token(self, token, owner, source=None):
        """
        A feat named by a data token, as a background grants it:
        "magic initiate; cleric".
        """
        name, subtype = split_feat_token(token)
        if not name:
            return

        feat = self.find_feat(name, source)
        if not feat:
            # The raw string still goes on the list — losing it because a
            # lookup failed would be worse than carrying it unresolved.
            if token not in self.final_build["feats"]:
                self.final_build["feats"].append(token)
            self.add_unresolved(
                "feat", f"feat.{snake(name)}",
                name=name, subtype=subtype, raw=token, owner=owner,
                reason="not found in the feats catalogue",
            )
            return

        self.apply_feat(feat, subtype=subtype, owner=owner, raw=token)

    def apply_feat(self, feat, subtype=None, owner=None, raw=None):
        """
        Everything one feat contributes: the raw string on the list, an
        effect row, its proficiency grants, its defences, its ability
        bonuses and its spells.
        """
        name = feat.get("name")
        if not name:
            return

        self._taken_feats.add(squash(name))

        token = raw or (f"{name}; {subtype}" if subtype else name)
        if token not in self.final_build["feats"]:
            self.final_build["feats"].append(token)

        # "Magic Initiate (Cleric)", matching formatFeatTag in the
        # frontend. The catalogue name is already correctly cased, so it
        # is used as-is — title_case would turn "Boon of Irresistible
        # Offense" into "Boon Of Irresistible Offense". Only the subtype
        # needs casing, since it arrives lowercase from the token.
        label = f"{name} ({title_case(subtype)})" if subtype else name

        effect = self.add_class_effect(
            label, feat.get("entries") or "", owner, trait="feat"
        )
        if effect is not None:
            effect["source"] = feat.get("source")
            effect["category"] = feat.get("category")
            # Carried, never checked — see feat_prerequisites_met.
            effect["prerequisite"] = feat.get("prerequisite")
            if subtype:
                effect["subtype"] = subtype

        # A subtype has to be one the feat actually offers; `versions`
        # lists them ("Cleric"/"Druid"/"Wizard" for Magic Initiate).
        versions = as_list(feat.get("versions"))
        if subtype and versions and not any(
                squash(version) == squash(subtype) for version in versions):
            self.add_unresolved(
                "feat_version", f"feat.{snake(name)}.version",
                name=name, subtype=subtype, options=versions, owner=owner,
                reason="subtype is not in the feat's versions list",
            )

        self.apply_feat_proficiencies(feat, owner)
        self.apply_feat_defenses(feat, owner)
        self.apply_feat_ability(feat, owner)
        self.apply_feat_spells(feat, owner)
        self.apply_feat_optional_features(feat, owner)

    def apply_feat_proficiencies(self, feat, owner):
        """
        Feat proficiency grants. Three patterns, and one block can mix
        them:

            {"intimidation": true}                 granted outright
            {"any": 1} / {"anyArtisansTool": 1}    a choice of N from a pool
            {"choose": {"from": [...], "count": 3}} an explicit choice
            {"choose": {"fromFilter": "..."}}       needs the item catalogue
        """
        name = feat.get("name")

        for source_key, target in FEAT_PROFICIENCY_BLOCKS:
            family = PROFICIENCY_FAMILY.get(target, target)

            for index, block in enumerate(as_list(feat.get(source_key))):
                if not isinstance(block, dict):
                    continue

                for raw_key, value in block.items():
                    choice_id = f"feat.{snake(name)}.{family}.{index}.{snake(raw_key)}"

                    if raw_key == "choose" and isinstance(value, dict):
                        if value.get("fromFilter"):
                            self.add_unresolved(
                                target, choice_id, owner=owner, feat=name,
                                proficiency_filter=value["fromFilter"],
                                count=to_int(value.get("count"), 1),
                                reason="proficiency filter needs the item catalogue",
                            )
                            continue
                        self.resolve_proficiency_choice(
                            target, choice_id, value.get("from"),
                            to_int(value.get("count"), 1), owner=owner, feat=name,
                        )
                        continue

                    # Bool first: in Python a bool is also an int, so True
                    # would otherwise read as a count of 1.
                    if isinstance(value, bool):
                        if value:
                            self.grant(target, [raw_key])
                        continue

                    count = to_int(value, 0)
                    if count <= 0:
                        continue

                    # Expertise draws from the skills the character is
                    # already proficient in, not from every skill.
                    if squash(raw_key) == "anyproficientskill":
                        options = list(self.final_build["skill_proficiencies"])
                    else:
                        options = [CAMEL_TOOL_CATEGORIES.get(squash(raw_key), raw_key)]

                    self.resolve_proficiency_choice(
                        target, choice_id, options, count, owner=owner, feat=name,
                    )

    def apply_feat_defenses(self, feat, owner):
        """
        Resistances, immunities and senses. `resist` entries are either a
        damage type string or a {"choose": {from, count}} pick.
        """
        name = feat.get("name")
        defenses = self.final_build["defenses"]

        for source_key, target in (("resist", "resistances"),
                                   ("immune", "immunities"),
                                   ("conditionImmune", "immunities")):
            for index, item in enumerate(as_list(feat.get(source_key))):
                if isinstance(item, str):
                    if item not in defenses[target]:
                        defenses[target].append(item)
                    continue

                if not isinstance(item, dict):
                    continue

                choose = item.get("choose")
                if not isinstance(choose, dict):
                    continue

                choice_id = f"feat.{snake(name)}.{target}.{index}"
                options = [o for o in as_list(choose.get("from")) if o]
                count = to_int(choose.get("count"), 1)

                picked = as_list(self.resolved_choice(choice_id))
                if not picked:
                    if self.randomize and len(options) >= count:
                        picked = random.sample(options, count)
                    else:
                        self.add_unresolved(
                            target, choice_id, owner=owner, feat=name,
                            options=options, count=count,
                        )
                        continue

                for value in picked:
                    if value not in defenses[target]:
                        defenses[target].append(value)

        senses = self.final_build["senses"]
        for block in as_list(feat.get("senses")) + as_list(feat.get("bonusSenses")):
            if not isinstance(block, dict):
                continue
            for sense, distance in block.items():
                senses[sense] = max(
                    to_int(senses.get(sense), 0), to_int(distance, 0)
                )

    def apply_feat_ability(self, feat, owner):
        """
        A feat's ability increase, into its own pot.

        Either fixed ({"str": 1}) or a choice
        ({"choose": {"from": [...], "count": 1, "amount": 2}}), where
        `amount` defaults to 1 and `count` to 1. A sibling `max` raises
        that ability's ceiling past 20 — epic boons set 30.
        """
        name = feat.get("name")
        bonuses = self.final_build["feat_ability_bonuses"]
        overrides = self.final_build["ability_max_override"]

        def bump(ability, amount, cap):
            if ability not in ABILITIES:
                return
            bonuses[ability] = bonuses.get(ability, 0) + amount
            if cap:
                overrides[ability] = max(to_int(overrides.get(ability), 0), cap)

        for index, block in enumerate(as_list(feat.get("ability_score_increase"))):
            if not isinstance(block, dict):
                continue

            # `max` and `hidden` sit beside the ability letters in the
            # same dict, which is why the fixed branch below filters on
            # ABILITIES rather than taking every key.
            cap = to_int(block.get("max"), 0)
            choose = block.get("choose")

            if isinstance(choose, dict):
                count = to_int(choose.get("count"), 1)
                amount = to_int(choose.get("amount"), 1)
                options = [a for a in as_list(choose.get("from")) if a in ABILITIES]
                choice_id = f"feat.{snake(name)}.ability.{index}"

                picked = as_list(self.resolved_choice(choice_id))
                if picked:
                    for ability in picked:
                        bump(ability, amount, cap)
                    continue

                self.defer_ability_choice(
                    choice_id, options or list(ABILITIES), [amount] * count,
                    target="feat_ability_bonuses", owner=owner,
                    cap=cap, key="feat_ability", feat=name,
                )
                continue

            for ability, value in block.items():
                bump(ability, to_int(value, 0), cap)

    def apply_feat_spells(self, feat, owner):
        """
        A feat's spells.

        A DIFFERENT shape from the classes' additionalSpells — snake_case
        and already flat:

          additional_spells: {
            spellcasting_ability: {fixed: "cha"|null, choose_from: [...]},
            extended_spell_list: [{name, spell_level}],
            spells: [{name, choice, free_cast, level_requirement}] }

        `level_requirement` is a CHARACTER level, which is not known
        while a background's feats are being read, so these rows are
        tagged scope "feat" and pruned in finalize().
        """
        block = feat.get("additional_spells")
        if not isinstance(block, dict):
            return

        name = feat.get("name")
        ability = self.feat_spell_ability(block, feat, owner)

        for entry in as_list(block.get("extended_spell_list")):
            if isinstance(entry, dict) and entry.get("name"):
                self.add_feat_spell(
                    entry["name"], feat, owner, ability,
                    category="expanded",
                    level_available=None,
                    uses={"type": "class_list_addition"},
                    spell_level=entry.get("spell_level"),
                )

        for index, entry in enumerate(as_list(block.get("spells"))):
            if not isinstance(entry, dict):
                continue

            free_cast = entry.get("free_cast")
            if isinstance(free_cast, dict):
                uses = {
                    "type": "free_cast",
                    "count": to_int(free_cast.get("amount"), 1),
                    "recharge": free_cast.get("recharge"),
                }
            else:
                uses = {"type": "granted"}

            level_required = entry.get("level_requirement")
            choice = entry.get("choice")

            if isinstance(choice, dict):
                options = [o for o in as_list(choice.get("from")) if o]
                count = to_int(choice.get("count"), 1) or 1
                choice_id = f"feat.{snake(name)}.spells.{index}"

                picked = as_list(self.resolved_choice(choice_id))
                if not picked:
                    if self.randomize and len(options) >= count:
                        picked = random.sample(options, count)
                    else:
                        self.add_unresolved(
                            "spell_choice", choice_id, owner=owner, feat=name,
                            options=options, count=count,
                            spell_filter=choice.get("filter"),
                            reason=("spell filter needs the spell catalogue"
                                    if not options else None),
                        )
                        continue

                for spell_name in picked:
                    self.add_feat_spell(spell_name, feat, owner, ability,
                                        "granted", level_required, uses)
                continue

            if entry.get("name"):
                self.add_feat_spell(entry["name"], feat, owner, ability,
                                    "granted", level_required, uses)

    def feat_spell_ability(self, block, feat, owner):
        """The ability a feat's spells use: fixed, or a choice of three."""
        spell_ability = block.get("spellcasting_ability")
        if not isinstance(spell_ability, dict):
            return None

        fixed = spell_ability.get("fixed")
        if fixed:
            return fixed

        options = [a for a in as_list(spell_ability.get("choose_from")) if a in ABILITIES]
        if not options:
            return None

        choice_id = f"feat.{snake(feat.get('name'))}.spell_ability"
        picked = as_list(self.resolved_choice(choice_id))
        if picked:
            return picked[0]

        if self.randomize:
            return random.choice(options)

        self.add_unresolved(
            "spell_ability", choice_id, owner=owner,
            feat=feat.get("name"), options=options,
        )
        return None

    def add_feat_spell(self, spell_name, feat, owner, ability, category,
                        level_available, uses, spell_level=None):
        """
        A feat's spell. `level_requirement` is a CHARACTER level, so these
        are pruned like race spells. A free cast becomes a limited use.
        """
        uses = uses or {}
        self.push_spell(
            spell_name,
            granted_by=feat.get("name"),
            available_at=level_available,
            uses_type=uses.get("type") or category,
            count=uses.get("count"),
            recharge=uses.get("recharge"),
            scope="feat",
            fallback_level=spell_level,
        )

    def apply_feat_optional_features(self, feat, owner):
        """
        A feat that grants Fighting Style, Metamagic, Invocations or
        Maneuvers.

        NOTE the key is `additonal_feature` — misspelled in the data,
        missing an `i`. Spelling it correctly finds nothing at all.
        """
        for block in as_list(feat.get("additonal_feature")):
            if not isinstance(block, dict):
                continue
            self.add_unresolved(
                "optional_feature",
                f"feat.{snake(feat.get('name'))}.optional.{snake(block.get('name'))}",
                owner=owner,
                feat=feat.get("name"),
                name=block.get("name"),
                feature_type=as_list(block.get("featureType")),
                progression=block.get("progression"),
                reason="needs the optional-features dataset",
            )


# -------- SPELLCASTING ----------------------
    def caster_progression(self, entry):
        """
        A class's caster progression, falling back to the subclass's —
        Eldritch Knight and Arcane Trickster are 1/3 casters declared on
        the subclass, not the class.
        """
        variant = entry["_variant"]
        progression = (variant.get("class") or {}).get("casterProgression")
        if progression:
            return progression

        subclass = self.find_subclass(variant, entry["subclass"])
        return (subclass or {}).get("casterProgression")

    def caster_level_for(self, progression, level):
        """
        A class's contribution to the multiclass caster level.

        Artificer is handled exactly like the other half casters rather
        than special-cased. Its own slot table is in the data and a
        single-class artificer reads that directly, so this only applies
        to a genuine multiclass.
        """
        if progression in ("1/2", "artificer"):
            return level // 2
        if progression == "1/3":
            return level // 3
        return level

    def apply_spell_counts(self, entry):
        """
        Prepared-spell and cantrip counts, which One D&D keeps as columns
        in the progression table. The highest across classes wins rather
        than a sum, since they are per-class allowances the sheet shows
        as one number.
        """
        row = self.progression_row_at(entry["_variant"], entry["level"])
        extras = (row or {}).get("extras") or {}
        spellbook = self.final_build["spellbook"]

        prepared = to_int(extras.get("prepared_spells"), 0)
        if prepared:
            spellbook["max_prepared_spells"] = max(
                to_int(spellbook.get("max_prepared_spells"), 0), prepared
            )

        cantrips = to_int(extras.get("cantrips"), 0)
        if cantrips:
            spellbook["cantrips_known"] = max(
                to_int(spellbook.get("cantrips_known"), 0), cantrips
            )

    def class_spell_slots(self, variant, level):
        """This class's own slot array at `level`, straight from its table."""
        row = self.progression_row_at(variant, level)
        slots = (row or {}).get("spell_slots")
        return slots if isinstance(slots, list) and any(slots) else None

    def pact_slots_at(self, variant, level):
        """
        Warlock pact slots: the count is extras.spell_slots and their
        level is extras.slot_level. The normal spell_slots array is null
        for warlock, which is why these live in extras.
        """
        row = self.progression_row_at(variant, level)
        extras = (row or {}).get("extras") or {}
        count = to_int(extras.get("spell_slots"), 0)
        slot_level = to_int(extras.get("slot_level"), 0)
        if not count or not slot_level:
            return None
        return {"level": slot_level, "count": count}

    def handle_spellcasting(self):
        """
        Spell slots and pact slots.

        A single spellcasting class reads its own level_progression, so
        nothing is hardcoded in the common case. Pact magic is tracked
        separately and never contributes to the caster level, because
        Pact Magic and Spellcasting are independent in the rules — a
        warlock multiclass must not gain spell slots from warlock levels.
        Only a genuine multiclass falls back to the shared table.
        """
        spellbook = self.final_build["spellbook"]
        slot_casters = []

        for entry in self.final_build["classes"]:
            progression = self.caster_progression(entry)

            if progression == "pact":
                pact = self.pact_slots_at(entry["_variant"], entry["level"])
                if pact:
                    spellbook["pactslots"].append({
                        "id": self.next_id(),
                        "level": pact["level"],
                        "slots_max": pact["count"],
                        "slots_current": pact["count"],
                    })
                continue

            if not progression:
                continue

            slot_casters.append(entry)
            self.final_build["caster_level"] += self.caster_level_for(
                progression, entry["level"]
            )

        if not slot_casters:
            return

        if len(slot_casters) == 1:
            entry = slot_casters[0]
            slots = self.class_spell_slots(entry["_variant"], entry["level"])
        else:
            level = max(1, min(self.final_build["caster_level"], len(SPELLSLOT_PROGRESSION)))
            slots = SPELLSLOT_PROGRESSION[level - 1]

        for index, count in enumerate(slots or []):
            if to_int(count, 0) <= 0:
                continue
            spellbook["spellslots"].append({
                "id": self.next_id(),
                "level": index + 1,
                "slots_max": count,
                "slots_current": count,
            })


# -------- CLASS PROFICIENCIES ----------------------
    def class_weapon_proficiencies(self, profs, entry):
        """
        Weapon proficiency, spelled two ways.

          weaponProficiencies  [{"simple": true,
                                 "all": {"fromFilter": "type=martial weapon|property=light"}}]
          weapons              ["martial", "{@item club|phb|clubs}"]
                               ["Martial weapons that have the
                                 {@filter Light|items|type=martial weapon|
                                 property=light} property"]

        Across all 13 One D&D classes `weapons` holds only four distinct
        values: "simple", "martial", and two sentences carrying an
        embedded @filter tag. That tag's payload is the same syntax as
        fromFilter, so both spellings end up in one place. Expanding a
        filter into actual weapon names needs the item catalogue, so
        filters are reported rather than resolved.
        """
        filters = []
        prose = []

        for block in as_list(profs.get("weaponProficiencies")):
            if not isinstance(block, dict):
                continue
            for key, value in block.items():
                if value is True:
                    self.grant("weapon_proficiencies", [str(key).lower()])
                elif isinstance(value, dict) and value.get("fromFilter"):
                    filters.append(value["fromFilter"])

        for token in as_list(profs.get("weapons")):
            if isinstance(token, dict):
                token = token.get("proficiency") or token.get("name")
            if not token:
                continue

            text = str(token).strip()

            if text.lower() in WEAPON_CATEGORIES:
                self.grant("weapon_proficiencies", [text.lower()])
                continue

            # Checked before @item, since the filter sentences are prose
            # with a tag embedded mid-string rather than a bare tag.
            weapon_filter = parse_filter_tag(text)
            if weapon_filter:
                filters.append(weapon_filter)
                continue

            if "{@item" in text:
                self.grant("weapon_proficiencies", [parse_tag_id(text)])
                continue

            prose.append(text)

        if filters:
            self.add_unresolved(
                "weapon_proficiencies", f"class.{entry['key']}.prof.weapons.filter",
                owner=entry["display_name"], filters=filters,
                reason="weapon filter needs the item catalogue",
            )

        if prose:
            self.add_unresolved(
                "weapon_proficiencies", f"class.{entry['key']}.prof.weapons",
                owner=entry["display_name"], text=prose,
                reason="unrecognised weapon proficiency wording",
            )

    def class_skill_proficiencies(self, blocks, entry):
        """
        `skills` is a one-element list holding either {"any": 3} — choose
        from every skill — or {"choose": {"count", "from"}}.
        """
        for index, block in enumerate(as_list(blocks)):
            if not isinstance(block, dict):
                continue

            choice_id = f"class.{entry['key']}.prof.skills.{index}"

            picked = self.resolved_choice(choice_id)
            if picked:
                self.grant("skill_proficiencies", as_list(picked))
                continue

            any_count = to_int(block.get("any"), 0)
            if any_count:
                # Bard's "choose any 3 skills" — the whole skill list.
                self.resolve_proficiency_choice(
                    "skill_proficiencies", choice_id, ["any_skill"], any_count,
                    owner=entry["display_name"],
                )
                continue

            choose = block.get("choose")
            if not isinstance(choose, dict):
                continue

            self.resolve_proficiency_choice(
                "skill_proficiencies", choice_id,
                choose.get("from"), to_int(choose.get("count"), 1),
                owner=entry["display_name"],
            )

    def class_tool_proficiencies(self, blocks, entry):
        """
        `toolProficiencies` is a list of key/value maps:

            {"thieves' tools": true}     granted outright
            {"anyArtisansTool": 1}       a choice of that many

        A category name mapped to true is really an unresolved pick
        rather than a grant, so it gets promoted — the rule readTools
        uses in classEngine.js.

        Choice ids are numbered across the WHOLE flattened list, not per
        block, because that is how classEngine indexes them. Numbering
        them any other way means the player's pick never matches and is
        silently dropped.
        """
        choices = []

        for block in as_list(blocks):
            if not isinstance(block, dict):
                continue

            for key, value in block.items():
                name = str(key)
                category = CAMEL_TOOL_CATEGORIES.get(squash(name))

                # Checked before the numeric branch: in Python a bool is
                # also an int, so True would otherwise read as count 1.
                if isinstance(value, bool):
                    if not value:
                        continue
                    token = category or name.lower()
                    if self.expand_token(token, "tools"):
                        choices.append((token, 1))
                    else:
                        self.grant("tool_proficiencies", [name])
                    continue

                count = to_int(value, 0)
                if count > 0:
                    choices.append((category or name.lower(), count))

        for index, (token, count) in enumerate(choices):
            self.resolve_proficiency_choice(
                "tool_proficiencies",
                f"class.{entry['key']}.prof.tools.{index}",
                [token], count,
                owner=entry["display_name"],
            )

    def handle_class_proficiencies(self, entry):
        """
        Starting proficiencies. Only the primary class grants the full
        set; a multiclass grants multiclassing.proficienciesGained, which
        uses the same sub-keys.
        """
        core = entry["_variant"].get("class") or {}

        if entry["primary"]:
            profs = core.get("startingProficiencies") or {}
        else:
            profs = (core.get("multiclassing") or {}).get("proficienciesGained") or {}

        if not isinstance(profs, dict):
            return

        for token in as_list(profs.get("armor")):
            if isinstance(token, dict):
                token = token.get("proficiency")
            if token:
                self.grant("armor_proficiencies", [str(token).lower()])

        self.class_weapon_proficiencies(profs, entry)
        self.class_skill_proficiencies(profs.get("skills"), entry)
        self.class_tool_proficiencies(profs.get("toolProficiencies"), entry)


# -------- CLASS EQUIPMENT ----------------------
    def handle_class_equipment(self, entry):
        """
        Starting equipment, primary class only — a multiclass grants none.

        The editions diverge. Classic has several groups (a "_" group
        granted outright plus a/b/c pick-one groups) AND a separate
        `goldAlternative`, which the wizard offers as a KIT-or-GOLD
        switch. One D&D has a single group whose A/B/C branches already
        include the gold option as a plain value, and no goldAlternative
        at all — so no switch is offered there.
        """
        if not entry["primary"]:
            return

        core = entry["_variant"].get("class") or {}
        starting = core.get("startingEquipment") or {}
        scope = f"class.{entry['key']}"

        gold_alternative = starting.get("goldAlternative")
        if gold_alternative and not self.take_class_kit(entry, scope, gold_alternative):
            return

        granted, choice_groups = self.parse_starting_equipment(starting.get("defaultData"))
        self.add_equipment_items(granted)

        for group in choice_groups:
            choice_id = f"{scope}.equipment.{group['index']}"
            branches = group["branches"]
            if not branches:
                continue

            picked = self.resolved_choice(choice_id)
            key = str(as_list(picked)[0]).upper() if picked else None

            if key not in branches:
                if not self.randomize:
                    self.add_unresolved(
                        "starting_equipment_class", choice_id,
                        owner=entry["display_name"],
                        index=group["index"],
                        branches=branches,
                    )
                    continue
                key = random.choice(sorted(branches.keys()))

            self.add_equipment_items(branches[key])

    def take_class_kit(self, entry, scope, gold_alternative):
        """
        Resolve the classic KIT-or-GOLD switch.

        Returns True when the kit should be handed out, False when the
        player took gold instead or the choice is still open.
        """
        mode_id = f"{scope}.equipmentMode"
        picked = as_list(self.resolved_choice(mode_id))
        mode = str(picked[0]).upper() if picked else None

        if mode not in ("KIT", "GOLD"):
            if not self.randomize:
                self.add_unresolved(
                    "starting_equipment_class", mode_id,
                    owner=entry["display_name"],
                    options=["KIT", "GOLD"],
                    gold=clean_dice(gold_alternative),
                )
                return False
            mode = random.choice(["KIT", "GOLD"])

        if mode == "KIT":
            return True

        # Taking gold means rolling dice, so it is only settled when the
        # randomizer is on; otherwise the roll is the player's to make.
        if self.randomize:
            rolled = roll_gold(gold_alternative)
            if rolled is not None:
                self.final_build["inventory"]["currency"]["gp"] += rolled
                return False

        self.add_unresolved(
            "starting_gold_class", f"{scope}.gold",
            owner=entry["display_name"],
            roll=clean_dice(gold_alternative),
            reason="starting gold is a dice roll",
        )
        return False


# -------- CLASS ORCHESTRATION ----------------------
    def handle_class(self, entry):
        variant = entry["_variant"]

        # Only the primary class grants saving throw proficiencies.
        if entry["primary"]:
            self.grant(
                "saving_throw_proficiencies",
                [str(a).lower() for a in (variant.get("class") or {}).get("saving_throw_proficiency") or []],
            )

        self.handle_class_proficiencies(entry)
        self.handle_class_equipment(entry)

        core = variant.get("class") or {}
        self.handle_additional_spells(
            core.get("additionalSpells"), entry, entry["display_name"]
        )

        subclass = self.find_subclass(variant, entry["subclass"])
        if subclass:
            self.handle_additional_spells(
                subclass.get("additionalSpells"), entry, subclass.get("name")
            )

        self.apply_spell_counts(entry)

        for feature in self.features_earned(variant, entry["level"], entry["subclass"]):
            self.handle_feature(feature, entry)

        self.handle_feat_slots(entry)

    def handle_classes(self):
        entries = []

        for index, selected in enumerate(self.sel_classes):
            entry = self.build_class_entry(
                selected.get("name"),
                selected.get("edition"),
                selected.get("level"),
                selected.get("subclass"),
                selected.get("primary", index == 0),
                selected.get("feats"),
            )
            if entry:
                entries.append(entry)
            else:
                print(f"no class data for {selected.get('name')} {selected.get('edition')}")

        self.final_build["classes"] = entries

        if not entries and not self.randomize:
            self.add_unresolved("classes", "classes")
            return

        if self.randomize:
            self.randomize_levels()

        for entry in self.final_build["classes"]:
            self.resolve_subclass(entry)

        for entry in self.final_build["classes"]:
            self.handle_class(entry)

        self.handle_spellcasting()

        self.final_build["total_level"] = sum(
            entry["level"] for entry in self.final_build["classes"]
        )

        # Drop the working reference to the raw class data before saving.
        # The key, name and display name stay until finish_classes, since
        # the ability and hit point steps still read them.
        for entry in self.final_build["classes"]:
            entry.pop("_variant", None)


# -------- BACKGROUND HANDLING ----------------------
    def randomize_bg(self):
        '''
        Default editon = "one" / 5.5e
        '''
        data = self.filehandler.load_json(self.bg_data_path)
        # sort only edition one
        one_edition = []
        for bg in data:
            if "edition" in bg:
                one_edition.append(bg)

        roll = random.randint(0, len(one_edition) - 1)

        bg_data = one_edition[roll]

        return bg_data

    def get_background_data(self, name, edition, source=None):
        data = self.filehandler.load_json(self.bg_data_path)

        for bg in data:
            # Skip backgrounds belonging to another edition
            if bg.get("edition", "classic") != edition:
                continue

            if name != bg["name"]:
                continue

            # Name is not unique on its own — there are two Acolytes and two
            # Archaeologists. Edition separates most of them, source settles
            # the rest, so it's matched whenever the payload provides it.
            if source and bg.get("source") != source:
                continue

            return bg

        return None

    def handle_bg_equipment(self, starting_equipment):
        """
        Fill in the background's equipment.

        The frontend no longer sends any inventory, so every group is
        processed here: granted items always, and each choice group from
        the player's pick, or a roll when the randomizer is on, or left
        unresolved for the sheet.
        """
        granted, choice_groups = self.parse_starting_equipment(starting_equipment)
        self.add_equipment_items(granted)

        for group in choice_groups:
            choice_id = f"bg.equipment.{group['index']}"
            branches = group["branches"]
            if not branches:
                continue

            picked = self.resolved_choice(choice_id)
            key = str(as_list(picked)[0]).upper() if picked else None

            if key not in branches:
                if not self.randomize:
                    self.add_unresolved(
                        "starting_equipment_bg", choice_id,
                        index=group["index"],
                        branches=branches,
                    )
                    continue
                key = random.choice(sorted(branches.keys()))

            self.add_equipment_items(branches[key])

    def build_bg(self, bg_data):

        bg_final = self.final_build["background"]

        name = bg_data.get("name", None)
        feats = bg_data.get("feats", None)
        entries = bg_data.get("entries", None)
        skill_proficiencies = bg_data.get("skill_proficiencies", None)
        tool_proficiencies = bg_data.get("tool_proficiencies", None)
        starting_equipment = bg_data.get("starting_equipment", None)
        ability_score_increase = bg_data.get("ability_score_increase", None)
        language_proficiencies = bg_data.get("language_proficiencies", None)

        bg_final["name"] = name
        bg_final["source"] = bg_data.get("source", None)
        bg_final["edition"] = bg_data.get("edition", "classic")
        bg_final["notes"] = entries

        self.extract_proficiencies(skill_proficiencies, "skill_proficiencies")
        self.extract_proficiencies(tool_proficiencies, "tool_proficiencies")
        self.extract_proficiencies(language_proficiencies, "language_proficiencies")

        if starting_equipment:
            self.handle_bg_equipment(starting_equipment)

        # Ability picks wait for race and class to have their say, so the
        # options are only recorded here. apply_background_asi settles
        # them during finalize(), then drops them from the saved build.
        if ability_score_increase:
            bg_final["ability_options"] = as_list(ability_score_increase)

        for feat in as_list(feats):
            self.apply_feat_token(feat, owner=name)

    def handle_bg(self):

        if self.sel_background:
            name = self.sel_background["name"]
            edition = self.sel_background["edition"]
            source = self.sel_background.get("source")
            bg_data = self.get_background_data(name, edition, source)

            if not bg_data:
                print(f"no background found for {name} {source} {edition}")
                return

            self.build_bg(bg_data)

        elif self.randomize:
            bg_data = self.randomize_bg()
            self.build_bg(bg_data)

        else:
            # Nothing picked and no randomizer: the player fills it in later.
            self.add_unresolved("background", "background")


# -------- ABILITY PRIORITY ----------------------
# Which abilities the chosen classes care about, and how a loose bonus
# point should be spent.

    def primary_abilities(self):
        """
        The abilities the chosen classes lean on.

        `primaryAbility` is a LIST of dicts, and the two levels mean
        different things. The list holds ALTERNATIVES — fighter is
        [{"str": true}, {"dex": true}], str OR dex — while several keys
        inside ONE dict are all primary together, so monk is
        [{"dex": true, "wis": true}].

        For an alternative the higher of the player's own scores wins,
        since that is the one they have already leaned into. With both
        blank the first alternative is taken.

        Only the One D&D data carries primaryAbility, so a classic class
        borrows it from the `one` variant of the same file — the primary
        abilities barely moved between editions.
        """
        base = self.payload.get("base_scores") or {}
        primaries = []

        for entry in self.final_build["classes"]:
            variant = entry.get("_variant") or {}
            alternatives = as_list((variant.get("class") or {}).get("primaryAbility"))

            if not alternatives:
                try:
                    one = (self.load_class_file(entry["key"]) or {}).get("one") or {}
                    alternatives = as_list((one.get("class") or {}).get("primaryAbility"))
                except Exception:
                    alternatives = []

            groups = []
            for alternative in alternatives:
                if not isinstance(alternative, dict):
                    continue
                group = [a for a in alternative if a in ABILITIES and alternative[a]]
                if group:
                    groups.append(group)

            if not groups:
                continue

            if len(groups) == 1:
                primaries.extend(groups[0])
                continue

            # An either/or: take the group whose scores the player has
            # already invested in.
            def group_score(group):
                return max(to_int(base.get(a), 0) for a in group)

            primaries.extend(max(groups, key=group_score))

        return primaries

    def ability_tiers(self):
        """
        Allocation priority for a loose bonus point.

        **con shares the top tier with the primaries.** Nothing lists con
        as primary, but every character needs it, and the
        modifier-gain rule below stops that from wasting points on it:
        con at 8 going to 9 changes no modifier, so a primary at 15
        still wins.
        """
        primaries = set(self.primary_abilities())
        top = primaries | {"con"}
        return {ability: (0 if ability in top else 1) for ability in ABILITIES}

    def fill_order(self):
        """
        The order blank scores get filled, best value first.

        Finer than ability_tiers: a wizard wants int 15 and con 14, not
        the other way round, so the primaries come ahead of con here.
        There is no modifier-gain signal to go on when every score is
        still blank.
        """
        primaries = self.primary_abilities()
        seen = set()
        ordered = []

        for ability in primaries:
            if ability in ABILITIES and ability not in seen:
                seen.add(ability)
                ordered.append(ability)

        if "con" not in seen:
            seen.add("con")
            ordered.append("con")

        ordered.extend(a for a in ABILITIES if a not in seen)
        return ordered

    def ability_cap(self, ability):
        return to_int(
            self.final_build["ability_max_override"].get(ability), 0
        ) or ABILITY_SCORE_CAP

    def pick_ability(self, options, scores, amount, tiers, exclude=()):
        """
        The best ability to put `amount` points into, right now.

        Ranked, best first:

        1. **priority tier** — primaries and con ahead of the rest.
        2. **how much the MODIFIER actually gains.** This is the rule
           that matters. A 15 going to 16 gains +1; an 8 going to 9
           gains nothing, because both are -1. It is why con at 8 loses
           to a primary at 15, and why two points land on the SAME
           all-even ability rather than splitting: the first makes it
           odd and the second then collects the gain.
        3. **the higher current score**, so a key ability ends up strong
           when the gain is a tie.

        Returns None when nothing is left or every candidate is capped.
        """
        best = None
        best_rank = None

        for ability in options:
            if ability not in ABILITIES or ability in exclude:
                continue

            current = to_int(scores.get(ability), 10)
            cap = self.ability_cap(ability)
            if current >= cap:
                continue

            raised = min(current + amount, cap)
            gain = (ability_mod(raised) or 0) - (ability_mod(current) or 0)

            rank = (tiers.get(ability, 1), -gain, -current)
            if best_rank is None or rank < best_rank:
                best_rank = rank
                best = ability

        return best

    def allocate_choice(self, options, amounts, scores, tiers):
        """
        The best way to hand this choice's amounts to distinct abilities,
        as a list of (ability, amount).

        Searched exhaustively, not greedily, because greedy gets the
        headline case wrong. With int 15, con 8 and a +2/+1 to place,
        taking the best single step first puts the +2 on int (15 -> 17,
        one modifier) and leaves the +1 with nowhere useful to go. Giving
        the +2 to con (8 -> 10) and the +1 to int (15 -> 16) gains TWO
        modifiers — and lands both on even numbers.

        The space is tiny: six abilities, at most three amounts.

        Ranked, best first:
          1. total modifier gained
          2. points landing in the top tier (primaries and con)
          3. the resulting total across the top tier, so a tie favours
             the abilities that matter
        """
        amounts = sorted((to_int(a, 0) for a in amounts), reverse=True)
        amounts = [a for a in amounts if a]
        candidates = [a for a in dict.fromkeys(options) if a in ABILITIES]
        if not amounts or not candidates:
            return []

        # Widest first, then narrower. Placing every amount is always
        # preferred, but a capped ability must not block the rest: with
        # int at 20 and only int and con on offer, a +2/+1 should still
        # get its +2 onto con rather than placing nothing at all.
        for width in range(min(len(amounts), len(candidates)), 0, -1):
            chunk = amounts[:width]
            best = []
            best_rank = None

            for combo in itertools.permutations(candidates, width):
                gain = 0
                tier_sum = 0
                tier_top_total = 0
                usable = True

                for ability, amount in zip(combo, chunk):
                    current = to_int(scores.get(ability), 10)
                    cap = self.ability_cap(ability)
                    if current >= cap:
                        usable = False
                        break

                    raised = min(current + amount, cap)
                    gain += (ability_mod(raised) or 0) - (ability_mod(current) or 0)

                    tier = tiers.get(ability, 1)
                    tier_sum += tier
                    if tier == 0:
                        tier_top_total += raised

                if not usable:
                    continue

                rank = (gain, -tier_sum, tier_top_total)
                if best_rank is None or rank > best_rank:
                    best_rank = rank
                    best = list(zip(combo, chunk))

            if best:
                return best

        return []


# -------- BASE SCORES ----------------------
    def fill_missing_base_scores(self, scores):
        """
        Fill the blanks the player left, when the randomizer is on.

        `ability_method` decides how. The value is matched loosely rather
        than against an exact enum, so a spelling change on the frontend
        does not silently fall through to the wrong branch:

          standard   the array values they have NOT used, highest to the
                     highest-priority blank
          point buy  every blank starts at 8, and whatever budget they
                     have left is spent by priority
          roll       3d6 each, no drop, best roll to the highest priority
          custom     the same as roll — there is no array to work from
        """
        blanks = [a for a in ABILITIES if scores.get(a) is None]
        if not blanks:
            return

        if not self.randomize:
            # Left blank on purpose; the sheet will prompt for them.
            self.add_unresolved(
                "base_scores", "base_scores",
                abilities=blanks, method=self.payload.get("ability_method"),
            )
            return

        method = squash(self.payload.get("ability_method"))
        order = [a for a in self.fill_order() if a in blanks]

        if "standard" in method:
            self.fill_from_standard_array(scores, order)
        elif "point" in method or "buy" in method:
            self.fill_from_point_buy(scores, order)
        else:
            self.fill_from_rolls(scores, order)

    def fill_from_standard_array(self, scores, order):
        """
        Hand out the array values the player has not already used.

        Their own entries are removed from the pool one at a time, so two
        14s on the sheet consume both 14s. If they typed values that are
        not in the array at all the pool runs short, and the remainder
        falls back to rolling rather than inventing numbers.
        """
        pool = list(STANDARD_ARRAY)
        for ability in ABILITIES:
            value = scores.get(ability)
            if value is not None and value in pool:
                pool.remove(value)

        pool.sort(reverse=True)

        for ability in order:
            if not pool:
                break
            scores[ability] = pool.pop(0)

        leftover = [a for a in order if scores.get(a) is None]
        if leftover:
            self.fill_from_rolls(scores, leftover)

    def fill_from_point_buy(self, scores, order):
        """
        Spend whatever budget is left on the blanks.

        Everything starts at 8 and costs climb past 13, so the 27 points
        do not buy six 15s. What the player already spent is deducted
        first, then the rest goes by priority — using the same
        modifier-gain rule, so a point that would only make a score odd
        waits for the one that pairs with it.
        """
        spent = 0
        for ability in ABILITIES:
            value = scores.get(ability)
            if value is None:
                continue
            clamped = max(POINT_BUY_MIN, min(to_int(value, POINT_BUY_MIN), POINT_BUY_MAX))
            spent += POINT_BUY_COST.get(clamped, 0)

        for ability in order:
            scores[ability] = POINT_BUY_MIN

        remaining = POINT_BUY_BUDGET - spent
        tiers = self.ability_tiers()

        while remaining > 0:
            affordable = []
            for ability in order:
                current = to_int(scores.get(ability), POINT_BUY_MIN)
                if current >= POINT_BUY_MAX:
                    continue
                step = POINT_BUY_COST[current + 1] - POINT_BUY_COST[current]
                if step <= remaining:
                    affordable.append((ability, step))

            if not affordable:
                break

            ability = self.pick_ability(
                [a for a, _ in affordable], scores, 1, tiers
            )
            if ability is None:
                break

            step = dict(affordable)[ability]
            scores[ability] = to_int(scores.get(ability), POINT_BUY_MIN) + 1
            remaining -= step

    def fill_from_rolls(self, scores, order):
        """3d6 with no drop, best roll to the highest-priority blank."""
        rolls = sorted(
            (sum(random.randint(1, 6) for _ in range(3)) for _ in order),
            reverse=True,
        )
        for ability, value in zip(order, rolls):
            scores[ability] = value


# -------- ABILITY CHOICES ----------------------
    def defer_ability_choice(self, choice_id, options, amounts,
                             target="ability_bonuses", owner=None, cap=0,
                             **extra):
        """
        Park a `{choose: ...}` ability bonus instead of settling it now.

        Race, background and feat bonuses all arrive while their own
        source is being read, long before the final scores exist.
        Choosing there would mean choosing blind, so they queue up and
        allocate_ability_choices settles them at the end with the whole
        character in view.

        `amounts` is a list, one entry per ability to be chosen, each
        the size of that bonus. A plain "+1 to two abilities" is [1, 1];
        a background's +2/+1 split is [2, 1]. Keeping them in one choice
        is what guarantees they go to DIFFERENT abilities — queued as two
        separate choices, both would pick the same best target.
        """
        amounts = [to_int(a, 1) for a in as_list(amounts) if to_int(a, 0)]
        if not amounts:
            return

        self.final_build["pending_ability_choices"].append({
            "id": choice_id,
            "owner": owner,
            "options": [a for a in as_list(options) if a in ABILITIES],
            "amounts": amounts,
            "target": target,
            "max": to_int(cap, 0),
            **extra,
        })

    def allocate_ability_choices(self, scores):
        """
        Settle every parked ability choice by priority.

        Choices are taken biggest-bonus-first, because where a +2 lands
        changes what a later +1 is worth. Within one choice the
        abilities are distinct and its own amounts also descend.

        Without the randomizer nothing is chosen — each one is reported
        with its real options so the sheet can ask.
        """
        pending = self.final_build["pending_ability_choices"]
        if not pending:
            return

        if not self.randomize:
            for choice in pending:
                self.add_unresolved(
                    choice.get("key") or "ability_bonuses", choice["id"],
                    owner=choice.get("owner"),
                    options=choice["options"],
                    amounts=choice["amounts"],
                    feat=choice.get("feat"),
                )
            return

        for choice in sorted(pending, key=lambda c: -max(c["amounts"])):
            target = self.final_build.setdefault(choice["target"], {})
            tiers = self.ability_tiers()

            placed = self.allocate_choice(
                choice["options"] or list(ABILITIES),
                choice["amounts"], scores, tiers,
            )

            for ability, amount in placed:
                scores[ability] = to_int(scores.get(ability), 10) + amount
                target[ability] = target.get(ability, 0) + amount

                if choice["max"]:
                    overrides = self.final_build["ability_max_override"]
                    overrides[ability] = max(
                        to_int(overrides.get(ability), 0), choice["max"]
                    )

            unplaced = sorted(choice["amounts"], reverse=True)[len(placed):]
            if unplaced:
                self.add_unresolved(
                    choice.get("key") or "ability_bonuses", choice["id"],
                    owner=choice.get("owner"),
                    options=choice["options"],
                    amounts=unplaced,
                    reason="no eligible ability left below its cap",
                )


# -------- DERIVED STATS ----------------------
# Everything here depends on race, background AND classes having run, so
# it happens last.

    def apply_background_asi(self):
        """
        A 2024 background lists three abilities; the player takes +2/+1
        across two of them, or +1 to all three. Held back until now
        because it lands in the same pot as racial and class bonuses.

        The options are read and then removed from the background here,
        since nothing after this step needs them.
        """
        bg = self.final_build["background"]
        options = bg.pop("ability_options", None) or []
        if not options:
            return

        bonuses = self.final_build["ability_bonuses"]
        selection = self.choices.get("bg.asi")

        if isinstance(selection, dict):
            if selection.get("mode") == "1-1-1":
                for ability in options:
                    if ability in ABILITIES:
                        bonuses[ability] = bonuses.get(ability, 0) + 1
                return

            picks = [pick for pick in as_list(selection.get("picks")) if pick]
            if len(picks) >= 2:
                bonuses[picks[0]] = bonuses.get(picks[0], 0) + 2
                bonuses[picks[1]] = bonuses.get(picks[1], 0) + 1
                return

        # The 2-1 split is assumed over 1-1-1: two points into one
        # ability is usually worth more than three scattered +1s. Both
        # halves are parked so the +2 is placed before the +1, which is
        # what makes the +1 land where it still gains a modifier.
        self.defer_ability_choice(
            "bg.asi", options, [2, 1],
            target="ability_bonuses", owner=bg.get("name"),
            key="ability_score_increase_bg",
        )

    def build_ability_scores(self):
        """
        Base score plus every accumulated bonus, with the modifier.

        The base numbers are kept in final_build["base_scores"] so they
        stay recoverable — fusing them into a total would make the
        racial, background and feat contributions impossible to unpick.
        A score still null means the player left it blank and the
        randomizer was off.
        """
        base = self.final_build.get("base_scores") or {}
        bonuses = self.final_build["ability_bonuses"]
        # Feat bonuses are collected separately so each feat's
        # contribution stays visible; they merge in only here.
        feat_bonuses = self.final_build["feat_ability_bonuses"]
        saves = set(self.final_build["saving_throw_proficiencies"])
        overrides = self.final_build["ability_max_override"]

        scores = {}
        for key in ABILITIES:
            raw = base.get(key)
            score = None if raw is None else (
                to_int(raw, 0) + bonuses.get(key, 0) + feat_bonuses.get(key, 0)
            )

            # A capstone can raise the ceiling past 20 (barbarian's sets 25).
            cap = overrides.get(key)
            if score is not None and cap:
                score = min(score, cap)

            row = {
                "score": score,
                "mod": ability_mod(score),
                "check_mod": 0,
                "save_mod": 0,
                "proficient": key in saves,
                "expertise": False,
                "label": DEFAULT_ABILITY_SCORES[key]["label"],
                # Computed by the cards at render time, stored null as in
                # the save file.
                "check": None,
                "save": None,
            }
            if cap:
                row["max_override"] = cap
            scores[key] = row

        self.final_build["ability_scores"] = scores

    def build_skills(self):
        """
        Every skill, not only the proficient ones, so the sheet has a
        complete row set. Expertise implies proficiency.
        """
        proficient = {norm_value(s, "skills") for s in self.final_build["skill_proficiencies"]}
        expertise = {norm_value(s, "skills") for s in self.final_build["skill_expertise"]}

        skills = {}
        for key, (label, ability) in DEFAULT_SKILLS.items():
            skills[key] = {
                "value": None,
                "proficient": key in proficient or key in expertise,
                "expertise": key in expertise,
                "label": label,
                "ability": ability,
            }

        # A skill the data knows about that DEFAULT_SKILLS does not —
        # added rather than dropped, the way the sheet's custom-skill
        # flow does it.
        for key in sorted((proficient | expertise) - set(skills)):
            if not key:
                continue
            skills[key] = {
                "value": None,
                "proficient": True,
                "expertise": key in expertise,
                "label": title_case(key),
                "ability": "Intelligence",
            }

        self.final_build["skills"] = skills

    def build_hit_points(self):
        """
        Max HP.

        Level 1 of the FIRST class takes the die's maximum; every later
        level takes a stored roll when the player chose to roll, and the
        die's average otherwise (d8 -> 5). CON applies per level, and a
        level can never give less than 1 HP — which only matters with a
        negative CON modifier, hence the floor per level rather than
        adding CON × total level at the end.
        """
        hp = self.payload.get("hp") or {}
        mode = hp.get("mode") or "average"

        if mode == "manual":
            total = max(0, to_int(hp.get("manual"), 0))
        else:
            rolls = hp.get("rolls") or {}
            con = to_int(
                (self.final_build.get("ability_scores") or {}).get("con", {}).get("mod"), 0
            )

            total = 0
            first_level = True

            for entry in self.final_build["classes"]:
                maximum = die_faces(entry.get("hit_dice"))
                average = (maximum // 2) + 1 if maximum else 0
                class_rolls = as_list(rolls.get(entry["key"]))

                for index in range(entry["level"]):
                    if first_level:
                        base = maximum
                    elif mode == "roll" and index < len(class_rolls):
                        base = to_int(class_rolls[index], average)
                    else:
                        # Levels the randomizer added have no stored roll.
                        base = average

                    total += max(1, base + con)
                    first_level = False

        self.final_build["health"] = {
            "current_hp": total,
            "max_hp": total,
            "temp_hp": 0,
            "barrier": 0,
            "max_hp_mod": 0,
        }

    def summarize_hit_dice(self):
        """Classes sharing a die are merged, as the sheet displays them."""
        totals = {}
        for entry in self.final_build["classes"]:
            die = str(entry.get("hit_dice") or "").lower()
            level = entry["level"]
            if not level or not die_faces(die):
                continue
            running = totals.get(die, {}).get("max", 0) + level
            totals[die] = {"max": running, "current": running}
        return totals

    def build_derived(self):
        """
        Proficiency bonus, XP and hit dice — all functions of the TOTAL
        character level, not of any one class's level.
        """
        total = self.final_build["total_level"]

        standard = 2 + max(0, total - 1) // 4 if total > 0 else 2
        self.final_build["pb"] = {
            "standard": standard,
            "modifier": 0,
            "total": standard,
        }

        self.final_build["exp"] = (
            XP_BY_LEVEL[min(total, MAX_CHARACTER_LEVEL)] if total > 0 else 0
        )
        self.final_build["hit_dice"] = self.summarize_hit_dice()

        dex = to_int(
            (self.final_build.get("ability_scores") or {}).get("dex", {}).get("mod"), 0
        )
        self.final_build["initiative"] = {"mod": 0, "total": dex}

    def prune_spells(self):
        """
        Drop race and feat spells the character is not high enough for.
        Their available_at is a CHARACTER level, unknown until classes
        have run. Class spells were filtered against the class level on
        the way in.
        """
        total = self.final_build["total_level"]
        self.final_build["spellbook"]["spells"] = [
            spell for spell in self.final_build["spellbook"]["spells"]
            if spell.get("_scope") not in ("race", "feat")
            or spell.get("available_at") is None
            or to_int(spell["available_at"], 0) <= total
        ]

    def resolve_spell_uses(self):
        """
        Turn each limited spell's raw count into a number, now that the
        proficiency bonus and ability modifiers are known:

          "2"                  -> 2
          "1e"                 -> 1   (one of each)
          "proficiency_bonus"  -> the PB total
          "int" / "cha" / ...  -> that modifier, at least 1

        Also strips the working keys so they never reach the save file.
        """
        pb = to_int((self.final_build.get("pb") or {}).get("total"), 2)
        scores = self.final_build.get("ability_scores") or {}

        for spell in self.final_build["spellbook"]["spells"]:
            raw = spell.pop("_count", None)
            spell.pop("_scope", None)

            uses = spell.get("uses")
            if not uses:
                continue

            text = str(raw if raw is not None else 1).strip().lower()
            if text == "proficiency_bonus":
                count = pb
            elif text in ABILITIES:
                count = to_int((scores.get(text) or {}).get("mod"), 0)
            else:
                count = to_int(re.sub(r"[^0-9]", "", text), 1)

            count = max(1, count)
            uses["max"] = count
            uses["current"] = count

    def assign_spell_ids(self):
        """Every spell row gets an id once the list is final."""
        for spell in self.final_build["spellbook"]["spells"]:
            spell["id"] = self.next_row_id()


    def finish_classes(self):
        """
        Shape each class row the way the class panel reads it: an id, the
        class_name, and hit_dice_overridden. Working keys are dropped
        here, after the last step that reads them.
        """
        for entry in self.final_build["classes"]:
            entry["id"] = self.next_id()
            entry["class_name"] = entry.get("display_name") or title_case(entry.get("key"))
            entry["hit_dice_overridden"] = False
            for key in ("key", "name", "display_name", "feats", "randomized"):
                entry.pop(key, None)

    def finalize(self):
        """
        Everything that needs the whole character in view.

        The ability work has to happen in this order. Base scores are
        settled first, because the primary-ability either/or (fighter's
        str OR dex) is decided from them. Then every parked bonus choice
        is allocated against those scores, so a +1 can be placed where
        it actually gains a modifier. Only then are the final scores
        computed — and HP after that, since it needs the CON modifier.

        The shaping steps come last, because the steps above still read
        class keys and background options.
        """
        scores = {
            ability: (self.payload.get("base_scores") or {}).get(ability)
            for ability in ABILITIES
        }
        self.fill_missing_base_scores(scores)
        self.final_build["base_scores"] = scores

        self.apply_background_asi()
        self.allocate_ability_choices(
            {a: to_int(scores.get(a), 10) for a in ABILITIES}
        )


        self.build_ability_scores()
        self.build_skills()
        self.build_hit_points()
        self.build_derived()

        self.prune_spells()
        self.resolve_spell_uses()
        self.assign_spell_ids()
        self.finish_classes()


# -----------------------------------------------------
    def run(self):
        self.handle_race()
        self.handle_bg()
        self.handle_classes()
        self.finalize()

        # self.filehandler.save_json(os.path.join(TEST_DIR, "contruct_char"), self.payload)
        # self.filehandler.save_json(os.path.join(TEST_DIR, "final_char"), self.final_build)

        self.filehandler.save_json(self.save_path, self.final_build)


if __name__ == "__main__":
    loadpath = os.path.join(TEST_DIR, "test_char")
    data = FileHandler().load_json(loadpath)

    adjuster = CharacterAdjuster(
        payload=data,
        user_name="me",
        char_name="tester",
        save_path="something",
    )

    adjuster.run()