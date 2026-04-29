from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from enum import Enum


# ─────────────────────────────────────────────
# Shared enums
# ─────────────────────────────────────────────

class Ability(str, Enum):
    str_ = "str"
    dex = "dex"
    con = "con"
    int_ = "int"
    wis = "wis"
    cha = "cha"


class DamageType(str, Enum):
    slashing = "slashing"
    piercing = "piercing"
    bludgeoning = "bludgeoning"
    fire = "fire"
    cold = "cold"
    acid = "acid"
    lightning = "lightning"
    thunder = "thunder"
    poison = "poison"
    necrotic = "necrotic"
    radiant = "radiant"
    psychic = "psychic"
    force = "force"


class Condition(str, Enum):
    blinded = "blinded"
    charmed = "charmed"
    deafened = "deafened"
    frightened = "frightened"
    grappled = "grappled"
    incapacitated = "incapacitated"
    invisible = "invisible"
    paralyzed = "paralyzed"
    petrified = "petrified"
    poisoned = "poisoned"
    prone = "prone"
    restrained = "restrained"
    stunned = "stunned"
    unconscious = "unconscious"
    exhaustion = "exhaustion"


class RechargeType(str, Enum):
    short_rest = "short_rest"
    long_rest = "long_rest"
    short_or_long_rest = "short_or_long_rest"
    dawn = "dawn"
    per_turn = "per_turn"
    per_round = "per_round"
    never = "never"


class RechargeAmount(str, Enum):
    all = "all"
    one = "one"
    half_max = "half_max"


class DieSize(str, Enum):
    d4 = "d4"
    d6 = "d6"
    d8 = "d8"
    d10 = "d10"
    d12 = "d12"
    d20 = "d20"


class ScalingType(str, Enum):
    static = "static"
    by_class_level = "by_class_level"
    by_proficiency_bonus = "by_proficiency_bonus"
    by_ability_modifier = "by_ability_modifier"
    formula = "formula"


class AttackType(str, Enum):
    melee = "melee"
    ranged = "ranged"
    spell_melee = "spell_melee"
    spell_ranged = "spell_ranged"


class DamageModifier(str, Enum):
    str_ = "str"
    dex = "dex"
    con = "con"
    int_ = "int"
    wis = "wis"
    cha = "cha"
    spell = "spell"
    proficiency = "proficiency"


class SaveType(str, Enum):
    proficiency = "proficiency"
    advantage = "advantage"
    bonus = "bonus"
    reroll_on_fail = "reroll_on_fail"
    immunity = "immunity"


class SkillProficiencyType(str, Enum):
    proficiency = "proficiency"
    expertise = "expertise"
    half_proficiency = "half_proficiency"
    bonus = "bonus"


class SpellGrantType(str, Enum):
    innate = "innate"
    at_will = "at_will"
    extended_list = "extended_list"


class MovementType(str, Enum):
    walk = "walk"
    fly = "fly"
    swim = "swim"
    climb = "climb"
    burrow = "burrow"


class SenseType(str, Enum):
    darkvision = "darkvision"
    blindsight = "blindsight"
    tremorsense = "tremorsense"
    truesight = "truesight"


# ─────────────────────────────────────────────
# Choices / options
# ─────────────────────────────────────────────

class ChoiceOption(BaseModel):
    name: str
    description: Optional[str] = None


class FeatureChoice(BaseModel):
    count: int = 1
    options: List[ChoiceOption]


class SpecialOption(BaseModel):
    name: str
    description: Optional[str] = None


class FeatureOptions(BaseModel):
    choices: List[FeatureChoice] = []
    special_options: List[SpecialOption] = []

# ─────────────────────────────────────────────
# Ability scores
# ─────────────────────────────────────────────

class AbilityScoreEffect(BaseModel):
    ability: Ability
    increase: int
    max_override: Optional[int] = None


# ─────────────────────────────────────────────
# Saving throws / ability checks
# ─────────────────────────────────────────────

class SaveEffect(BaseModel):
    abilities: List[Ability]
    type: SaveType
    value: Optional[int] = None          # only when type == bonus
    consumes: Optional[str] = None


class AbilityCheckEffect(BaseModel):
    abilities: List[Ability]
    type: SaveType
    value: Optional[int] = None
    consumes: Optional[str] = None


# ─────────────────────────────────────────────
# Skill proficiencies
# ─────────────────────────────────────────────

class SkillProficiencyFixed(BaseModel):
    items: List[str]                      # skill names or "all", "dex_based", etc.
    type: SkillProficiencyType
    value: Optional[int] = None           # only when type == bonus


class SkillProficiencyChoice(BaseModel):
    choose_count: int
    from_: List[str] = Field(alias="from")  # skill names or ["all"]
    type: SkillProficiencyType

    class Config:
        populate_by_name = True


# ─────────────────────────────────────────────
# Tool proficiencies
# ─────────────────────────────────────────────

class ToolProficiencyFixed(BaseModel):
    items: List[str]
    type: Literal["proficiency"] = "proficiency"


class ToolProficiencyChoice(BaseModel):
    choose_count: int
    from_: List[str] = Field(alias="from")
    type: Literal["proficiency"] = "proficiency"

    class Config:
        populate_by_name = True


# ─────────────────────────────────────────────
# Movement / senses
# ─────────────────────────────────────────────

class MovementEffect(BaseModel):
    type: MovementType
    modifier: Optional[str] = None        # e.g. "+10"
    value: Optional[str] = None           # e.g. "equal_to_walk_speed"


class SenseEffect(BaseModel):
    type: SenseType
    range_ft: int


# ─────────────────────────────────────────────
# Resistances / immunities / vulnerabilities
# ─────────────────────────────────────────────

class DamageEffect(BaseModel):
    damage_types: Optional[List[DamageType]] = None
    conditions: Optional[List[Condition]] = None


# ─────────────────────────────────────────────
# Actions / bonus actions / reactions / passives
# ─────────────────────────────────────────────

class DamageRoll(BaseModel):
    dice: Optional[str] = None            # e.g. "2d8", null for modifier-only
    type: DamageType
    modifier: Optional[DamageModifier] = None


class ActionAttack(BaseModel):
    type: AttackType
    hit_bonus: Optional[int] = None       # null = use standard ability + PB
    damage: Optional[List[DamageRoll]] = None


class ActionSave(BaseModel):
    ability: Ability                      # what the target rolls
    dc_ability: Optional[Ability] = None  # what caster uses to set DC
    damage: Optional[List[DamageRoll]] = None


class ActionEffect(BaseModel):
    name: str
    consumes: Optional[str] = None
    attack: Optional[ActionAttack] = None
    save: Optional[ActionSave] = None
    conditions_applied: Optional[List[Condition]] = None
    effect_summary: Optional[str] = None  # display-only free text


# ─────────────────────────────────────────────
# Spells granted
# ─────────────────────────────────────────────

class SpellsGranted(BaseModel):
    type: SpellGrantType
    spells: List[str]
    consumes: Optional[str] = None        # links to a resource for free casts


# ─────────────────────────────────────────────
# Resources
# ─────────────────────────────────────────────

class Resource(BaseModel):
    name: str
    base: int
    scaling: ScalingType
    scale_ability: Optional[Ability] = None   # only when scaling == by_ability_modifier
    recharge: RechargeType
    recharge_amount: RechargeAmount | int = RechargeAmount.all
    die: Optional[DieSize] = None             # only for dice-pool resources
    formula_text: Optional[str] = None        # only when scaling == formula


# ─────────────────────────────────────────────
# Top-level effects block
# ─────────────────────────────────────────────

class FeatureEffects(BaseModel):
    ability_scores: Optional[List[AbilityScoreEffect]] = None
    saving_throws: Optional[List[SaveEffect]] = None
    ability_checks: Optional[List[AbilityCheckEffect]] = None
    skill_proficiencies: Optional[List[SkillProficiencyFixed | SkillProficiencyChoice]] = None
    tool_proficiencies: Optional[List[ToolProficiencyFixed | ToolProficiencyChoice]] = None
    weapon_proficiencies: Optional[List[str]] = None
    armor_proficiencies: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    movement: Optional[List[MovementEffect]] = None
    senses: Optional[List[SenseEffect]] = None
    resistances: Optional[List[DamageEffect]] = None
    immunities: Optional[List[DamageEffect]] = None
    vulnerabilities: Optional[List[DamageEffect]] = None
    actions: Optional[List[ActionEffect]] = None
    bonus_actions: Optional[List[ActionEffect]] = None
    reactions: Optional[List[ActionEffect]] = None
    passives: Optional[List[ActionEffect]] = None
    spells_granted: Optional[List[SpellsGranted]] = None
    resources: Optional[List[Resource]] = None
    table: Optional[str] = None


# ─────────────────────────────────────────────
# Root output schema
# ─────────────────────────────────────────────

class CleanedFeature(BaseModel):
    description: str
    options: FeatureOptions = FeatureOptions()
    effects: Optional[FeatureEffects] = None