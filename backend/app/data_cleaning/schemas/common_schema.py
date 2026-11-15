"""The final shape of the parts every category shares: grants and choices.

The code cleaners build these from raw 5etools keys, and the result is checked
against these models before it is written, so a mistake in a cleaner shows
up as a clear error instead of a quietly wrong file.

Ids
  entry ids        name-source, lowercase, dashes:  "holy-symbol-xphb"
  grant ids        snake_case:                      "animal_handling", "thieves_tools"
  group ids        plural snake_case, one table:    "standard_languages", "gaming_sets"

A choice is one of three types:
  pool      pick `count` from a list, a group or a filter
  ability   give one of the `bonus_sets` to different abilities
  bundle    pick one option; each option has its own grants and choices

`{"choice": "<choice id>"}` anywhere a value goes means "whatever was
picked in that choice" (e.g. a spell's spellcasting ability).
"""

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field

Ability = Literal["str", "dex", "con", "int", "wis", "cha"]

# Named groups a pool can pick from. One table, never repeated in data.
GROUPS = {
    "all_skills", "all_tools", "all_languages", "standard_languages", "rare_languages",
    "artisans_tools", "gaming_sets", "musical_instruments", "vehicles",
    "simple_weapons", "martial_weapons", "all_weapons", "all_feats", "all",
    "proficient_skills", "proficient_skills_tools",
    "arcane_focuses", "druidic_focuses", "holy_symbols",
}


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChoiceRef(Strict):
    choice: str


# ---------- grants ----------

class FeatGrant(Strict):
    feat: str                      # "magic-initiate-xphb"
    option: str | None = None      # "cleric"


class SpellGrant(Strict):
    spell: str                                      # "fire-bolt-xphb"
    how: Literal["known", "prepared", "list", "item"]   # item: cast from the item that grants it
    at: int | None = None                           # character level it unlocks (1 if neither is set)
    at_spell_level: int | None = None               # or: once you can cast spells of this level
    uses: dict | Literal["at_will", "ritual"] | None = None   # {"max": 1|"pb", "reset": "short"|"long"}
    cast_at: int | None = None                      # cast as a spell of this level
    ability: Ability | ChoiceRef | None = None


class Currency(Strict):
    pp: int | None = None
    gp: int | None = None
    ep: int | None = None
    sp: int | None = None
    cp: int | None = None


class ItemGrant(Strict):
    item: str | None = None        # catalogue id; None for a free-text item
    name: str | None = None        # shown name ("Book (Prayers)", "sticks of incense")
    qty: int = 1
    contains: Currency | None = None   # a pouch with coins in it
    worth: Currency | None = None      # "a trinket worth 10 gp"


class Defenses(Strict):
    resist: list[str] = []
    immune: list[str] = []
    vulnerable: list[str] = []
    condition_immune: list[str] = []


class Grants(Strict):
    ability: dict[Ability, int] | None = None
    skills: list[str] | None = None
    expertise: list[str] | None = None
    saves: list[Ability] | None = None
    tools: list[str] | None = None
    languages: list[str] | None = None
    weapons: list[str] | None = None
    armor: list[str] | None = None
    feats: list[FeatGrant] | None = None
    spells: list[SpellGrant] | None = None
    items: list[ItemGrant] | None = None
    currency: Currency | None = None
    speed: dict[str, int | str] | None = None
    senses: dict[str, int] | None = None
    senses_bonus: dict[str, int] | None = None     # "+60 ft. darkvision" on top of what you have
    optional_features: list[str] | None = None     # known without picking (Elemental Attunement)
    spell_lists: list[dict] | None = None          # whole lists added to your class list: {"at": 3, "filter": {...}}
    defenses: Defenses | None = None


# ---------- choices ----------

GrantKind = Literal["skills", "expertise", "tools", "languages", "weapons", "armor", "feats", "spells",
                    "items", "saves", "defenses.resist", "spell_ability", "size", "optional_features",
                    "subclass", "weapon_masteries", "features"]


class PoolChoice(Strict):
    type: Literal["pool"] = "pool"
    id: str
    label: str
    grant: GrantKind | list[GrantKind]           # a list for mixed pools ("a skill or a tool")
    count: int = 1
    from_: Annotated[list[str] | str | dict, Field(alias="from")]
    # extra info when the pool is spells
    how: Literal["known", "prepared", "list"] | None = None
    at: int | None = None
    at_spell_level: int | None = None
    uses: dict | Literal["at_will", "ritual"] | None = None
    ability: Ability | ChoiceRef | None = None

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class AbilityChoice(Strict):
    type: Literal["ability"] = "ability"
    id: str
    label: str
    from_: Annotated[list[Ability], Field(alias="from")]
    bonus_sets: list[list[int]]
    max: int | None = None          # highest the score may go (default 20; epic boons 30)
    note: str | None = None         # e.g. "an ability you lack saving throw proficiency in"

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Option(Strict):
    id: str
    label: str
    grants: Grants = Grants()
    choices: list["Choice"] = []


class BundleChoice(Strict):
    type: Literal["bundle"] = "bundle"
    id: str
    label: str
    options: list[Option]


Choice = Annotated[Union[PoolChoice, AbilityChoice, BundleChoice], Field(discriminator="type")]
Option.model_rebuild()


# ---------- the parts every entry has ----------

class Reprint(Strict):
    kind: str
    id: str


class EntryHeader(Strict):
    id: str
    kind: str
    name: str
    source: str
    edition: Literal["classic", "one"]
    srd: dict[Literal["5.1", "5.2"], str] | None = None
    reprinted_as: list[str | Reprint] | None = None
    aliases: list[str] | None = None
    tags: list[str] | None = None
    campaigns: list[str] | None = None
    text: str | None = None                     # made by code from the 5etools text (text_renderer.py)


def dump(model: BaseModel) -> dict:
    """The model as plain JSON data, without empty parts."""
    return _drop_empty(model.model_dump(by_alias=True, exclude_none=True))


def _drop_empty(obj):
    if isinstance(obj, dict):
        out = {k: _drop_empty(v) for k, v in obj.items()}
        return {k: v for k, v in out.items() if v not in ([], {}, None)}
    if isinstance(obj, list):
        return [_drop_empty(v) for v in obj]
    return obj
