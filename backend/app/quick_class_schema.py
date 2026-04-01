from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


# ---------- Currency / Inventory ----------

class Currency(BaseModel):
    cp: int = 0
    sp: int = 0
    ep: int = 0
    gp: int = 0
    pp: int = 0


class GearItem(BaseModel):
    name: str = ""
    amount: int = 0


class Gear(BaseModel):
    mundane: List[GearItem] = Field(default_factory=list)
    magical: List[GearItem] = Field(default_factory=list)


class Inventory(BaseModel):
    treasure: Currency = Field(default_factory=Currency)
    gear: Gear = Field(default_factory=Gear)


# ---------- Skills / Ability Scores ----------

class Skill(BaseModel):
    skill: str = ""
    expertise: bool = False


class AbilityScores(BaseModel):
    score_prio: List[str] = Field(default_factory=list)

    # Use internal names, but expose JSON keys exactly as in your example
    stre: Optional[int] = Field(default=None, alias="str")
    dex: Optional[int] = None
    con: Optional[int] = None
    inte: Optional[int] = Field(default=None, alias="int")
    wis: Optional[int] = None
    cha: Optional[int] = None

    class Config:
        extra = "ignore"
        populate_by_name = True  # allow using field names or aliases


# ---------- General / Biography ----------

class GeneralData(BaseModel):
    character_name: Optional[str] = None
    background: Optional[str] = None
    race: Optional[str] = None
    subrace: Optional[str] = None
    max_hp: Optional[int] = None

    class Config:
        extra = "ignore"


class Biography(BaseModel):
    backstory: Optional[str] = None
    description: Optional[str] = None
    # In JSON: array of strings; simplest mapping:
    personality_traits: List[str] = Field(default_factory=list)
    alignment: Optional[str] = None
    age: Optional[int] = None
    height: Optional[int] = None
    weight: Optional[int] = None

    class Config:
        extra = "ignore"


# ---------- Classes ----------

class CharacterClass(BaseModel):
    name: Optional[str] = Field(default=None, alias="class")
    sub_class: Optional[str] = None
    level: int = Field(..., ge=1, le=20)
    first_class: bool

    class Config:
        extra = "ignore"
        populate_by_name = True  # allow using "name" when instantiating in Python


# ---------- Top-level schema ----------

class QuickClassSchema(BaseModel):
    classes: List[CharacterClass] = Field(default_factory=list)
    general: GeneralData
    ability_scores: AbilityScores
    skills: List[Skill] = Field(default_factory=list)
    biography: Biography
    inventory: Inventory
    feats: List[str] = Field(default_factory=list)
    

    @model_validator(mode="after")
    def ensure_single_first_class(self) -> "QuickClassSchema":
        first_count = sum(1 for c in self.classes if c.first_class)
        if first_count != 1:
            raise ValueError(
                "Exactly one class in 'classes' must have first_class=True."
            )
        return self

    class Config:
        extra = "ignore"