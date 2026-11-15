## Category: items

`kind` is `item` (a magic or mundane item), `base_item` (a mundane weapon, armor, tool… that magic variants build on) or `item_variant` (a template like "+1 Weapon" or "Flame Tongue" that becomes a real item once a base item is picked; its text says `{base}` where that item's name goes).

**Code already handles these, from the item's data:**
- weapon and armor stats, the +N bonus to attacks, damage, AC, saves or spells;
- resistances, immunities, speeds, and an ability score the item sets ("your Strength is 21");
- spells cast from the item (how many charges each one costs, at will, once per dawn);
- the item's charges and how it regains them, attunement, and light.

So never make a feature only for those, and never put them in `extra_grants`.

**Features** are what the player does or switches on with the item:
- an activated power ("As a Magic action, you can…"): `actions`, `bonus_actions` or `reactions`, with its `action` numbers;
- something switched on for a while (a weapon that bursts into flame, boots that double your speed): a `toggle`; if switching it on takes a Bonus Action, the category is `bonus_actions`;
- a rule to remember while wearing or holding it (advantage on Stealth checks, can't be surprised): a passive trait.
- An item that only has numbers code already handles (a +1 sword, a Cloak of Protection, a wand that casts Fireball) has no features.

**Numbers:**
- Items use fixed numbers: "DC 13" is `"13"`, "+5 to hit" is `"5"`. Use a formula only when the text says so ("your spell save DC" is `"8 + pb + spell_mod"`).
- **Charges:** a power that expends the item's charges never gets `uses`: the item's charges are tracked already.
- **Once per dawn:** a power with its own limit ("can't be used again until the next dawn") has `uses: {"max": {"value": "1", "steps": []}, "reset": "dawn"}`.
- Extra damage while a weapon power is on, or on a hit, is a rider: `attack` with `bonus: null` and the extra damage; `kind` is the weapon's (`melee` or `ranged`) or `any`.
- `level` is 1.

**`extra_grants`:** only what the text gives that the data doesn't: a sense ("you have Darkvision out to 60 feet"), a language, a proficiency.
