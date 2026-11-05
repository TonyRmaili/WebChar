# schemas/effects.py
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field


# ─── shared enums ───────────────────────────────────────────────────────

class EffectType(str, Enum):
    ATTACK          = "attack"
    SAVE            = "save"
    ATTACK_AND_SAVE = "attack_and_save"
    UTILITY         = "utility"


class AttackType(str, Enum):
    MW   = "mw"      # melee weapon
    RW   = "rw"      # ranged weapon
    MS   = "ms"      # melee spell
    RS   = "rs"      # ranged spell
    MW_OR_RW    = "mw_or_rw"      # melee or ranged weapon 
    MS_OR_RS    = "ms_or_rs"      # melee or ranged spell
    NONE = "none"


class Ability(str, Enum):
    STR = "str"
    DEX = "dex"
    CON = "con"
    INT = "int"
    WIS = "wis"
    CHA = "cha"


class Condition(str, Enum):
    BLINDED       = "blinded"
    CHARMED       = "charmed"
    DEAFENED      = "deafened"
    EXHAUSTION    = "exhaustion"
    FRIGHTENED    = "frightened"
    GRAPPLED      = "grappled"
    INCAPACITATED = "incapacitated"
    INVISIBLE     = "invisible"
    PARALYZED     = "paralyzed"
    PETRIFIED     = "petrified"
    POISONED      = "poisoned"
    PRONE         = "prone"
    RESTRAINED    = "restrained"
    STUNNED       = "stunned"
    UNCONSCIOUS   = "unconscious"
    OTHER         = "other"   # escape hatch — detail goes in Effect.notes


class ResetType(str, Enum):
    RECHARGE_DICE = "recharge_dice"
    LONG_REST     = "long_rest"
    SHORT_REST    = "short_rest"
    SPECIAL       = "special"


# ─── effect sub-models ──────────────────────────────────────────────────

class DamageInstance(BaseModel):
    dice_count:  int
    dice_size:   str    # "d4", "d6", "d8", "d10", "d12", "d20"
    mod:         int    # 0 when no flat modifier
    damage_type: str    # "Acid", "Slashing", or chooser sentinel
                        # e.g. "Choose: acid/cold/fire/lightning/poison"


class Attack(BaseModel):
    attack_type: AttackType
    hit_bonus:   Optional[int]
    damages:     List[DamageInstance] = Field(default_factory=list)


class Save(BaseModel):
    target:      Ability
    dc_bonus:    Optional[int]
    damages:     List[DamageInstance] = Field(default_factory=list)
    half_damage: bool
    conditions:  List[Condition] = Field(default_factory=list)


class Charges(BaseModel):
    max_charges:     int
    current_charges: int
    reset_type:      ResetType
    recharge_dice:   Optional[str]    # "5-6", "6" — set when reset_type=RECHARGE_DICE
    per_rest_count:  Optional[int]    # set when reset_type in {LONG_REST, SHORT_REST}


class Effect(BaseModel):
    name:        str
    effect_type: EffectType
    range:       Optional[int]        # ft. Reach (melee), range (ranged), radius (AoE)
    attack:      Optional[Attack]
    save:        Optional[Save]
    notes:       str
    charges:     Optional[Charges]
 

# ─── effect category wrapper ────────────────────────────────────────────

class EffectCategory(BaseModel):
    header: Optional[str]
    items:  List[Effect] = Field(default_factory=list)


class Effects(BaseModel):
    actions:           EffectCategory
    bonus_actions:     EffectCategory
    reactions:         EffectCategory
    traits:            EffectCategory
    legendary_actions: EffectCategory
    mythic_actions:    EffectCategory
    lair_actions:      EffectCategory
    regional_effects:  EffectCategory


# ─── spellcasting ───────────────────────────────────────────────────────

class SpellEntry(BaseModel):
    name: str           # lowercased, tag-stripped, no source codes
    note: Optional[str] # parenthetical modifier or null

class SpellGroup(BaseModel):
    label:  str                       # "1st level (4 slots)", "3/day", "1/day each",
                                      # "Cantrips (at will)", "At will"
    uses:   Optional[int]             # total casts; None = unlimited
    each:   bool                      # True: per-spell counters; False: shared
    spells: List[SpellEntry]                 


class SpellcastingBlock(BaseModel):
    name:               str           # "Spellcasting", "Innate Spellcasting", etc.
    ability:            Ability
    save_dc:            Optional[int]
    spell_attack_bonus: Optional[int]
    notes:              str           # cleaned prose from headerEntries + footerEntries
    groups:             List[SpellGroup]


class CleanedData(BaseModel):
    effects : Effects
    spellcasting: Optional[List[SpellcastingBlock]]