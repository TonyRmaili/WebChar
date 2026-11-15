"""The final shape of a feat, as written by the code cleaner.

`text` and `features` are added later by the LLM step.

prerequisites: a list of groups. ANY one group is enough; inside a group
ALL parts are needed. Inside a part that is a list (ability, race,
proficiency…), any one item is enough.

    [{"level": 4, "ability": [{"str": 13}, {"dex": 13}]}, {"spellcasting": true}]
    = (level 4 and Str 13 or Dex 13)  or  can cast spells

The builder warns about unmet prerequisites (it never blocks); the
randomizer can respect the checkable ones. `campaign` and `note` are text
only.

options: like a race's subraces. "Magic Initiate" -> Cleric / Druid /
Wizard. A feat granted as {"feat": "magic-initiate-xphb", "option":
"cleric"} has that option picked already.
"""

from typing import Literal

from .common_schema import Choice, EntryHeader, Grants, Strict

Category = Literal["general", "origin", "epic_boon", "fighting_style", "dragonmark", "dark_gift"]


class RaceReq(Strict):
    race: str | None = None        # "elf"
    subrace: str | None = None     # "drow"
    size: str | None = None        # "a Small race"


class Prerequisite(Strict):
    level: int | None = None
    class_level: list[dict] | None = None              # [{"class": "warlock", "level": 5, "subclass"?: "…"}]
    ability: list[dict[str, int]] | None = None        # any one: [{"str": 13}, {"dex": 13}]
    race: list[RaceReq] | None = None                  # any one
    background: list[str] | None = None                # any one, ids
    feat: list[str] | None = None                      # any one, ids
    feat_category: list[Category] | None = None        # has a feat of this category
    no_other_feat_category: list[Category] | None = None   # "no other dragonmark feat"
    feature: list[str] | None = None                   # any one: ["fighting_style"]
    spellcasting: bool | None = None                   # can cast at least one spell
    proficiency: list[dict] | None = None              # any one: [{"armor": "medium"}]
    optional_feature: list[str] | None = None          # has one of these, ids
    pact: list[str] | None = None                      # warlock pact boon: ["blade"]
    spell: list[str] | None = None                     # knows one of these, ids
    item: list[str] | None = None                      # text only: "A suit of armor (requires attunement)"
    campaign: list[str] | None = None                  # text only
    note: str | None = None                            # text only


class FeatOption(EntryHeader):
    grants: Grants = Grants()
    choices: list[Choice] = []
    replaces: list[str] | None = None
    replaces_text: list[str] | None = None


class Feat(EntryHeader):
    category: Category | None = None    # empty for classic feats
    repeatable: bool = False
    prerequisites: list[Prerequisite] | None = None
    grants: Grants = Grants()
    choices: list[Choice] = []
    options: list[FeatOption] | None = None
