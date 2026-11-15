"""The final shape of a monster, as written by the code cleaner (no LLM).

One file per bestiary book: final/monsters/xmm.json.

Numbers on a monster are fixed (to-hit +14, DC 21, damage 1d10 + 8), so
values here are plain numbers, not formulas. Traits and actions use the
feature shape every category shares; `category` puts each one in its
statblock section (traits, actions, bonus_actions, reactions,
legendary_actions, mythic_actions, lair_actions, regional_effects).
"""

from typing import Literal

from .common_schema import Ability, EntryHeader, Strict

Size = Literal["tiny", "small", "medium", "large", "huge", "gargantuan", "varies"]


class CreatureType(Strict):
    type: str | list[str] | None = None        # "fiend"; a list = pick one (shapechangers)
    tags: list[str] | None = None               # ["devil"]
    swarm_of: str | None = None                 # a swarm of tiny beasts
    note: str | None = None


class ArmorClass(Strict):
    value: int | None = None
    from_: list[str] | None = None
    condition: str | None = None                # "with mage armor"
    special: str | None = None

    model_config = {"extra": "forbid", "populate_by_name": True,
                    "alias_generator": lambda f: "from" if f == "from_" else f}


class HitPoints(Strict):
    average: int | None = None
    formula: str | None = None                  # "19d12 + 133"
    special: str | None = None
    temporary: bool | None = None               # a Wild Shape form: temporary hit points


class Speed(Strict):
    walk: int | str | None = None
    fly: int | str | None = None
    swim: int | str | None = None
    climb: int | str | None = None
    burrow: int | str | None = None
    hover: bool | None = None
    notes: dict[str, str] | None = None         # {"walk": "30 ft. in goblin form"}


class Senses(Strict):
    darkvision: int | None = None
    blindsight: int | None = None
    tremorsense: int | None = None
    truesight: int | None = None
    notes: str | None = None


class Conditional(Strict):
    types: list[str]
    note: str | None = None                     # "from nonmagical attacks"


class Defense(Strict):
    types: list[str] | None = None
    conditional: list[Conditional] | None = None
    special: str | None = None


class Defenses(Strict):
    resist: Defense | None = None
    immune: Defense | None = None
    vulnerable: Defense | None = None
    condition_immune: Defense | None = None


class Challenge(Strict):
    cr: str
    xp: int | None = None
    pb: int | None = None
    lair: str | None = None
    xp_lair: int | None = None
    coven: str | None = None
    xp_coven: int | None = None


class Initiative(Strict):
    bonus: int
    advantage: bool | None = None


class Damage(Strict):
    dice: str | None = None                     # "1d10"
    bonus: int | str | None = None              # 8; a summon's "3 + spell_level"
    type: str                                   # "fire"; "weapon": the weapon's own; "chosen": picked (see type_options or the text)
    type_options: list[str] | None = None       # "acid, cold, or fire damage" -> ["acid", "cold", "fire"]
    condition: str | None = None                # "if the attack roll had Advantage"; "instead" for an "or" form


class Attack(Strict):
    kind: Literal["melee", "ranged", "melee_or_ranged", "spell", "any"]   # any: extra damage on its own attack
    bonus: int | str | None = None              # a sidekick's "3 + pb"
    bonus_from: str | None = None               # "spell_attack": the summoner's spell attack
    auto_hit: bool | None = None                # "automatic hit" (a marut's Unerring Slam)
    damage: list[Damage] = []


class Save(Strict):
    ability: Ability
    dc: int | None = None
    dc_from: str | None = None                  # "spell_save": the summoner's spell save DC
    on_success: Literal["half", "none"]
    damage: list[Damage] = []
    conditions: list[str] = []


class Action(Strict):
    range: str | None = None
    area: str | None = None
    attack: Attack | None = None
    save: Save | None = None                    # with an attack: on a hit
    damage: list[Damage] = []                   # no roll, no save (an aura)


class Uses(Strict):
    max: int
    reset: Literal["long", "short", "turn", "recharge"]
    recharge: int | None = None                 # recharges on 5–6: 5
    max_in_lair: int | None = None


class MonsterFeature(Strict):
    id: str
    name: str
    category: str
    variant: str | None = None                  # only applies when this variant is turned on
    parent: str | None = None                   # one option of that feature (an eye ray, a breath weapon)
    roll: str | None = None                     # "1-2": the option's roll on the parent's table
    text: str = ""
    uses: Uses | None = None
    cost: int | None = None                     # legendary action cost
    action: Action | None = None


class SpellRef(Strict):
    spell: str | None = None                    # "fireball-xphb"
    text: str | None = None                     # a rule instead of one spell ("any cleric spell")
    note: str | None = None                     # "(level 2 version)", "(self only)"


class SpellGroup(Strict):
    how: str | None = None                      # at_will, constant, ritual, recharge, legendary, charges
    uses: int | None = None
    per: str | None = None                      # day, short, long, week, month, year
    each: bool | None = None
    level: int | None = None
    slots: int | None = None
    lower: int | None = None
    spells: list[SpellRef] = []


class SpellBlock(Strict):
    name: str
    ability: Ability | None = None
    dc: int | None = None
    attack: int | None = None
    text: str | None = None
    footer: str | None = None
    display_as: str | None = None               # shown as an action (2024: "Spellcasting" action)
    hidden: list[str] | None = None
    groups: list[SpellGroup] = []


class Variant(Strict):
    """A "Variant: …" inset. With `version`, 5etools also made it a monster
    of its own (pick that one). Otherwise it's a toggle: `features` lists the
    features (marked with `variant`) that apply only while it's on."""
    id: str
    name: str
    text: str = ""
    version: str | None = None                  # "yuan-ti-nightmare-speaker-chameleon-skin-toa"
    features: list[str] = []


class ItemRef(Strict):
    item: str
    qty: int = 1
    attacks: bool | None = None                 # its attack is listed in the actions


class Monster(EntryHeader):
    short_name: str | None = None
    version_of: str | None = None               # made from another monster (a coven hag, a grung colour)
    size: list[Size] = []
    size_note: str | None = None
    creature_type: CreatureType = CreatureType()
    alignment: list[str] = []
    alignment_prefix: str | None = None
    ac: list[ArmorClass] = []
    hp: HitPoints | None = None
    speed: Speed = Speed()
    abilities: dict[Ability, int | None] = {}
    abilities_note: str | None = None           # "Your Strength and Dexterity scores are equal to your Wisdom score."
    saves: dict[Ability, int | str] = {}        # a summon's: "2 + pb"
    saves_note: str | None = None
    skills: dict[str, int | str] = {}           # a summon's: "pb * 2"
    skills_note: str | None = None              # "Stealth +6 while in snake form"
    senses: Senses = Senses()
    passive_perception: int | str | None = None
    defenses: Defenses = Defenses()
    languages: list[str] = []
    cr: Challenge | None = None
    level: int | None = None
    pb_note: str | None = None
    initiative: Initiative | None = None
    features: list[MonsterFeature] = []
    section_notes: dict[str, str] | None = None
    legendary_actions: dict[str, int] | None = None   # {"uses": 3, "uses_in_lair": 4}
    mythic_encounter: str | None = None
    spellcasting: list[SpellBlock] = []
    items: list[ItemRef] = []
    variants: list[Variant] = []
    flags: dict[str, bool | str] = {}
    summoned_by: dict[str, str | int] | None = None
    filters: dict[str, list[str]] = {}
