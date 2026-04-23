from pydantic import BaseModel, Field
from typing import Literal, Optional, Union



Ability = Literal["str", "dex", "con", "int", "wis", "cha"]
Size = Literal["tiny", "small", "medium", "large"]


class Speed(BaseModel):
    walk: Optional[int]
    fly: Optional[int]
    swim: Optional[int]
    climb: Optional[int]
    burrow: Optional[int]
    hover: Optional[bool]


class Senses(BaseModel):
    darkvision: Optional[int]
    tremorsense: Optional[int]
    blindsight: Optional[int]
    truesight: Optional[int]


class ChooseBlock(BaseModel):
    options: Union[list[str], str]
    count: int
    amount: Optional[int]


class AbilityFixed(BaseModel):
    strength: Optional[int] = Field(alias="str")
    dexterity: Optional[int] = Field(alias="dex")
    constitution: Optional[int] = Field(alias="con")
    intelligence: Optional[int] = Field(alias="int")
    wisdom: Optional[int] = Field(alias="wis")
    charisma: Optional[int] = Field(alias="cha")

    model_config = {"populate_by_name": True}


class AbilityBonus(BaseModel):
    fixed: AbilityFixed
    choose: Optional[ChooseBlock]


class Defenses(BaseModel):
    resistances: list[str]
    immunities: list[str]
    vulnerabilities: list[str]
    condition_advantages: list[str]


class ProficiencyGroup(BaseModel):
    fixed: list[str]
    choose: Optional[ChooseBlock]


class WeaponArmorGroup(BaseModel):
    fixed: list[str]
    categories: list[str]


class Proficiencies(BaseModel):
    languages: ProficiencyGroup
    skills: ProficiencyGroup
    tools: ProficiencyGroup
    weapons: WeaponArmorGroup
    armor: WeaponArmorGroup


class SpellUses(BaseModel):
    type: Literal["at_will", "per_short_rest", "per_long_rest", "class_list_addition"]
    count: Union[int, str, None]


class Spell(BaseModel):
    name: str
    level_available: int
    uses: SpellUses
    category: Literal["innate", "expanded"]


class Trait(BaseModel):
    name: str
    notes: str


class SubRace(BaseModel):
    name: str
    display_name: str
    source: str

    sizes: Optional[list[Size]]
    speed: Optional[Speed]
    senses: Optional[Senses]
    abilities: Optional[AbilityBonus]
    defenses: Optional[Defenses]
    proficiencies: Optional[Proficiencies]
    spells: list[Spell]
    spell_ability: Optional[Union[Ability, ChooseBlock]]
    traits: list[Trait]


class Race(BaseModel):
    name: str
    source: str
    creature_type: str
    sizes: list[Size]
    speed: Speed
    senses: Senses
    abilities: AbilityBonus
    defenses: Defenses
    proficiencies: Proficiencies
    spells: list[Spell]
    spell_ability: Optional[Union[Ability, ChooseBlock]]
    traits: list[Trait]
    sub_races: list[SubRace]