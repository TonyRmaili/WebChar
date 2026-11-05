You will be given a D&D 5e magic item currently typed as "Generic Variant".
Do two things and return them as JSON.

You MUST use the item's name AND entries to make decisions. The name often 
states the category outright; the entries confirm or refine it.

═══════════════════════════════════════════════════════════════════
TASK 1: Assign one or more types from this exact list.

Spellcasting Focus, Melee Weapon, Instrument, Rod, Wand, Adventuring Gear,
Trade Good, Other, Ring, Vehicle, Tool, Treasure, Shield, Heavy Armor, Mount,
Medium Armor, Potion, Explosive, Gaming Set, Ranged Weapon, Light Armor,
Scroll, Ammunition, Tattoo, Poison.

Core principle:
Types describe what the object PHYSICALLY IS, not what it DOES.
A sword that heals is still a Melee Weapon, not a Potion.
A wand that grants AC is still a Wand, not a Shield.
A spellcasting focus that reduces damage is still a Spellcasting Focus.
The item's mechanical effects belong in the entries text, not in types.

Rules:
- Use only types from this list. Never invent new ones.
- Include EVERY type that genuinely applies. Generic variants often apply 
  to multiple item kinds. Be thorough, not minimal.
- Umbrella terms in the name mean ALL applicable subtypes:
    "Armor" alone → Light Armor, Medium Armor, Heavy Armor (all three)
    "Weapon" alone → Melee Weapon, Ranged Weapon (both)
    A specific qualifier overrides the umbrella:
      "+1 Plate Armor" → Heavy Armor only
      "+1 Greatsword" → Melee Weapon only
- If entries explicitly state "you can use this as a [type]" (e.g. 
  "use this orb as a spellcasting focus"), that type MUST be included.
- Be conservative on adding extras. Only include a type if the name OR 
  entries genuinely support it.
- If genuinely nothing fits, return ["Other"]. Never return an empty list.

Examples:
  "+1 Armor" → ["Light Armor", "Medium Armor", "Heavy Armor"]
  "+1 Weapon" → ["Melee Weapon", "Ranged Weapon"]
  "+3 Shield" → ["Shield"]
  "Ammunition, +2" → ["Ammunition"]
  "Flame Tongue Greatsword" → ["Melee Weapon"]
  "Orb of Shielding" with entries mentioning "use as a spellcasting focus" 
    → ["Spellcasting Focus"]
  "Wand of Wonder" → ["Wand"]
  "Boots of Speed" → ["Other"]   (no specific type fits "boots")
  "Cloak of Protection" → ["Other"]

═══════════════════════════════════════════════════════════════════
TASK 2: Rewrite the item's entries as a single clean string.

Rules:
- Replace template tokens like {=bonusWeapon} with their plain meaning. For 
  a generic variant covering multiple bonus tiers, write "+1, +2, or +3" or 
  similar. If the value is fixed by the item name (e.g. "+3 Weapon"), use 
  the specific number.
- Strip all 5etools markup: anything in {} braces or || pipe syntax 
  becomes plain language.
- Preserve every mechanical detail: DCs, damage, durations, ranges, 
  conditions, saving throws, recharge timing, action economy.
- If entries contain a table, flatten it into the prose. Example: a d100 
  table becomes "On a roll of 1-10 Aberrations, 11-15 Beasts, 
  16-20 Celestials, ..." in line with the surrounding text.
- Combine multiple entries into one continuous paragraph with single 
  space separators. No newlines.
- Do not invent flavor. Do not summarize away mechanical detail.

═══════════════════════════════════════════════════════════════════
Output JSON matching the schema. No commentary, no markdown fencing.