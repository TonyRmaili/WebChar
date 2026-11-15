## Category: classes

`kind` is `class_feature` or `subclass`.

- **`class_feature`**: one feature of a class, plus the features it points at (Monk's Focus with Flurry of Blows, Patient Defense and Step of the Wind).
- **`subclass`**: every feature of one subclass, in level order.

The answer here is **`features` and `resources`**. There is no `extra_grants`: a fixed grant goes in the `grants` of the feature that gives it.

### Context in the input

- `class`, `subclass`: whose features these are.
- `features`: every feature of this job with its class level. Each one is a `**Name.**` block in `text`. A feature you return uses one of these names, or the name of a `**Name.**` block inside one of them (then it belongs to that feature).
- `columns`: the class table, as `id (Name): value at level, …`. The ids are formula words here. A die that comes from a column ("your Martial Arts die", "your Bardic Inspiration die") is written as the column id, e.g. `"dice": {"value": "martial_arts", "steps": []}`; a number from a column ("your Rage Damage bonus") likewise, e.g. `"rage_damage"`.
- `resources`: pools the class or subclass already has, as `id (Name)`.
- `class_skills`: the class's skill list, for "one skill from the skills available to <class>".

### Which features to return

Every feature of the job is already on the sheet with its text, as a passive trait. **Return a feature only when it has something to fill in:** a category other than `traits`, `uses`, an `action`, a `toggle`, `modifiers`, `consumes`, `picks` or `grants`. A rule to read and remember needs nothing from you.

- `level` is the feature's class level from `features`. A named block inside a feature has that feature's level.
- **"Starting at 11th level" changes and upgrade notes** (`*Extra Attack (2) (level 11):* …`, `*Indomitable (two uses) (level 13):* …`) belong to the feature above them: put the growth in `steps` (more uses, bigger dice). Never return an upgrade note as a feature.
- `class_level` is a formula word: "your Monk level", "five times your Paladin level" → `"class_level"`, `"5 * class_level"`. `steps` use class levels.

### `resources`

A resource is a pool that features spend: points (Focus Points, Sorcery Points), dice (Superiority Dice, Psionic Energy Dice), or uses shared by several features (Channel Divinity, Rage, Wild Shape, Bardic Inspiration).

- List each pool **this text defines** (says how many there are, or how they come back). Don't list a pool the text only spends.
- `max`: how many. When a column gives it, the column id (`"focus_points"`). When the text gives it, the number with `steps` ("four dice; five at 7th level and six at 15th" → `"4"`, steps 7 → `"5"`, 15 → `"6"`). A formula when the text says so (`"max(1, cha_mod)"`, `"5 * class_level"`).
- `die`: for dice pools only: `"d8"`, with `steps` when it grows ("becomes a d10" at 10th level); null for points and uses.
- `refill`: `short_rest` (all back on a Short or Long Rest), `long_rest` (only a Long Rest), or `long_rest_one_on_short` (all on a Long Rest, one use back on a Short Rest).

### `consumes`, `uses`

- `consumes`: when **every** use of the feature costs from a pool ("you can expend 1 Focus Point to …", "expend one use of your Channel Divinity"), `{"resource": <id from resources, or the snake_case name of a pool you list>, "amount": n}`. If one way of using it is free and another costs (Patient Defense), `consumes` is null; the text says the rest.
- A cost from a pool is never `uses`. `uses` is the feature's own limit: "once per Long Rest", "twice between Long Rests starting at 13th level".

### `picks` and `grants`

- `picks`: what the player chooses: `skills`, `expertise`, `languages`, `tools`, `saves`. `from` is ids (snake_case) or one group:
  - "the skills available to Fighters at level 1" → the `class_skills` list;
  - "two of your skill proficiencies" → `["proficient_skills"]`; "… or your proficiency with Thieves' Tools" → `["proficient_skills_tools"]`;
  - "one type of Artisan's Tools" → `["artisans_tools"]`; "a musical instrument" → `["musical_instruments"]`; "one language of your choice" → `["all_languages"]`.
  - `at`: the class level of a pick that comes later than the feature ("at Rogue level 6, two more"); null otherwise.
- `grants`: what the feature gives with no choice: "proficiency in all saving throws" (`saves`: all six), Heavy armor, a language, Resistance to a damage type, Darkvision. Everything else in it is `[]` or null.
- Picks of spells, invocations, maneuvers, metamagic, fighting styles or a subclass are made elsewhere: no `picks` for them.

### Not for you

- Spellcasting, spell slots, spells added to your list or always prepared: the app reads those from the class data.
- Lists of options from another catalogue (maneuvers, invocations): shown by name only, no features.

### Save DCs and attacks

- "8 plus your Wisdom modifier and Proficiency Bonus" → `"8 + wis_mod + pb"`. "Your spell save DC" → `"8 + pb + spell_mod"`. "Your maneuver save DC" with no numbers in the text → null.
- An attack you make with the Attack action or as a bonus action (Unarmed Strike, a weapon) only gets `action.attack` when the text gives it new numbers; making "two Unarmed Strikes" changes no numbers, so the action has no attack.
