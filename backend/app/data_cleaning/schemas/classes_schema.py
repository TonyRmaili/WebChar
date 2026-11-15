"""The final shape of a class and a subclass, as written by the code cleaner.

Every class has its own file, and so do its subclasses:
    final/classes/fighter-phb.json      the class
    final/subclasses/fighter-phb.json   its subclasses (any book), each with `class_id`

A level table is {"<class level>": value}, listing only the levels where
the value changes; the value for a level is the one at the highest listed
level not above it. {"1": "1d6", "5": "1d8"} = 1d6 at levels 1-4, 1d8 from 5.

The LLM step adds the mechanics of `features` (category, uses, action,
toggle, modifiers, choices…) and fills in what code can't know about
`resources` (when they refill, pools only the text describes).
"""

from typing import Literal

from .common_schema import Ability, Choice, EntryHeader, Grants, Strict
from .optionalfeatures_schema import Consumes

LevelTable = dict[str, int | str | list[int]]


class Column(Strict):
    """One column of the class table, for display. Ids mean the same thing
    in both editions (Ki Points and Focus Points are both `focus_points`)."""
    id: str
    name: str
    values: LevelTable


class Resource(Strict):
    """A pool that features or optional features spend (`consumes`)."""
    id: str                                   # "focus_points", shared with optional features and spells
    name: str
    max: LevelTable | str | None = None       # level table, or a formula ("cha_mod", "5 * class_level")
    die: LevelTable | str | None = None       # dice pools: {"3": "d8", "10": "d10"}
    reset: Literal["short", "long"] | None = None      # None: not known from the data (the LLM fills it)
    short_rest: Literal["all"] | int | None = None     # what a short rest gives back when reset is "long"


class Spellcasting(Strict):
    ability: Ability | None = None
    progression: Literal["full", "half", "half_up", "third", "pact"] | None = None
    list: str | None = None                   # class id the spells' `classes` use ("wizard-xphb")
    cantrips: LevelTable | None = None
    prepared: LevelTable | str | None = None  # a table, or a formula: "class_level + wis_mod"
    known: LevelTable | None = None           # 2014 known casters
    change: Literal["level", "long_rest"] | None = None
    slots: LevelTable | None = None           # {"1": [2], "2": [3], "3": [4, 2], …}
    pact: dict[str, LevelTable] | None = None # {"slots": {...}, "level": {...}}
    arcanum: dict[str, int] | None = None     # Mystic Arcanum: {"11": 6, "13": 7, …}
    spellbook: dict[str, int] | None = None   # Wizard: {"first": 6, "per_level": 2}


class Level(Strict):
    """What you get at one class level."""
    level: int
    features: list[str] = []                  # feature ids
    upgrades: list[str] = []                  # earlier features that get better here ("Extra Attack (2)")
    choices: list[Choice] = []                # subclass, feats, optional features, weapon masteries
    grants: Grants = Grants()
    subclass_features: bool | None = None     # true: your subclass gives its next feature here


class Feature(Strict):
    """The code part of a feature. The LLM adds its mechanics."""
    id: str                                   # "monk-xphb:flurry-of-blows"
    name: str
    level: int
    source: str | None = None                 # only when it differs from its class or subclass
    text: str = ""
    parent: str | None = None                 # the feature it is part of (Monk's Focus -> Flurry of Blows)
    optional: bool | None = None              # true: a TCE optional class feature (raw isClassFeatureVariant)
    consumes: Consumes | None = None
    srd: dict[Literal["5.1", "5.2"], str] | None = None


class HitPoints(Strict):
    first: str                                # "8 + con_mod"
    per_level: str                            # "5 + con_mod"


class Multiclass(Strict):
    requires: list[dict[Ability, int]] = []   # any one group; every ability in it
    grants: Grants = Grants()
    choices: list[Choice] = []


class SubclassInfo(Strict):
    title: str
    level: int | None = None
    text: str | None = None


class ClassEntry(EntryHeader):
    hit_die: str
    hp: HitPoints
    primary_ability: list[list[Ability]] = []
    saves: list[Ability] = []
    grants: Grants = Grants()
    choices: list[Choice] = []
    starting_gold: str | None = None          # 2014: rolled gold instead of the equipment, "5d4 × 10"
    multiclass: Multiclass = Multiclass()
    subclass: SubclassInfo
    columns: list[Column] = []
    resources: list[Resource] = []
    spellcasting: Spellcasting | None = None
    progression: list[Level] = []
    features: list[Feature] = []


class SubclassEntry(EntryHeader):
    class_id: str
    short_name: str
    grants: Grants = Grants()
    choices: list[Choice] = []
    columns: list[Column] = []
    resources: list[Resource] = []
    spellcasting: Spellcasting | None = None
    progression: list[Level] = []
    features: list[Feature] = []
