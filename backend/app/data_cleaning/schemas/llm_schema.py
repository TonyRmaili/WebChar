"""What the LLM returns for one entry, and how it becomes our final shape.

The LLM reads an entry's text blocks and returns `EntryLLM`:

    text           one cleaned text block (paragraphs, each rule paragraph
                   starting with **Name.**)
    features       only what is worth a feature: passive rules (traits),
                   charges, actions, toggles, always-on numbers
    extra_grants   proficiencies, resistances, senses… that the TEXT gives;
                   code later throws away the ones the raw keys already gave

These models are written for OpenAI "structured outputs" (strict mode):
every field is present, "nothing" is null or [], and there are no free
dictionaries. That's why a value is {"value": "...", "steps": [...]} here.
`to_final()` turns it into the compact final shape:

    {"value": "1", "steps": []}                          ->  1
    {"value": "8 + con_mod + pb", "steps": []}           ->  "8 + con_mod + pb"
    {"value": "2d6", "steps": [{"level": 6, "value": "3d6"}]}
                                                         ->  {"1": "2d6", "6": "3d6"}

`check_entry()` does the checks a schema can't: formulas only use allowed
words, dice look like dice, every feature has its **Name.** paragraph,
names are unique, AC-only options are only used on AC.
"""

import re
from typing import Literal

from pydantic import BaseModel, Field

from ..formula import FormulaError, check_dice, check_formula, is_dice

# ---------- fixed word lists ----------

Ability = Literal["str", "dex", "con", "int", "wis", "cha"]
Skill = Literal[
    "acrobatics", "animal_handling", "arcana", "athletics", "deception", "history",
    "insight", "intimidation", "investigation", "medicine", "nature", "perception",
    "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival",
]
DamageType = Literal[
    "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
    "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
    "weapon",   # "damage of the weapon's type"
]
Condition = Literal[
    "blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled",
    "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone",
    "restrained", "stunned", "unconscious",
]
# Same words as CATEGORY_KEYS in the frontend's Constants.js.
Category = Literal[
    "traits", "actions", "bonus_actions", "reactions",
    "legendary_actions", "mythic_actions", "lair_actions", "regional_effects",
]
Reset = Literal["short", "long", "dawn"]   # dawn: items ("regains … at dawn")
SenseType = Literal["darkvision", "blindsight", "tremorsense", "truesight"]
ArmorProf = Literal["light", "medium", "heavy", "shields"]
ModTarget = Literal[tuple(
    ["ac", "hp_max", "speed.walk", "speed.fly", "speed.swim", "speed.climb", "speed.burrow",
     "initiative", "attack", "damage", "spell_dc", "spell_attack"]
    + [f"save.{a}" for a in Ability.__args__]
    + [f"check.{s}" for s in Skill.__args__]
)]
AcRequire = Literal["armor", "no_armor", "shield", "no_shield"]


# ---------- values ----------

class Step(BaseModel):
    level: int = Field(description="Character level from which this value applies.")
    value: str


class Value(BaseModel):
    value: str = Field(description='A number ("1"), a formula ("8 + con_mod + pb") or dice ("2d6").')
    steps: list[Step] = Field(description="Higher values at higher levels; [] if it never changes.")


# ---------- grants ----------

class Sense(BaseModel):
    type: SenseType
    range: int


class Speed(BaseModel):
    walk: str | None = Field(description='Feet as a number ("35"), or "walk" for "equal to your walking speed".')
    fly: str | None
    swim: str | None
    climb: str | None
    burrow: str | None


class Grants(BaseModel):
    skills: list[Skill]
    saves: list[Ability]
    tools: list[str] = Field(description="snake_case ids, e.g. thieves_tools, smiths_tools.")
    languages: list[str] = Field(description="snake_case ids, e.g. common, dwarvish, deep_speech.")
    weapons: list[str] = Field(description="snake_case ids, e.g. longsword, simple_weapons, martial_weapons.")
    armor: list[ArmorProf]
    resist: list[DamageType]
    immune: list[DamageType]
    vulnerable: list[DamageType]
    condition_immune: list[Condition]
    senses: list[Sense]
    speed: Speed | None


# ---------- features ----------

class Uses(BaseModel):
    max: Value
    reset: Reset


class Damage(BaseModel):
    dice: Value | None = Field(description='Dice only, e.g. "2d6". Doubled on a critical hit (attack damage only).')
    bonus: Value | None = Field(description='Flat part, e.g. "dex_mod". Never doubled.')
    type: DamageType
    condition: str | None = Field(description='Only when this part applies in some cases: a few words from the text ("instead if the target is missing any Hit Points", "extra against Undead"); null for normal damage.')
    per_slot: str | None = Field(description='Spells: dice added for each spell slot level above the spell\'s level, e.g. "1d6"; null if it doesn\'t grow that way.')


class Attack(BaseModel):
    kind: Literal["melee", "ranged", "spell", "any"] = Field(description='"any" only for a rider that works with any attack roll ("whenever you hit it with an attack roll").')
    bonus: Value | None = Field(description='To-hit formula, e.g. "str_mod + pb"; null when the effect rides on a weapon attack the player already makes (it uses that weapon\'s to-hit).')
    damage: list[Damage]


class Save(BaseModel):
    ability: Ability
    dc: Value | None = Field(description='"8 + pb + spell_mod" for your spell save DC; null when the text names another class DC without its numbers ("your maneuver save DC", "your ki save DC").')
    on_success: Literal["half", "none"]
    damage: list[Damage]
    conditions: list[Condition]


class Action(BaseModel):
    range: str | None
    area: str | None
    attack: Attack | None
    save: Save | None = Field(description="With an attack: the save happens on a hit. Without: targets/area make it.")
    damage: list[Damage] = Field(description="Damage dealt with no attack roll and no save (Magic Missile); [] otherwise.")
    heal: Value | None = Field(description='Hit points regained: a number, a formula, or dice plus a formula ("2d8 + spell_mod").')
    heal_per_slot: str | None = Field(description='Spells: healing dice added per slot level above the spell\'s level, e.g. "2d8".')
    temp_hp: Value | None = Field(description='Temporary hit points it gives, like heal ("2d4 + 4").')
    temp_hp_per_slot: str | None = Field(description='Spells: temporary hit points added per slot level above the spell\'s level.')


class Modifier(BaseModel):
    target: ModTarget
    op: Literal["add", "base", "min", "set"] = Field(description='"base", "min" and "set" only for target "ac".')
    value: Value
    requires: list[AcRequire] = Field(description="Only for target ac; [] otherwise.")


class Toggle(BaseModel):
    uses_charge: bool = Field(description="Switching it on spends one of the feature's uses.")
    grants: Grants | None
    modifiers: list[Modifier]


class FeatureLLM(BaseModel):
    name: str = Field(description="Exactly the name in its **Name.** paragraph of the text.")
    level: int = Field(description="Character level it starts at; 1 unless the text says otherwise.")
    category: Category
    uses: Uses | None
    action: Action | None
    toggle: Toggle | None
    modifiers: list[Modifier]


class FeaturesLLM(BaseModel):
    """What the LLM returns now: the text is made by code (text_renderer.py)."""
    features: list[FeatureLLM]
    extra_grants: Grants


class EntryLLM(FeaturesLLM):
    """The older answer shape, when the LLM also wrote the text. Old answers
    in llm/ may still have it; their `text` is no longer used."""
    text: str


# ---------- checks ----------

class EntryProblem(ValueError):
    pass


DICE_TERM = re.compile(r"\b\d+\s*d\s*\d+\b")


def check_roll(x: str) -> None:
    """Dice plus a formula, e.g. "2d8 + spell_mod" (healing, temporary hit
    points): every dice term is checked as dice, the rest as a formula."""
    check_formula(DICE_TERM.sub("1", x))


def _check_value(v: Value, where: str, dice: bool = False, roll: bool = False) -> list[str]:
    errs = []
    for x in [v.value] + [s.value for s in v.steps]:
        try:
            check_dice(x) if dice else check_roll(x) if roll else check_formula(x)
        except FormulaError as e:
            errs.append(f"{where}: {e}")
    levels = [s.level for s in v.steps]
    if any(not 2 <= lv <= 30 for lv in levels) or levels != sorted(set(levels)):
        errs.append(f"{where}: step levels must rise, between 2 and 30")
    return errs


def _check_damage(d: list[Damage], where: str) -> list[str]:
    errs = []
    for i, part in enumerate(d):
        if part.dice is None and part.bonus is None:
            errs.append(f"{where}[{i}]: no dice and no bonus")
        if part.dice:
            errs += _check_value(part.dice, f"{where}[{i}].dice", dice=True)
        if part.bonus:
            errs += _check_value(part.bonus, f"{where}[{i}].bonus")
        errs += _check_per_slot(part.per_slot, f"{where}[{i}].per_slot")
    return errs


def _check_mods(mods: list[Modifier], where: str) -> list[str]:
    errs = []
    for i, m in enumerate(mods):
        w = f"{where}[{i}]"
        if m.target != "ac" and (m.op != "add" or m.requires):
            errs.append(f"{w}: only AC modifiers may use base/min/set or requires")
        # A roll bonus can be dice (Bless: +1d4 to attack rolls and saving throws).
        if m.target.split(".")[0] in DICE_TARGETS and m.op == "add" and is_dice(m.value.value) and not m.value.steps:
            continue
        errs += _check_value(m.value, w)
    return errs


DICE_TARGETS = {"attack", "save", "check"}


def _check_per_slot(v: str | None, where: str) -> list[str]:
    if v is None:
        return []
    try:
        check_dice(v)
        return []
    except FormulaError as e:
        return [f"{where}: {e}"]


NAMED_LINE = re.compile(r"^\s*(?:- )?\*\*(.+?)\.\*\*")


def paragraph_names(text: str) -> set[str]:
    """Names a feature can point at (lowercase): **Name.** paragraphs and
    named list items (- **Name.** text)."""
    return {m.group(1).strip().lower() for line in text.split("\n") if (m := NAMED_LINE.match(line))}


def check_entry(entry: EntryLLM, own_name: str | None = None) -> list[str]:
    """Old answer shape (with its own text)."""
    errs = [] if entry.text.strip() else ["text is empty"]
    return errs + check_features(entry, entry.text, own_name)


def check_features(entry: FeaturesLLM, text: str, own_name: str | None = None) -> list[str]:
    """Everything wrong with an answer; [] means it's fine. Every feature must
    name a **Name.** paragraph (or a - **Name.** list item) of the entry's
    text, or the entry's own name (`own_name`): its text is then the whole
    block (a feat that is one plain paragraph, like Tough)."""
    errs = []
    names = paragraph_names(text) | ({own_name.strip().lower()} if own_name else set())
    seen = set()
    for f in entry.features:
        w = f"feature '{f.name}'"
        if f.name.lower() in seen:
            errs.append(f"{w}: name used twice")
        seen.add(f.name.lower())
        if f.name.strip().lower() not in names:
            errs.append(f"{w}: no **{f.name}.** paragraph in the text")
        if not 1 <= f.level <= 20:
            errs.append(f"{w}: level {f.level}")
        if f.uses:
            errs += _check_value(f.uses.max, f"{w}.uses.max")
        if f.action:
            a = f.action  # an action may have no roll at all (e.g. a teleport)
            if a.attack:
                if a.attack.bonus:
                    errs += _check_value(a.attack.bonus, f"{w}.attack.bonus")
                errs += _check_damage(a.attack.damage, f"{w}.attack.damage")
            if a.save:
                if a.save.dc:
                    errs += _check_value(a.save.dc, f"{w}.save.dc")
                errs += _check_damage(a.save.damage, f"{w}.save.damage")
            errs += _check_damage(a.damage, f"{w}.damage")
            if a.heal:
                errs += _check_value(a.heal, f"{w}.heal", roll=True)
            if a.temp_hp:
                errs += _check_value(a.temp_hp, f"{w}.temp_hp", roll=True)
            errs += _check_per_slot(a.heal_per_slot, f"{w}.heal_per_slot")
            errs += _check_per_slot(a.temp_hp_per_slot, f"{w}.temp_hp_per_slot")
        if f.toggle:
            errs += _check_mods(f.toggle.modifiers, f"{w}.toggle.modifiers")
        errs += _check_mods(f.modifiers, f"{w}.modifiers")
    for s in _speeds(entry.extra_grants.speed):
        if not (s.isdigit() or s == "walk"):
            errs.append(f"extra_grants.speed: '{s}' is not feet or 'walk'")
    return errs


def _speeds(speed: Speed | None) -> list[str]:
    return [v for v in (speed.model_dump().values() if speed else []) if v is not None]


# ---------- final shape ----------

def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def final_value(v: Value | None):
    if v is None:
        return None
    one = lambda x: int(x) if re.fullmatch(r"-?\d+", x.strip()) else x.strip()
    if not v.steps:
        return one(v.value)
    table = {"1": one(v.value)}
    for s in v.steps:
        table[str(s.level)] = one(s.value)
    return table


def _clean(obj):
    """Drop None, [] and {} everywhere."""
    if isinstance(obj, dict):
        out = {k: _clean(v) for k, v in obj.items()}
        return {k: v for k, v in out.items() if v not in (None, [], {})}
    if isinstance(obj, list):
        return [x for x in (_clean(v) for v in obj) if x not in (None, [], {})]
    return obj


def final_grants(g: Grants | None) -> dict:
    if g is None:
        return {}
    out = {k: list(getattr(g, k)) for k in ("skills", "saves", "tools", "languages", "weapons", "armor")}
    out["senses"] = {s.type: s.range for s in g.senses}
    out["speed"] = {k: (int(v) if v.isdigit() else v) for k, v in (g.speed.model_dump() if g.speed else {}).items() if v}
    out["defenses"] = {"resist": g.resist, "immune": g.immune, "vulnerable": g.vulnerable,
                       "condition_immune": g.condition_immune}
    return _clean(out)


def _final_damage(parts: list[Damage]) -> list[dict]:
    return [{"dice": final_value(p.dice), "bonus": final_value(p.bonus), "type": p.type,
             "condition": p.condition, "per_slot": p.per_slot}
            for p in parts]


def _final_mods(mods: list[Modifier]) -> list[dict]:
    return [{"target": m.target, m.op: final_value(m.value), "requires": m.requires} for m in mods]


def final_feature(f: FeatureLLM) -> dict:
    a = f.action
    action = None
    if a:
        action = {
            "range": a.range, "area": a.area, "heal": final_value(a.heal), "heal_per_slot": a.heal_per_slot,
            "temp_hp": final_value(a.temp_hp), "temp_hp_per_slot": a.temp_hp_per_slot,
            "damage": _final_damage(a.damage),
            # A trait's attack is a rider on the player's own weapon attack: it never has its own to-hit.
            "attack": a.attack and {"kind": a.attack.kind,
                                    "bonus": None if f.category == "traits" else final_value(a.attack.bonus),
                                    "damage": _final_damage(a.attack.damage)},
            "save": a.save and {"ability": a.save.ability, "dc": final_value(a.save.dc),
                                "on_success": a.save.on_success, "damage": _final_damage(a.save.damage),
                                "conditions": a.save.conditions},
        }
    return _clean({
        "id": slug(f.name),
        "name": f.name,
        "level": f.level,
        "category": f.category,
        "uses": f.uses and {"max": final_value(f.uses.max), "reset": f.uses.reset},
        "action": action,
        # a toggle with nothing to apply (Flame Tongue's on/off) stays as `true`
        "toggle": f.toggle and (_clean({"uses_charge": f.toggle.uses_charge or None,
                                        "grants": final_grants(f.toggle.grants),
                                        "modifiers": _final_mods(f.toggle.modifiers)}) or True),
        "modifiers": _final_mods(f.modifiers),
    })


def to_final(entry: FeaturesLLM) -> dict:
    """{features, extra_grants} in the final shape."""
    return {
        "features": [final_feature(f) for f in entry.features],
        "extra_grants": final_grants(entry.extra_grants),
    }


def feature_text(text: str, name: str, own_name: str | None = None) -> str:
    """A feature's description on the sheet. (The frontend does the same;
    this one is for checks and tests.)
      - a **Name.** paragraph: that paragraph plus the plain paragraphs
        after it, up to the next named paragraph;
      - a named list item (- **Name.** text): that item, plus any lines
        after it that aren't a new item;
      - the entry's own name: the whole text."""
    want = name.strip().lower()
    lines = text.split("\n")
    for i, line in enumerate(lines):
        m = NAMED_LINE.match(line)
        if not m or m.group(1).strip().lower() != want:
            continue
        out = [line.strip()]
        is_item = line.lstrip().startswith("- ")
        for nxt in lines[i + 1:]:
            if is_item:
                if not nxt.strip() or nxt.lstrip().startswith("- "):
                    break
            elif NAMED_LINE.match(nxt) and not nxt.lstrip().startswith("- "):
                break
            out.append(nxt.rstrip())
        return "\n".join(out).strip()
    if own_name and want == own_name.strip().lower():
        return text.strip()
    return ""


# ---------- classes ----------
#
# A class job is one class feature (with the features it points at) or a
# whole subclass. On top of the usual feature fields, a class feature can
# say what it costs from a class resource, what it lets the player pick and
# what it grants (fixed proficiencies etc.), and the answer lists the
# resources the text defines (how big, which die, when they refill).

PickKind = Literal["skills", "expertise", "languages", "tools", "saves"]


class PickLLM(BaseModel):
    grant: PickKind
    count: int
    from_: list[str] = Field(alias="from", description='Ids (snake_case) or one group: "all_skills", '
                             '"proficient_skills", "proficient_skills_tools", "all_tools", "artisans_tools", '
                             '"musical_instruments", "all_languages", "standard_languages".')
    at: int | None = Field(description="Class level of this pick when it comes later than the feature "
                                       "(\"at 6th level, two more\"); null otherwise.")


class ConsumesLLM(BaseModel):
    resource: str = Field(description='A resource id from the input, or a new snake_case name ("superiority_dice").')
    amount: int


class ClassFeatureLLM(FeatureLLM):
    consumes: ConsumesLLM | None = Field(description="What using it costs from a class resource; null if nothing.")
    picks: list[PickLLM]
    grants: Grants | None = Field(description="Fixed proficiencies, defenses, senses or speeds this feature gives.")


class ResourceLLM(BaseModel):
    name: str = Field(description='As the text names the pool, e.g. "Superiority Dice".')
    max: Value | None = Field(description="How many; a column id when a table column gives it; steps at class levels.")
    die: Value | None = Field(description='Dice pools: the die, e.g. "d8", with steps; null for points/uses.')
    refill: Literal["short_rest", "long_rest", "long_rest_one_on_short"] = Field(
        description="short_rest: all back on a Short or Long Rest; long_rest: only a Long Rest; "
                    "long_rest_one_on_short: all on a Long Rest, one on a Short Rest.")


class ClassAnswerLLM(BaseModel):
    features: list[ClassFeatureLLM]
    resources: list[ResourceLLM]


DIE_RE = re.compile(r"^d(4|6|8|10|12|20)$")


def check_class_answer(answer: ClassAnswerLLM, text: str, names: list[str]) -> list[str]:
    """The feature checks every category has, plus: a feature names one of
    the job's features or a **Name.** block of its text; picks and dice
    look right. Formulas may use the class's column ids (set by the caller
    with formula.extra_words)."""
    from types import SimpleNamespace
    named = text + "".join(f"\n\n**{n}.**" for n in names)     # the job's features count as named blocks
    errs = check_features(SimpleNamespace(features=answer.features, extra_grants=SimpleNamespace(speed=None)),
                          named, None)
    for f in answer.features:
        for p in f.picks:
            if p.count < 1:
                errs.append(f"feature '{f.name}': a pick of {p.count}")
            if not p.from_:
                errs.append(f"feature '{f.name}': a pick with nothing to pick from")
        if f.consumes and f.consumes.amount < 1:
            errs.append(f"feature '{f.name}': consumes {f.consumes.amount}")
        if f.grants:
            errs += [f"feature '{f.name}'.grants.speed: '{s}' is not feet or 'walk'"
                     for s in _speeds(f.grants.speed) if not (s.isdigit() or s == "walk")]
    for r in answer.resources:
        w = f"resource '{r.name}'"
        if r.max:
            errs += _check_value(r.max, f"{w}.max")
        if r.die:
            for x in [r.die.value] + [s.value for s in r.die.steps]:
                if not DIE_RE.match(x.strip()) and not is_dice(x):
                    errs.append(f"{w}.die: '{x}' is not a die like 'd8'")
        if not r.max and not r.die:
            errs.append(f"{w}: no max and no die")
    return errs


def class_to_final(answer: ClassAnswerLLM) -> dict:
    """{features, resources} in the final shape."""
    feats = []
    for f in answer.features:
        out = final_feature(f)
        if f.consumes:
            out["consumes"] = {"resource": f.consumes.resource, "amount": f.consumes.amount}
        picks = [_clean({"grant": p.grant, "count": p.count, "from": p.from_, "at": p.at}) for p in f.picks]
        if picks:
            out["picks"] = picks
        g = final_grants(f.grants)
        if g:
            out["grants"] = g
        feats.append(out)
    res = []
    for r in answer.resources:
        refill = {"short_rest": ("short", "all"), "long_rest": ("long", None),
                  "long_rest_one_on_short": ("long", 1)}[r.refill]
        res.append(_clean({"name": r.name, "max": final_value(r.max), "die": final_value(r.die),
                           "reset": refill[0], "short_rest": refill[1]}))
    return {"features": feats, "resources": res}
