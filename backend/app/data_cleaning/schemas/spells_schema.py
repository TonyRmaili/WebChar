"""The final shape of a spell, as written by the code cleaner.

`text` and `features` are added later by the LLM step (damage, saves,
healing, upcasting, toggles for buffs).

    level        0 = cantrip
    time         [{"number": 1, "unit": "action"}]; unit is action,
                 bonus_action, reaction, minute or hour. A reaction keeps its
                 `trigger` text.
    range        {"type": "feet", "amount": 150} · {"type": "touch"} ·
                 {"type": "self", "area": {"shape": "cone", "size": 15}}
    components   {"v": true, "s": true, "m": "a pinch of sand"} or, with a
                 cost: "m": {"text": …, "cost": {"gp": 10}, "consumed": true}
    duration     [{"type": "timed", "amount": 1, "unit": "minute", "concentration": true}]
    classes      class ids whose spell list has it: ["wizard-xphb", "sorcerer-xphb"]
    filters      5etools' search tags, with readable names; for the catalogue only
"""

from typing import Literal

from .common_schema import EntryHeader, Strict

School = Literal["abjuration", "conjuration", "divination", "enchantment", "evocation",
                 "illusion", "necromancy", "transmutation"]


class CastTime(Strict):
    number: int
    unit: Literal["action", "bonus_action", "reaction", "minute", "hour", "round"]
    trigger: str | None = None      # reactions: "which you take when …"
    note: str | None = None         # a named casting option (Plant Growth: "Overgrowth")


class Area(Strict):
    shape: str                      # cone, line, cube, sphere, emanation, radius, hemisphere, …
    size: int | None = None
    unit: str = "feet"


class Range(Strict):
    type: Literal["feet", "miles", "self", "touch", "sight", "unlimited", "special"]
    amount: int | None = None
    area: Area | None = None


class Material(Strict):
    text: str
    cost: dict[str, int] | None = None              # {"gp": 10}
    consumed: bool | Literal["optional"] = False


class Components(Strict):
    v: bool = False
    s: bool = False
    r: bool | None = None                           # royalty (Acquisitions Incorporated)
    m: str | Material | None = None


class Duration(Strict):
    type: Literal["instant", "timed", "permanent", "special"]
    amount: int | None = None
    unit: Literal["round", "minute", "hour", "day"] | None = None
    concentration: bool = False
    up_to: bool | None = None                       # "up to 1 minute"
    ends: list[Literal["dispel", "trigger"]] | None = None


class Filters(Strict):
    damage: list[str] | None = None                 # damage types it deals
    conditions: list[str] | None = None             # conditions it can cause
    saves: list[str] | None = None                  # "dex"
    checks: list[str] | None = None                 # ability checks it calls for
    attack: list[Literal["melee", "ranged"]] | None = None
    area: list[str] | None = None                   # single_target, sphere, cone, …
    creature_types: list[str] | None = None         # only affects these
    gives_resist: list[str] | None = None
    gives_immune: list[str] | None = None
    gives_vulnerable: list[str] | None = None
    gives_condition_immune: list[str] | None = None
    tags: list[str] | None = None                   # summons_creature, healing, …


class Spell(EntryHeader):
    level: int
    school: School
    ritual: bool = False
    time: list[CastTime]
    range: Range
    components: Components
    duration: list[Duration]
    classes: list[str] | None = None
    filters: Filters = Filters()
