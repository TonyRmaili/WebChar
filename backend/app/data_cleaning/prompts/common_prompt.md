# D&D 5e Entry Features

You read one D&D 5e entry for a character sheet app and find the rules worth showing on the sheet. The section for this entry's category, after the shared rules, says which kinds of entry you get and the rules only they need.

You get the entry's `text` (already clean) and return two things:

1. `features`: the rules worth showing as their own block on the character sheet.
2. `extra_grants`: proficiencies, resistances, senses and speeds that the text gives.

Return only JSON that matches the schema.

---

## ⚠️ Never invent anything

- Use only what the text says. Do not add rules, numbers, damage types, uses, ranges or conditions that are not written there.
- If something is unclear, leave it out of `features` and `extra_grants`: the text stays on the sheet as written.
- Leaving something out is always better than guessing. The player can add it later.

---

## Input

```json
{
  "name": "Dwarf",
  "kind": "race",
  "edition": "classic | one",
  "race": null,
  "race_blocks": [],
  "text": "**Darkvision.** You have Darkvision with a range of 60 feet.\n\n**Dwarven Resilience.** You have Resistance to Poison damage…"
}
```

- `text` is the entry's text. Paragraphs are separated by a blank line, a named block starts with its name in bold (`**Stonecunning.** …`), lists are `- …` lines (a named list item is `- **Name.** …`), and tables are markdown.
- `race`, `race_blocks` and `parent_text` are context from a parent entry. They are null or empty unless the category section explains them. Context never becomes a feature.

---

## 1. `features`

A feature is a block the player sees on their sheet. It only names a part of the text, which the sheet shows as its description. That part is either a `**Name.**` paragraph, or a named list item `- **Name.** text` (for example one option inside a list of options). So every feature's `name` must match one of those bold names exactly.

If a rule isn't in a named block, use the entry's own `name` as the feature name, and the sheet shows the whole text. For example, an entry that is one plain paragraph, like the feat Tough.

**Make a feature only when the block gives the player a rule to use or remember during play.** Do **not** make features for blocks that only state:
- a size, a speed number, a language, a sense or a resistance
- a proficiency, or a choice of proficiencies
- an ability score increase
- lore or description

The app already handles those from other data. Most entries have 0–3 features.

**Spells are tracked on the spells themselves.** This covers spells the entry lets you know or cast ("you know the Mending cantrip", "you can cast Misty Step once with this trait, and regain the ability when you finish a Long Rest"). For such blocks:
- Never give them `uses` or an `action`.
- Make a passive trait only if the block has a rule beyond *which spells and how often*. For example: swapping a cantrip after a Long Rest, no material components, can't cast in sunlight, only on yourself.
- If it only says which spells you get and how often, make no feature.
- A block that adds spells to your class's spell list ("Spells of the Mark") never becomes a feature.

### Kinds of features (`category`)

| Kind | When | What to fill in |
|---|---|---|
| **passive** | A rule to remember, with no numbers to track. Examples: advantage on some saves, "you don't need to sleep", "your speed isn't reduced by heavy armor". | `category: "traits"`, nothing else |
| **always-on numbers** | A number that always changes, e.g. "your hit point maximum increases by 1 per level". | `category: "traits"`, `modifiers` |
| **charges** | Can be used a limited number of times, then refills on a rest. | `uses` |
| **action** | Something the player does: an attack, a save it forces, healing, or a utility use such as a teleport (then `attack`, `save` and `heal` are null). | `category` = `actions`, `bonus_actions` or `reactions` (by the time it takes; an Opportunity Attack uses your Reaction), and `action` |
| **toggle** | Something the player turns on for a while, which gives bonuses while active (a transformation, a stance). | `toggle` |

A feature can combine these. Breath Weapon is an action with charges.

**Riders on a hit:** "once per turn when you hit, the target takes an extra 1d6 fire damage and must make a Constitution save…". Fill `action` so the sheet can show the numbers:
- `attack` with `bonus: null`, since it uses the weapon's own to-hit, and the extra damage in `attack.damage`;
- `attack.kind` is the attack it rides on: `melee` or `ranged` when the text says so, `any` when it works with any attack roll ("whenever you hit it with an attack roll");
- `save` with its ability, DC and effects;
- `category` stays `traits`, because it isn't an action of its own.
- Fill it even when there is only extra damage and no save (e.g. "the target takes an extra 1d10 fire damage").
- "Damage of the weapon's type" uses the damage type `weapon`.

**An attack you already have, with new numbers:** when the text changes how one of your own attacks works (its damage, its damage type, or the ability it uses), it is still an attack with numbers, not a passive trait. Examples: an Unarmed Strike that deals 1d6 + your Strength modifier, or a weapon that uses your spellcasting ability for its attack and damage rolls. It goes in `actions` (you make it with the Attack action), even when it is listed among a race's or feat's traits: it is an attack of its own, not a rider. Fill `action.attack`:
- `bonus`: `pb` plus the modifier of the ability it uses (`"pb + str_mod"`, `"pb + spell_mod"`);
- `damage`: the dice the text gives, with that ability's modifier as `bonus`;
- if you choose one of several forms (claws, fangs or hooves), add one damage part per form, each with its form as a short `condition`.

Something that happens on your Reaction (including an Opportunity Attack) goes in `reactions`, even when it's a weapon attack with no numbers of its own (then `action` is null).

### Values and formulas

Every number is a `Value`: `{"value": "...", "steps": [...]}`.

- **`value`** is a plain number (`"1"`), a formula (`"8 + con_mod + pb"`) or dice (`"2d6"`).
- **Formula words:**
  - `pb` (proficiency bonus), `level` (character level)
  - ability scores: `str` `dex` `con` `int` `wis` `cha`
  - ability modifiers: `str_mod` `dex_mod` `con_mod` `int_mod` `wis_mod` `cha_mod`
  - `spell_mod`: the spellcasting ability modifier this entry uses
  - `max(a, b)`, `min(a, b)`, numbers, `+ - * / ( )`
  - Nothing else is allowed.
- **`steps`** are for values that grow at certain levels: "2d6, increasing to 3d6 at 6th level, 4d6 at 11th" becomes `{"value": "2d6", "steps": [{"level": 6, "value": "3d6"}, {"level": 11, "value": "4d6"}]}`. Use `[]` when it never changes.
- **"A number of times equal to your proficiency bonus"** is `"pb"`. **"Once"** is `"1"`.
- **"Your Constitution modifier (minimum of 1)"** is `"max(1, con_mod)"`.

### `uses`

- `max` is a Value.
- `reset` is `"short"` (a short or long rest) or `"long"` (a long rest only).

### `action`

- `range` and `area`: as written, e.g. `"5 ft."`, `"15-foot cone"`; null if none.
- `attack`, when an attack roll is made:
  - `kind`: `melee`, `ranged` or `spell`
  - `bonus`: the to-hit formula
  - `damage`: dealt on a hit
- `save`, when targets make a saving throw (`conditions`: only conditions the text says the **target** gets on a failed save, like "has the prone condition"; something else, like the target's speed becoming 0 or *you* becoming invisible, is not a condition and stays in the text):
  - `ability` and `dc`
  - `on_success`: `"half"` or `"none"`
  - `damage`, and `conditions` it can cause
  - If there is also an `attack`, the save happens on a hit.
- **Each damage part:**
  - `dice`: dice only, e.g. `"1d4"`
  - `bonus`: the flat part, e.g. `"str_mod"`
  - `type`: the damage type
  - `condition`: only for a part that applies in some cases, in a few words from the text ("instead if the target is missing any Hit Points", "extra against Undead"); null otherwise.
  - Damage is what one hit or one target takes, as written. Don't add up several darts, rays or beams ("three darts, each 1d4 + 1" is 1d4 + 1).
  - Attack damage and save damage are always kept apart: a critical hit doubles only the attack's dice.
- `damage`: damage dealt with no attack roll and no save (it just happens, e.g. Magic Missile); `[]` otherwise.
- `heal`: a Value, or null. `temp_hp`: temporary hit points it gives, a Value, or null.
- `per_slot`, `heal_per_slot`, `temp_hp_per_slot`: only for spells (see the spells section); null otherwise.

### `modifiers` (always on, or inside a toggle)

- `target`: one of the allowed targets.
- `op`: `"add"`. A negative value lowers the number.
- **For `target: "ac"` only:**
  - `op` can also be `"base"` (another way to work out AC, e.g. natural armor `"13 + dex_mod"`), `"min"` (AC can't be lower than this) or `"set"` (AC becomes exactly this).
  - `requires` can hold `armor`, `no_armor`, `shield`, `no_shield` when the text says so.
- `requires` is `[]` for every other target.
- A bonus to rolls may be dice (`"1d4"`) for the targets `attack`, `save.<ability>` and `check.<skill>`.

### `toggle`

- `uses_charge`: true if turning it on spends one of the feature's `uses`.
- `grants` and `modifiers`: what applies while it is on.

### `level`

The character level the feature starts at: 1, unless the text says "starting at 3rd level" or similar.

---

## 2. `extra_grants`

List fixed things the text gives the character:
- skill, save, tool, weapon and armor proficiencies
- languages
- resistances, immunities and vulnerabilities, and condition immunities
- senses with their range
- speeds

Rules:
- Ids are snake_case: `animal_handling`, `thieves_tools`, `light_hammer`, `deep_speech`.
- Only **fixed** things. If the player chooses ("one skill of your choice", "Insight, Perception, or Survival"), leave it out. Choices are handled elsewhere.
- Only what the text clearly states. It's fine if the app already knows some of them; duplicates are removed afterwards.
- Speeds are feet as a string (`"35"`), or `"walk"` for "equal to your walking speed".
- Everything else is `[]` or null.

---

## Short shapes for cases the examples don't show

An attack that also forces a save on a hit (the poison isn't doubled on a crit):

```json
"action": {"range": "5 ft.", "area": null, "heal": null,
  "attack": {"kind": "melee", "bonus": {"value": "dex_mod + pb", "steps": []},
             "damage": [{"dice": {"value": "1d4", "steps": []}, "bonus": {"value": "dex_mod", "steps": []}, "type": "piercing"}]},
  "save": {"ability": "con", "dc": {"value": "8 + con_mod + pb", "steps": []}, "on_success": "half",
           "damage": [{"dice": {"value": "3d6", "steps": []}, "bonus": null, "type": "poison"}], "conditions": []}}
```

A transformation that is turned on once per long rest and gives a flying speed:

```json
"uses": {"max": {"value": "1", "steps": []}, "reset": "long"},
"toggle": {"uses_charge": true, "modifiers": [],
  "grants": {"skills": [], "saves": [], "tools": [], "languages": [], "weapons": [], "armor": [],
             "resist": [], "immune": [], "vulnerable": [], "condition_immune": [], "senses": [],
             "speed": {"walk": null, "fly": "walk", "swim": null, "climb": null, "burrow": null}}}
```

A rider: when you hit, +1d6 cold damage and a Constitution save, DC 8 + PB + Str or Con:

```json
"action": {"range": null, "area": null, "heal": null,
  "attack": {"kind": "melee", "bonus": null, "damage": [{"dice": {"value": "1d6", "steps": []}, "bonus": null, "type": "cold"}]},
  "save": {"ability": "con", "dc": {"value": "8 + pb + max(str_mod, con_mod)", "steps": []}, "on_success": "none", "damage": [], "conditions": []}}
```

Natural armor, AC 13 + Dex while not wearing armor:

```json
"modifiers": [{"target": "ac", "op": "base", "value": {"value": "13 + dex_mod", "steps": []}, "requires": ["no_armor"]}]
```