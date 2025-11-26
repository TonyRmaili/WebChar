from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


# ---------- Simple helper models ----------

class SpeedEntry(BaseModel):
    type: str
    value: int = Field(..., ge=0)


class SenseEntry(BaseModel):
    type: str
    value: int = Field(..., ge=0)


class AbilityScore(BaseModel):
    score: int
    proficient: bool = False
    expertise: bool = False
    mod: int
    save: int


class AbilityScores(BaseModel):
    # Fixed keys instead of Dict[str, AbilityScore]
    str: AbilityScore
    dex: AbilityScore
    con: AbilityScore
    int: AbilityScore
    wis: AbilityScore
    cha: AbilityScore


class Damage(BaseModel):
    dice_count: int = Field(..., ge=1)
    dice_size: str
    mod: int = 0
    damage_type: str

    @field_validator("dice_count", "mod", mode="before")
    def _intify(cls, v):
        if v in (None, ""):
            return 0
        return int(v)


class Charges(BaseModel):
    has: bool = False
    max_charges: int = 0
    current_charges: int = 0
    reset_amount: int = 0

    @field_validator("max_charges", "current_charges", "reset_amount", mode="before")
    def _intify(cls, v):
        if v in (None, ""):
            return 0
        return int(v)


# ---------- Attack / Save blocks ----------

class AttackData(BaseModel):
    attack_type: str = ""   # "melee", "ranged", etc.
    hit_bonus: Optional[int] = None
    damages: List[Damage] = Field(default_factory=list)

    @field_validator("hit_bonus", mode="before")
    def _hit_bonus_int(cls, v):
        if v in (None, ""):
            return None
        return int(v)


class SaveData(BaseModel):
    target: str = ""        # "str", "dex", ...
    dc_bonus: Optional[int] = None
    damages: List[Damage] = Field(default_factory=list)
    half_damage: bool = False

    @field_validator("dc_bonus", mode="before")
    def _dc_bonus_int(cls, v):
        if v in (None, ""):
            return None
        return int(v)


class Effect(BaseModel):
    name: str

    effect_type: Literal["none", "attack", "save", "attack_and_save", "utility", "passive"] = "none"

    range_ft: Optional[int] = None

    attack: AttackData = Field(default_factory=AttackData)
    save: SaveData = Field(default_factory=SaveData)

    damages: List[Damage] = Field(default_factory=list)
    
    notes: str = ""

    charges: Charges = Field(default_factory=Charges)

    open: bool = False
    active: bool = True

    @field_validator("range_ft", mode="before")
    def _range_int(cls, v):
        if v in (None, ""):
            return None
        return int(v)


class Effects(BaseModel):
    actions: List[Effect] = Field(default_factory=list)
    bonus_actions: List[Effect] = Field(default_factory=list)
    reactions: List[Effect] = Field(default_factory=list)
    legendary_actions: List[Effect] = Field(default_factory=list)
    mythic_actions: List[Effect] = Field(default_factory=list)
    lair_actions: List[Effect] = Field(default_factory=list)
    regional_effects: List[Effect] = Field(default_factory=list)
    traits: List[Effect] = Field(default_factory=list)


# ---------- Main monster schema ----------

class MonsterBase(BaseModel):
    # Basic stats
    name: str
    size: str
    ac: int
    max_hp: int
    cr: str
    pb: int
    exp: int
    alignment: str

    # Simple lists
    monster_types: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    treasure: List[str] = Field(default_factory=list)
    habitats: List[str] = Field(default_factory=list)
    gear: List[str] = Field(default_factory=list)
    immunities: List[str] = Field(default_factory=list)
    resistances: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)

    # Complex stats
    speed: List[SpeedEntry] = Field(default_factory=list)
    senses: List[SenseEntry] = Field(default_factory=list)

    ability_scores: AbilityScores  # now a fixed object, not a dict

    effects: Effects = Field(default_factory=Effects)

    class Config:
        extra = "ignore"
