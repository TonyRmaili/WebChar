# Task

You are transforming a single D&D 5e race entry from a messy scraped source into a clean structured format for a character builder. The input has already been partially cleaned: `_copy` references are resolved, `_versions` are expanded into subraces, and color-variant clutter has been dropped. Your job is to extract mechanical data into the schema and strip metadata.

Return only a valid JSON object matching the schema. No preamble, no commentary, no code fences.

# Output rules

**Every field in the schema must be present in the output.** There are no optional fields from your perspective — you must emit them all.

- For fields with no value, use `null`. Examples: `spell_ability: null`, `senses.tremorsense: null`.
- For empty lists, use `[]`. Examples: `spells: []`, `traits: []`, `defenses.immunities: []`.
- For empty dicts, use `{}`. Example: `abilities.fixed: {}` when the race has no fixed ability bonuses.
- Never omit a key. Never emit undefined. Always produce complete objects.

# Field-by-field rules

**name** — Use the input `name` as-is.

**source** — Use the input `source` as-is.

**creature_type** — Default `"humanoid"`. Override only if a trait explicitly says otherwise (e.g., "Your creature type is fey"). Always lowercase.

**sizes** — Convert: `"T"` → `"tiny"`, `"S"` → `"small"`, `"M"` → `"medium"`, `"L"` → `"large"`. Output as a list.

**speed** — Always emit a full Speed object with every key. Integer input is walk speed; set the others to `null`. Dict input maps keys directly. Unused keys are `null`, not missing.

Example for a race with walk 30 only:
```json
{"walk": 30, "fly": null, "swim": null, "climb": null, "burrow": null, "hover": null}
```

**senses** — Always emit a full Senses object. Integer ranges in feet for `darkvision`, `tremorsense`, `blindsight`, `truesight`. Any sense the race doesn't have is `null`. A trait like "Darkvision with a range of 120 feet" overrides any top-level value.

**abilities** — Always emit with both `fixed` and `choose`. `fixed` is always a full object with all six abilities, using `null` for ones not granted.
- `{"str": 2, "cha": 1}` → `"abilities": {"fixed": {"str": 2, "dex": null, "con": null, "int": null, "wis": null, "cha": 1}, "choose": null}`
- `{"choose": {"from": [...], "count": 1, "amount": 2}}` → `"abilities": {"fixed": {"str": null, "dex": null, "con": null, "int": null, "wis": null, "cha": null}, "choose": {"options": [...], "count": 1, "amount": 2}}`
- No ability bonus at all → `"abilities": {"fixed": {"str": null, "dex": null, "con": null, "int": null, "wis": null, "cha": null}, "choose": null}`

**defenses** — Always emit all four lists. Extract from `resist`/`immune`/`vulnerable` fields AND from trait text:
- `resist: ["poison"]` → `resistances: ["poison"]`
- Trait "Resistance to fire damage" → add `"fire"` to `resistances`
- Trait "Advantage on saves against being Poisoned" → add `"poisoned"` to `condition_advantages`
- A `resist` block like `[{"choose": {"from": [...]}}]` means the player picks one. Leave `resistances` empty, BUT you must describe the choice clearly inside the related trait's notes (typically the "Damage Resistance" trait or equivalent). Do not let the choice information get lost.
- `resist: null` means no resistance granted — keep the list empty.

Empty defenses:
```json
{"resistances": [], "immunities": [], "vulnerabilities": [], "condition_advantages": []}
```

**proficiencies** — Always emit all five sub-objects (languages, skills, tools, weapons, armor). Each sub-object always emits all its fields.
- Strip source suffixes: `"rapier|phb"` → `"rapier"`.
- `{"any": N}` → `choose: {options: "any", count: N, amount: null}`.
- Sentinels: `anyArtisansTool` → `"any_artisan_tool"`, `anyStandard` → `"any_standard"`, `anyMusicalInstrument` → `"any_musical_instrument"`, `anyTool` → `"any_tool"`, `anyGamingSet` → `"any_gaming_set"`, `anyExotic` → `"any_exotic"`.
- Armor categories (`light`, `medium`, `heavy`, `shield`) and weapon categories (`simple`, `martial`) go in `categories`, not `fixed`.
- **Casing**: all proficiency entries are lowercase. `"Common"` → `"common"`, `"Draconic"` → `"draconic"`, `"Longbow"` → `"longbow"`, `"Perception"` → `"perception"`.

Empty proficiency group: `{"fixed": [], "choose": null}`
Empty weapons/armor group: `{"fixed": [], "categories": []}`

**spells** — Flatten `additionalSpells` into a list. Every spell emits a full Spell object.
- `known` and `innate` both map to `category: "innate"`. `expanded` maps to `category: "expanded"`.
- Integer level keys (`"1"`, `"3"`, `"5"`) map to `level_available`.
- `daily` → `uses.type: "per_long_rest"`. `rest` → `uses.type: "per_short_rest"`. Bare list → `uses.type: "at_will"`, `count: null`.
- `expanded` → `uses.type: "class_list_addition"`, `count: null`, `level_available: 1`.
- Count tokens: `"1"` → `1`, `"1e"` → `1`, `"pb"` → `"proficiency_bonus"`.
- Strip spell name suffixes: `"heroism|xphb"` → `"heroism"`, `"starry wisp|xphb#c"` → `"starry wisp"`.
- **Casing**: spell names are lowercase. `"Heroism"` → `"heroism"`, `"Starry Wisp"` → `"starry wisp"`.

**Named spell blocks — IMPORTANT**: If an `additionalSpells` block has a `"name"` field (e.g., `"name": "Lorwyn"`), those spells belong to the **subrace** with the matching name, NOT to the parent race. Route the spells into that subrace's `spells` field. Leave the parent's `spells` empty (or containing only unnamed, shared blocks). Match subrace names case-insensitively with partial matching: `"Lorwyn"` matches a subrace named `"Lorwyn Lineage"`.

No spells → `"spells": []`.

**spell_ability** — From the `ability` field inside `additionalSpells`:
- `"int"` → `"int"`
- `{"choose": ["int", "wis", "cha"]}` → `{"options": ["int", "wis", "cha"], "count": 1, "amount": null}`
- No spellcasting → `null`

For named spell blocks routed to subraces, the `spell_ability` belongs to the subrace too, not the parent.

**traits** — Convert each mechanical entry in `entries` into a Trait (`name` + `notes`):
- Clean markup: `{@spell Fireball|XPHB}` → `Fireball`. `{@damage 2d6}` → `2d6`. `{@dc 15}` → `DC 15`. `{@condition poisoned}` → `poisoned`. `{@skill Perception}` → `Perception`. `{@variantrule Long Rest|XPHB}` → `Long Rest`. `{@item Longbow|XPHB}` → `Longbow`.
- Join paragraphs with blank lines inside `notes`.
- When a trait contains a table, render the table as concise prose inside `notes`. Example for Draconic Ancestry: "Choose one ancestry: Black (acid, 5x30 line, Dex save), Blue (lightning, 5x30 line, Dex save), Brass (fire, 5x30 line, Dex save), Bronze (lightning, 5x30 line, Dex save), Copper (acid, 5x30 line, Dex save), Gold (fire, 15 ft cone, Dex save), Green (poison, 15 ft cone, Con save), Red (fire, 15 ft cone, Dex save), Silver (cold, 15 ft cone, Con save), White (cold, 15 ft cone, Con save)."
- **SKIP entries that are purely flavor**: "Age", "Alignment", "Size" (when just describing physical dimensions). Only include entries with game-mechanical effects.
- **SKIP duplicate traits**: If a trait just restates information already captured in a structured field, omit it. Specifically:
  - Skip a "Darkvision" trait if its only content is stating the darkvision range (already in `senses.darkvision`).
  - Skip a "Languages" trait if its only content is listing languages the character knows (already in `proficiencies.languages`).
  - Keep the trait if it describes a mechanical effect beyond the basic sense or language list — e.g., "Darkvision 120 feet; when you use darkvision in dim light, the area is illuminated as if it were bright light" would be kept because it has extra mechanics.
- Keep entries like: Dwarven Resilience, Dwarven Toughness, Breath Weapon, Draconic Ancestry, Fey Ancestry, Keen Senses, Trance, Stonecunning, etc.

No mechanical traits → `"traits": []`.

**sub_races** — For each item in `subraces`:
- `name` — strip the parent name and parentheses. Examples: `"Dragonborn (Black)"` → `"Black"`, `"Draconblood"` → `"Draconblood"`, `"Hill"` → `"Hill"`, `"Variant; Aquatic Elf Descent"` → `"Aquatic Elf Descent"`, `"Lorwyn Lineage"` → `"Lorwyn"`.
- `display_name` — how the frontend renders it. Usually `"{name} {parent_name}"`: `"Black Dragonborn"`, `"Hill Dwarf"`, `"Lorwyn Elf"`. Use judgment to avoid awkward duplication.
- `source` — from the subrace entry.

**Subrace override rule**: A subrace's data describes what it ADDS TO or OVERRIDES on the parent. For any field the subrace does NOT override, emit `null` (for object fields) or `[]` (for list fields).

- If a subrace doesn't change speed → `"speed": null`
- If a subrace doesn't change senses → `"senses": null` (not an object with all nulls)
- If a subrace doesn't add abilities → `"abilities": null`
- If a subrace doesn't add defenses → `"defenses": null` (NOT an empty defenses object)
- If a subrace doesn't change proficiencies → `"proficiencies": null`
- If a subrace has no additional spells → `"spells": []`
- If a subrace has no extra traits → `"traits": []`
- If a subrace has no spellcasting → `"spell_ability": null`

Be consistent: use `null` for object-type unchanged fields, `[]` for list-type unchanged fields. Do not emit empty objects like `{"resistances": [], "immunities": [], ...}` when the subrace doesn't override defenses — use `null` instead.

When a named spell block (e.g., `"name": "Lorwyn"`) in the parent's raw `additionalSpells` matches this subrace, those spells belong here in this subrace's `spells` field, along with the corresponding `spell_ability`.

No subraces → `"sub_races": []`.

# Forbidden

- Do not invent effects not stated in the input.
- Do not copy flavor or lore into trait notes unless it's the mechanical rules text itself.
- Do not omit any schema fields. Every field must be present with a value, `null`, `[]`, or `{}`.
- Do not retain `_copy`, `_versions`, `traitTags`, `reprintedAs`, `overwrite`, or other metadata fields.
- Do not emit markdown code fences around the output.
- Do not duplicate a sense or language as a trait when it's already captured in `senses` or `proficiencies.languages`.
- Do not leave resistance/choice information entirely unstructured — at minimum, the related trait's notes must describe any choose-based resistances.