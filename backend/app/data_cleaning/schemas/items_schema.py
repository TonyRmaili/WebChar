"""The final shapes of items, as written by the code cleaner.

`features` are added later by the LLM step; `text` is made by code.

Three kinds, plus groups:

  item          a real, unique object you can own: a Longsword, a Wand of
                Fireballs, Blackrazor. Mundane base items (kind "item",
                `base: true`) are the weapons, armor, tools… that variants
                are built on.
  item_variant  a template applied to a base item: "+1 Weapon", "Flame
                Tongue". `applies_to` lists the base items it fits. Picking
                one makes a real item (item_merge.merge), e.g. "Flame Tongue
                Greatsword"; a variant never sits on a sheet by itself.
  item_group    a heading over separate complete items ("Absorbing Tattoo"
                -> 13 tattoos); you pick one of its `members`.

Shared parts (all optional):

  item_types   ["melee_weapon"], ["heavy_armor"], ["wondrous_item"], …
  weapon       {category, kind, damage {dice, type}, versatile, range
                {normal, long}, properties, mastery, ammo, reload, crit_at,
                bonus {attack, damage}}
  armor        {category: light|medium|heavy|shield, base, dex_cap,
                strength, stealth_disadvantage}
  attunement   {note, requires: [any-of groups]}
  charges      {max, reset: dawn|dusk|…, regain: "1d6 + 1" | "all"}
  modifiers    always-on while equipped: {target, add|min|set}
               targets: ac, spell_attack, spell_dc, save (all saves),
               check (all checks), pb, concentration, spell_damage, speed,
               ability scores (str…)
  grants       defenses, speed, ability, spells (cast from the item)
"""

from typing import Literal

from .common_schema import Choice, EntryHeader, Grants, Strict


class Damage(Strict):
    dice: str
    type: str | None = None


class Range(Strict):
    normal: int
    long: int | None = None


class WeaponBonus(Strict):
    attack: int = 0
    damage: int = 0


class Weapon(Strict):
    category: Literal["simple", "martial"] | None = None
    kind: Literal["melee", "ranged"] | None = None
    damage: Damage | None = None
    versatile: str | None = None
    range: Range | None = None
    properties: list[str] | None = None
    property_notes: dict[str, str] | None = None
    mastery: list[str] | None = None
    ammo: str | None = None
    reload: int | None = None
    crit_at: int | None = None
    bonus: WeaponBonus | None = None


class Armor(Strict):
    category: Literal["light", "medium", "heavy", "shield"]
    base: int | None = None
    dex_cap: int | None = None
    strength: int | None = None
    stealth_disadvantage: bool | None = None


class Attunement(Strict):
    required: bool = True
    note: str | None = None
    requires: list[dict] | None = None      # any one group is enough, like feat prerequisites


class Charges(Strict):
    max: int | str
    reset: str | None = None               # dawn, dusk, midnight, long_rest, special
    regain: int | str | None = None        # "1d6 + 1", 2, or "all"


class Modifier(Strict):
    target: str
    add: int | None = None
    min: int | None = None
    set: int | None = None


class ItemBase(EntryHeader):
    item_types: list[str] | None = None
    rarity: str | None = None
    tier: str | None = None
    weight: int | float | None = None
    value: dict | None = None                 # {"gp": 15}; variants: {"formula": "base * 4"}
    weapon: Weapon | None = None
    armor: Armor | None = None
    attunement: Attunement | None = None
    charges: Charges | None = None
    modifiers: list[Modifier] | None = None
    grants: Grants = Grants()
    choices: list[Choice] = []
    light: list[dict] | None = None
    focus: list[str] | bool | None = None      # spellcasting focus for these classes
    focus_type: str | None = None              # arcane, druid, holy
    curse: bool | None = None
    sentient: bool | None = None
    item_tags: list[str] | None = None         # sword, axe, firearm, consumable, …
    extra: dict | None = None                  # vehicle / mount / container / poison / scroll / pack details


class Item(ItemBase):
    base: bool | None = None                   # a mundane base item that variants build on
    base_item: str | None = None               # a unique item built on a base ("greatsword-xphb")
    group: str | None = None                   # the item group it belongs to


class ItemVariant(ItemBase):
    applies_to: list[str]                      # base item ids it can be made from
    name_format: str                           # "+1 {base}", "{base} of Warning"
    name_remove: str | None = None             # cut from the base name first (" Armor")
    properties_add: list[str] | None = None
    armor_overrides: dict | None = None        # Mithral: {"stealth_disadvantage": false, "strength": 0} (0 = no requirement)


class ItemGroup(EntryHeader):
    members: list[str]
    rarity: str | None = None
    hidden_members: bool | None = None         # 5etools lists only the group
