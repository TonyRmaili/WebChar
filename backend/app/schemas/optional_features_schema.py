from __future__ import annotations
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class Ability(str, Enum):
    str_ = "str"
    dex = "dex"
    con = "con"
    int_ = "int"
    wis = "wis"
    cha = "cha"


class SpellcastingAbility(BaseModel):
    fixed: Optional[Ability] = None
    choose_from: List[Ability] = []


class SpellChoiceFilter(BaseModel):
    spell_level: Optional[int] = None
    class_list: List[str] = []
    school: List[str] = []
    ritual: bool = False
    spell_attack: bool = False


class SpellChoice(BaseModel):
    count: int
    from_: List[str] = Field(default=[], alias="from")
    filter: Optional[SpellChoiceFilter] = None

    class Config:
        populate_by_name = True


class DailySpellGroup(BaseModel):
    uses: int            # times per long rest, per spell
    spells: List[str]


class ResourceCostGroup(BaseModel):
    cost: int
    spells: List[str]


class AdditionalSpells(BaseModel):
    ability: Optional[SpellcastingAbility] = None
    resource_name: Optional[str] = None

    at_will: List[str] = []
    daily: List[DailySpellGroup] = []
    ritual_named: List[str] = []
    ritual_choice: List[SpellChoice] = []
    resource_cost: List[ResourceCostGroup] = []
    granted: List[SpellChoice] = []   # was known + prepared


class CleanedOptionalFeatureLLMData(BaseModel):
    entries: str
    additional_spells: Optional[AdditionalSpells] = None