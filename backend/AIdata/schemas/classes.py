from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict, RootModel
from enum import Enum
from typing import Optional, List


# ----- Enums
class ActionType(str, Enum):
    none = "none"
    action = "action"
    bonus_action = "bonus_action"
    reaction = "reaction"
    magic_action = "magic_action"
    other = "other"


class Recharge(str, Enum):
    none = "none"
    short_rest = "short_rest"
    long_rest = "long_rest"
    short_or_long_rest = "short_or_long_rest"
    per_turn = "per_turn"
    per_day = "per_day"
    initiative = "initiative"


# ----- sub-schemas
class SkillProficiencies(BaseModel):
    model_config = ConfigDict(extra="ignore")
    choice_number: int
    skills: list[str] = Field(default_factory=list)

class StartingEquipment(BaseModel):
    label: str
    items: list[str] = Field(default_factory=list)

class Uses(BaseModel):
    """Flexible uses model:
       - value: fixed integer charges (e.g., 2)
       - scales_with: e.g., 'wisdom_mod', 'proficiency_bonus'
       - note: optional freeform like 'once each turn'
    """
    model_config = ConfigDict(extra="ignore")

    value: Optional[int] = None  # could need a schema
    scales_with: Optional[str] = None  # could need a schema
    recharge: Recharge = Recharge.none
    note: Optional[str] = None  # e.g., "no action required to convert", "per creature"


# ----- main schema
class GeneralStats(BaseModel):
    model_config = ConfigDict(extra="ignore")

    class_name: str
    primary_ability: str
    hitpoint_die: str
    saving_throw_proficiencies: list[str] = Field(default_factory=list)
    class_skill_proficiencies: SkillProficiencies

    weapon_proficiencies: list[str] = Field(default_factory=list)
    armor_proficiencies: list[str] = Field(default_factory=list)
    tool_proficiencies: list[str] = Field(default_factory=list)

    starting_equipment: list[StartingEquipment] = Field(default_factory=list)
    spellcasting_ability: str | None = None


class ClassFeature(BaseModel):
    model_config = ConfigDict(extra="ignore")

    level: int
    name: str
    description: str  # verbatim rules text
    action_type: ActionType = ActionType.none
    uses: Optional[Uses] = None
    


class FeatureList(BaseModel):
    model_config = ConfigDict(extra="ignore")
    features: list[ClassFeature]

