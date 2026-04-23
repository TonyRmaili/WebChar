# Task

You are transforming a single D&D 5e race entry from a messy scraped source into a clean structured format for a character builder. The input has already been partially cleaned: `_copy` references are resolved, `_versions` are expanded into subraces, and color-variant clutter has been dropped. Your job is to extract mechanical data into the schema and strip metadata.

Return only a valid JSON object matching the schema. No preamble, no commentary, no code fences.

# Field-by-field rules

**name** — Use the input `name` as-is.

**source** — Use the input `source` as-is.

**creature_type** — Default `"humanoid"`. Override only if a trait explicitly says otherwise (e.g., "Your creature type is fey"). Always lowercase.

**sizes** — Convert: `"T"` → `"tiny"`, `"S"` → `"small"`, `"M"` → `"medium"`, `"L"` → `"large"`.

**speed** — Integer input is walk speed. Dict input maps keys directly: `{walk, fly, swim, climb, burrow, hover}`.

**senses** — Integer ranges in feet for `darkvision`, `tremorsense`, `blindsight`, `truesight`. A trait like "Darkvision with a range of 120 feet" overrides any top-level value.

**abilities** — From `ability` array:
- `{"str": 2, "cha": 1}` → `abilities.fixed: {"str": 2, "cha": 1}`
- `{"choose": {"from": [...], "count": 1, "amount": 2}}` → `abilities.choose: {options: [...], count: 1, amount: 2}`

**defenses** — Extract from `resist`/`immune`/`vulnerable` fields AND from trait text:
- `resist: ["poison"]` → `resistances: ["poison"]`
- Trait "Resistance to fire damage" → `resistances: ["fire"]` (if not already present)
- Trait "Advantage on saves against being Poisoned" → `condition_advantages: ["poisoned"]`
- A `resist` block like `[{"choose": {"from": [...]}}]` means the player picks one. Encode the chosen options as-is in `resistances` if clear, or leave empty and let the trait describe the choice.
- `resist: null` means explicitly no resistance granted — leave the list empty.

**proficiencies** — Normalize all `*Proficiencies` blocks:
- Strip source suffixes: `"rapier|phb"` → `"rapier"`.
- `{"any": N}` → `choose: {options: "any", count: N}`.
- Sentinels: `anyArtisansTool` → `"any_artisan_tool"`, `anyStandard` → `"any_standard"`, `anyMusicalInstrument` → `"any_musical_instrument"`, `anyTool` → `"any_tool"`, `anyGamingSet` → `"any_gaming_set"`, `anyExotic` → `"any_exotic"`.
- Armor categories (`light`, `medium`, `heavy`, `shield`) and weapon categories (`simple`, `martial`) go in `categories`, not `fixed`.

**spells** — Flatten `additionalSpells` into a list of Spell entries:
- `known` and `innate` both map to `category: "innate"`. `expanded` maps to `category: "expanded"`.
- Integer level keys (`"1"`, `"3"`, `"5"`) map to `level_available`.
- `daily` → `uses.type: "per_long_rest"`. `rest` → `uses.type: "per_short_rest"`. Bare list → `uses.type: "at_will"`, `count: null`.
- `expanded` → `uses.type: "class_list_addition"`, `count: null`, `level_available: 1`.
- Count tokens: `"1"` → `1`, `"1e"` → `1`, `"pb"` → `"proficiency_bonus"`.
- Strip spell name suffixes: `"heroism|xphb"` → `"heroism"`, `"starry wisp|xphb#c"` → `"starry wisp"`.

**spell_ability** — From the `ability` field in `additionalSpells`:
- `"int"` → `"int"`
- `{"choose": ["int", "wis", "cha"]}` → `{"options": ["int", "wis", "cha"], "count": 1}`

**traits** — Convert each mechanical entry in `entries` into a Trait (`name` + `notes`):
- Clean markup: `{@spell Fireball|XPHB}` → `Fireball`. `{@damage 2d6}` → `2d6`. `{@dc 15}` → `DC 15`. `{@condition poisoned}` → `poisoned`. `{@skill Perception}` → `Perception`. `{@variantrule Long Rest|XPHB}` → `Long Rest`. `{@item Longbow|XPHB}` → `Longbow`.
- Join paragraphs with blank lines inside `notes`.
- When a trait contains a table, render the table as concise prose inside `notes`. Example: for Draconic Ancestry, write: "Choose one ancestry: Black (acid, 5x30 line, Dex save), Blue (lightning, 5x30 line, Dex save), Brass (fire, 5x30 line, Dex save), Bronze (lightning, 5x30 line, Dex save), Copper (acid, 5x30 line, Dex save), Gold (fire, 15 ft cone, Dex save), Green (poison, 15 ft cone, Con save), Red (fire, 15 ft cone, Dex save), Silver (cold, 15 ft cone, Con save), White (cold, 15 ft cone, Con save)."
- **SKIP entries that are purely flavor**: "Age", "Alignment", "Size" (when just describing physical dimensions). Only include entries with game-mechanical effects.
- Keep entries like: Darkvision, Dwarven Resilience, Dwarven Toughness, Breath Weapon, Draconic Ancestry, Fey Ancestry, Keen Senses, Trance, Stonecunning, etc.

**sub_races** — For each item in `subraces`:
- `name` — strip the parent name and parentheses wrapper. Examples: `"Dragonborn (Black)"` → `"Black"`, `"Draconblood"` → `"Draconblood"`, `"Hill"` → `"Hill"`, `"Variant; Aquatic Elf Descent"` → `"Aquatic Elf Descent"`.
- `display_name` — how the frontend renders it. Usually `"{name} {parent_name}"`: `"Black Dragonborn"`, `"Hill Dwarf"`. If that duplicates words awkwardly, use judgment.
- `source` — from the subrace entry.
- Only populate fields that differ from or add to the parent. Omit fields that are identical.

# Forbidden

- Do not invent effects not stated in the input.
- Do not copy flavor or lore into trait notes unless it's the mechanical rules text itself.
- Do not include fields for categories the race doesn't have (empty defaults are fine only where required).
- Do not retain `_copy`, `_versions`, `traitTags`, `reprintedAs`, `overwrite`, or other metadata fields.
- Do not emit markdown code fences in the output.