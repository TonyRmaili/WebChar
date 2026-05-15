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


class RechargeType(str, Enum):
    short_rest = "short_rest"
    long_rest = "long_rest"
    

class SpellcastingAbility(BaseModel):
    fixed: Optional[Ability] = None
    choose_from: List[Ability] = []


class SpellChoiceFilter(BaseModel):
    spell_level: Optional[int] = None
    class_list: List[str] = []
    school: List[str] = []
    ritual: bool 


class SpellChoice(BaseModel):
    count: Optional[int] = None
    from_: List[str] = Field(default=[], alias="from")
    filter: Optional[SpellChoiceFilter] = None

    class Config:
        populate_by_name = True


class FreeCast(BaseModel):
    amount: int
    recharge: RechargeType


class AdditionalSpell(BaseModel):
    name: Optional[str] = None
    choice: Optional[SpellChoice] = None
    level_requirement: Optional[int] = None
    free_cast: Optional[FreeCast] = None


class ExtendedSpell(BaseModel):
    name: str
    spell_level: Optional[int] = None


class AdditionalSpells(BaseModel):
    spellcasting_ability: SpellcastingAbility = SpellcastingAbility()
    spells: List[AdditionalSpell] = []
    extended_spell_list: List[ExtendedSpell] = []


class CleanedFeatLLMData(BaseModel):
    entries: str
    additional_spells: Optional[AdditionalSpells] = None