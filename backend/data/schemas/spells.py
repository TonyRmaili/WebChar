from typing import List, Optional
from pydantic import BaseModel, Field


class Speed(BaseModel):
    walk: Optional[int] = None
    fly: Optional[int] = None
    swim: Optional[int] = None
    climb: Optional[int] = None
    burrow: Optional[int] = None

class Abilities(BaseModel):
    stre: int
    dex: int
    con: int
    inte: int
    wis: int
    cha: int

class SkillKV(BaseModel):
    name: str
    bonus: int

class Action(BaseModel):
    name: str
    text: str  

class SpellBase(BaseModel):
    name: str
    size: str                
    ac: int
    hp: int
    speed: Speed
    init: int = 0
    abilities: Abilities
    skills: List[SkillKV] = Field(default_factory=list)
    cr: str
    languages: List[str] = Field(default_factory=list)
    actions: List[Action] = Field(default_factory=list)
    treasure: List[str] = Field(default_factory=list)
    habitat: List[str] = Field(default_factory=list)
