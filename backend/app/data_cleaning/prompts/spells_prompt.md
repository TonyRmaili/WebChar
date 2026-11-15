## Category: spells

`kind` is `spell`. The input also has `spell_level` (0 = cantrip) and `casting_time` ("1 action", "1 bonus action", "1 reaction, which you take when …"). Range, components, duration, concentration, ritual and the class lists are already handled by code: never make features for them.

**This entry is the spell itself.** The shared rule "Spells are tracked on the spells themselves" is about entries that *give* spells, so it doesn't apply here.

**The higher-level paragraph:** the text usually ends with `**Using a Higher-Level Spell Slot.** …` or `**Cantrip Upgrade.** …`. Never make a feature for it: its numbers go into `per_slot` or `steps`.

**Features:**
- Make a feature when the spell has numbers for the sheet: an attack, a save, damage, healing or temporary hit points, or a toggle with modifiers or grants. **A saving throw alone is enough:** "must succeed on a Wisdom saving throw or have the Charmed condition" is a feature with that save (DC, ability, `conditions`) even with no damage. A spell without any of these (Alarm, Comprehend Languages, Find Familiar) has no features: the sheet shows its text.
- The spell's main effect uses the spell's own `name` (the sheet then shows the whole text). Named options inside the spell (`- **Clenched Fist.** …`) get their own feature when they have numbers.
- `category` comes from the time it takes: the main feature follows `casting_time` (action → `actions`, bonus action → `bonus_actions`, reaction → `reactions`, anything longer → `actions`). An option used later "as a Bonus Action" goes in `bonus_actions`.
- `level` is 1. `uses` is null: spell slots are tracked elsewhere.

**Numbers:**
- Spell attack bonus: `"pb + spell_mod"`. Save DC: `"8 + pb + spell_mod"`.
- **Upcasting** ("increases by 1d6 for each spell slot level above 3"): write the base dice as written, and the added dice in `per_slot` (`"1d6"`), on the damage part it belongs to. Healing uses `heal_per_slot`, temporary hit points `temp_hp_per_slot`. Anything that grows in another way (more targets, one more dart or ray, longer duration) stays in the text, and then `per_slot` is null. Only use `per_slot` when the higher-level text adds dice to that damage or healing.
- **Cantrip damage** that grows at levels 5, 11 and 17 uses `steps`: `{"value": "1d10", "steps": [{"level": 5, "value": "2d10"}, {"level": 11, "value": "3d10"}, {"level": 17, "value": "4d10"}]}`.
- Damage with no attack roll and no save (it just happens) goes in `action.damage`.
- "Your spellcasting ability modifier" is `spell_mod`. An attack that "uses your spellcasting ability modifier for the attack and damage rolls" has the bonus `"pb + spell_mod"` and `spell_mod` as the damage's `bonus`.

**Buffs** (Mage Armor, Shield, Fly, Bless, Darkvision, Aid's +5 hit point maximum): a `toggle` the player switches on while the spell lasts, holding what it gives: `modifiers` (AC, a +1d4 roll bonus) and `grants` (speeds, senses, resistances). `uses_charge` is false. A choice the caster makes ("a damage type of your choice") stays in the text. Advantage, invisibility and similar effects stay in the text.

**`extra_grants`:** always empty for spells. What a spell gives goes in its toggle.
