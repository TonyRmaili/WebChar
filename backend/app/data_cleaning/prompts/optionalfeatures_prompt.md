## Category: optional features

`kind` is `optional_feature`.

Eldritch invocations, maneuvers, metamagic, fighting styles, infusions, runes and the like. They are short; most are one plain paragraph, so the feature uses the entry's own `name`.

- `level` is 1. A prerequisite ("5th level", "Pact of the Blade") is tracked elsewhere.
- No features for blocks that only state whether it can be taken more than once ("Repeatable"), or only state a prerequisite.
- **A cost paid from a class resource is not `uses`.** "Expend one superiority die", "spend 2 sorcery points", "spend 1 ki point": the app already knows that cost, so `uses` is null. Use `uses` only for "once per long rest"-style limits of the option itself.
- **A die that comes from the class is not written as dice.** The superiority die or martial arts die changes with the class level, so leave that damage part out. Fixed dice ("1d6") are written as usual.
- **Save DCs:** "your spell save DC" is `"8 + pb + spell_mod"`. When the text names another class DC without its numbers ("your maneuver save DC", "your ki save DC"), `dc` is null.
- **A rule that changes one spell or one kind of attack** (add your Charisma modifier to Eldritch Blast's damage; +2 to ranged weapon attack rolls) is a passive trait. Use `modifiers` only when the number applies to everything its target covers: `attack` and `damage` modifiers apply to every attack, so they are wrong for these.
