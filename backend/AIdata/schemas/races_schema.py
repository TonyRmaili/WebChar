from pydantic import BaseModel, Field
from typing import Literal, Optional, Union

Ability = Literal["str", "dex", "con", "int", "wis", "cha"]
Size = Literal["tiny", "small", "medium", "large"]


class Speed(BaseModel):
    walk: Optional[int] = None
    fly: Optional[int] = None
    swim: Optional[int] = None
    climb: Optional[int] = None
    burrow: Optional[int] = None
    hover: Optional[bool] = None


class Senses(BaseModel):
    darkvision: Optional[int] = None
    tremorsense: Optional[int] = None
    blindsight: Optional[int] = None
    truesight: Optional[int] = None


class ChooseBlock(BaseModel):
    options: Union[list[str], str]
    count: int = 1
    amount: Optional[int] = None


class AbilityBonus(BaseModel):
    fixed: dict[str, int] = Field(default_factory=dict)
    choose: Optional[ChooseBlock] = None


class Defenses(BaseModel):
    resistances: list[str] = Field(default_factory=list)
    immunities: list[str] = Field(default_factory=list)
    vulnerabilities: list[str] = Field(default_factory=list)
    condition_advantages: list[str] = Field(default_factory=list)


class ProficiencyGroup(BaseModel):
    fixed: list[str] = Field(default_factory=list)
    choose: Optional[ChooseBlock] = None


class WeaponArmorGroup(BaseModel):
    fixed: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)


class Proficiencies(BaseModel):
    languages: ProficiencyGroup = Field(default_factory=ProficiencyGroup)
    skills: ProficiencyGroup = Field(default_factory=ProficiencyGroup)
    tools: ProficiencyGroup = Field(default_factory=ProficiencyGroup)
    weapons: WeaponArmorGroup = Field(default_factory=WeaponArmorGroup)
    armor: WeaponArmorGroup = Field(default_factory=WeaponArmorGroup)


class SpellUses(BaseModel):
    type: Literal["at_will", "per_short_rest", "per_long_rest", "class_list_addition"]
    count: Union[int, str, None] = None


class Spell(BaseModel):
    name: str
    level_available: int = 1
    uses: SpellUses
    category: Literal["innate", "expanded"]


class Trait(BaseModel):
    name: str
    notes: str


class SubRace(BaseModel):
    """A subrace. Only fields that differ from or add to the parent are populated."""
    name: str
    display_name: str
    source: str

    sizes: Optional[list[Size]] = None
    speed: Optional[Speed] = None
    senses: Optional[Senses] = None
    abilities: Optional[AbilityBonus] = None
    defenses: Optional[Defenses] = None
    proficiencies: Optional[Proficiencies] = None
    spells: list[Spell] = Field(default_factory=list)
    spell_ability: Optional[Union[Ability, ChooseBlock]] = None
    traits: list[Trait] = Field(default_factory=list)


class Race(BaseModel):
    name: str
    source: str
    creature_type: str = "humanoid"
    sizes: list[Size]
    speed: Speed
    senses: Senses = Field(default_factory=Senses)
    abilities: AbilityBonus = Field(default_factory=AbilityBonus)
    defenses: Defenses = Field(default_factory=Defenses)
    proficiencies: Proficiencies = Field(default_factory=Proficiencies)
    spells: list[Spell] = Field(default_factory=list)
    spell_ability: Optional[Union[Ability, ChooseBlock]] = None
    traits: list[Trait] = Field(default_factory=list)
    sub_races: list[SubRace] = Field(default_factory=list)