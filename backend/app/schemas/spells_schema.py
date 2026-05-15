from typing import List, Optional, Literal
from pydantic import BaseModel


damage_types = Literal[
    "acid", "bludgeoning", "cold", "fire", "force",
    "lightning", "necrotic", "piercing", "poison",
    "psychic", "radiant", "slashing", "thunder"
]

sense_types = Literal[
    "darkvision", "blindsight", "tremorsense", "truesight", "devilsight"
]

movement_types = Literal[
    "walk", "swim", "climb", "fly", "burrow", "hover"
]

dice_size = Literal[
    "d4", "d6", "d8", "d10", "d12", "d20", "d100"
]

condition_types = Literal[
    "blinded", "charmed", "deafened", "exhaustion", "frightened",
    "grappled", "incapacitated", "invisible", "paralyzed", "petrified",
    "poisoned", "prone", "restrained", "stunned", "unconscious"
]


ability_modifier = Literal[
    "spell",       
    "proficiency"
]


class Movement(BaseModel):
    type: movement_types
    value: Optional[int] = None
    double: Optional[bool] = None         # True when spell doubles existing speed


class Sense(BaseModel):
    type: sense_types
    value: int


class Dice(BaseModel):
    size: dice_size
    amount: int
    modifier: Optional[ability_modifier] = None


class RollBonus(BaseModel):
    """
    Represents a bonus to an attack roll, saving throw, or ability check.
    Either dice, advantage, or both can be present.
    Bless: dice=Dice(size="d4", amount=1), advantage=False
    Guidance: dice=Dice(size="d4", amount=1), advantage=False
    Enhance Ability (Bear): dice=None, advantage=True
    Bane: dice=Dice(size="d4", amount=1), advantage=False  — applied as penalty (negative context in description)
    """
    dice: Optional[Dice] = None
    advantage: Optional[bool] = None   # True = advantage, False = disadvantage, None = no change


class Damage(BaseModel):
    dice: Dice
    type: damage_types
    delivery: Literal["attack_hit", "save", "always"]
    half_on_save: Optional[bool] = None   # only relevant when delivery == "save"
    upcast_scaling: Optional[int] = None


class GrantBonus(BaseModel):
    ac: Optional[int] = None
    temp_hp: Optional[Dice] = None
    senses: Optional[List[Sense]] = None
    movements: Optional[List[Movement]] = None
    resistances: Optional[List[damage_types]] = None
    immunities: Optional[List[damage_types]] = None
    condition_immunities: Optional[List[condition_types]] = None
    grants_invisibility: Optional[bool] = None
    attack: Optional[RollBonus] = None
    saving_throw: Optional[RollBonus] = None
    ability_check: Optional[RollBonus] = None


class Effects(BaseModel):
    damages: Optional[List[Damage]] = None
    grant_bonus: Optional[GrantBonus] = None


class SpellCleaned(BaseModel):
    entries: str
    effects: Optional[Effects] = None