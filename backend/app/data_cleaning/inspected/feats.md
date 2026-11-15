# feats

## feats → `feat` · 317 entries

### Keys

| path | in entries | types | values / examples |
|---|---|---|---|
| `_file` | 317 (100%) | str 317 | `feats.json` 317 |
| `_versions` | 2 (1%) | list 2 |  |
| `_versions[]` | 2 (1%) | dict 9 |  |
| `_versions[]._mod` | 2 (1%) | dict 9 |  |
| `_versions[]._mod.entries` | 2 (1%) | list 9 |  |
| `_versions[].additionalSpells` | 1 (0%) | list 3 |  |
| `_versions[].additionalSpells[]` | 1 (0%) | dict 3 |  |
| `_versions[].additionalSpells[].ability` | 1 (0%) | dict 3 |  |
| `_versions[].additionalSpells[].ability.choose` | 1 (0%) | list 3 |  |
| `_versions[].additionalSpells[].ability.choose[]` | 1 (0%) | str 9 | `int` 3 · `wis` 3 · `cha` 3 |
| `_versions[].additionalSpells[].innate` | 1 (0%) | dict 3 |  |
| `_versions[].additionalSpells[].innate._` | 1 (0%) | dict 3 |  |
| `_versions[].additionalSpells[].innate._.daily` | 1 (0%) | dict 3 |  |
| `_versions[].additionalSpells[].innate._.daily.1` | 1 (0%) | list 3 |  |
| `_versions[].additionalSpells[].innate._.daily.1[]` | 1 (0%) | dict 3 |  |
| `_versions[].additionalSpells[].innate._.daily.1[].choose` | 1 (0%) | str 3 | `level=1\|class=Cleric` 1 · `level=1\|class=Druid` 1 · `level=1\|class=Wizard` 1 |
| `_versions[].additionalSpells[].known` | 1 (0%) | dict 3 |  |
| `_versions[].additionalSpells[].known._` | 1 (0%) | list 3 |  |
| `_versions[].additionalSpells[].known._[]` | 1 (0%) | dict 3 |  |
| `_versions[].additionalSpells[].known._[].choose` | 1 (0%) | str 3 | `level=0\|class=Cleric` 1 · `level=0\|class=Druid` 1 · `level=0\|class=Wizard` 1 |
| `_versions[].additionalSpells[].known._[].count` | 1 (0%) | int 3 | `2` 3 |
| `_versions[].name` | 2 (1%) | str 9 | `Magic Initiate; Cleric` 1 · `Magic Initiate; Druid` 1 · `Magic Initiate; Wizard` 1 · `Strike of the Giants; Cloud` 1 · `Strike of the Giants; Fire` 1 · `Strike of the Giants; Frost` 1 · `Strike of the Giants; Hill` 1 · `Strike of the Giants; Stone` 1 · `Strike of the Giants; Storm` 1 |
| `_versions[].source` | 2 (1%) | str 9 | `BGG` 6 · `XPHB` 3 |
| `ability` | 186 (59%) | list 186 |  |
| `ability[]` | 186 (59%) | dict 187 |  |
| `ability[].cha` | 3 (1%) | int 3 | `1` 3 |
| `ability[].choose` | 161 (51%) | dict 162 |  |
| `ability[].choose.amount` | 44 (14%) | int 44 | `1` 43 · `2` 1 |
| `ability[].choose.count` | 1 (0%) | int 1 | `2` 1 |
| `ability[].choose.entry` | 3 (1%) | str 3 | `Increase the spellcasting ability score used by your Dragonmark feat …` 1 · `Increase the chosen ability score by 1, to a maximum of 20.` 1 · `Choose one ability in which you lack saving throw proficiency. Increa…` 1 |
| `ability[].choose.from` | 161 (51%) | list 162 |  |
| `ability[].choose.from[]` | 161 (51%) | str 591 | `wis` 113 · `cha` 111 · `int` 101 · `str` 97 · `dex` 93 · `con` 76 |
| `ability[].con` | 6 (2%) | int 6 | `1` 6 |
| `ability[].dex` | 6 (2%) | int 6 | `1` 6 |
| `ability[].hidden` | 1 (0%) | bool 2 | `True` 2 |
| `ability[].int` | 6 (2%) | int 6 | `1` 6 |
| `ability[].max` | 32 (10%) | int 32 | `30` 32 |
| `ability[].str` | 4 (1%) | int 4 | `1` 4 |
| `additionalSources` | 1 (0%) | list 1 |  |
| `additionalSources[]` | 1 (0%) | dict 2 |  |
| `additionalSources[].page` | 1 (0%) | int 2 | `7` 1 · `115` 1 |
| `additionalSources[].source` | 1 (0%) | str 2 | `EEPC` 1 · `SCAG` 1 |
| `additionalSpells` | 88 (28%) | list 88 |  |
| `additionalSpells[]` | 88 (28%) | dict 150 |  |
| `additionalSpells[].ability` | 67 (21%) | str 42 · dict 79 | `inherit` 13 · `cha` 11 · `wis` 9 · `int` 7 · `con` 2 |
| `additionalSpells[].ability.choose` | 42 (13%) | list 79 |  |
| `additionalSpells[].ability.choose[]` | 42 (13%) | str 237 | `int` 79 · `wis` 79 · `cha` 79 |
| `additionalSpells[].expanded` | 12 (4%) | dict 12 |  |
| `additionalSpells[].expanded.s1` | 12 (4%) | list 12 |  |
| `additionalSpells[].expanded.s1[]` | 12 (4%) | str 24 | `identify\|xphb` 2 · `command\|xphb` 2 · `detect evil and good\|xphb` 1 · `faerie fire\|xphb` 1 · `longstrider\|xphb` 1 · `find familiar\|xphb` 1 · `false life\|xphb` 1 · `healing word\|xphb` 1 · `goodberry\|xphb` 1 · `sleep\|xphb` 1 · `tenser's floating disk\|xphb` 1 · `expeditious retreat\|xphb` 1 · `jump\|xphb` 1 · `illusory script\|xphb` 1 · `compelled duel\|xphb` 1 · `shield of faith\|xphb` 1 · `disguise self\|xphb` 1 · `silent image\|xphb` 1 · `feather fall\|xphb` 1 · `fog cloud\|xphb` 1 · `armor of agathys\|xphb` 1 · `sanctuary\|xphb` 1 |
| `additionalSpells[].expanded.s2` | 12 (4%) | list 12 |  |
| `additionalSpells[].expanded.s2[]` | 12 (4%) | str 24 | `pass without trace\|xphb` 2 · `detect thoughts\|xphb` 1 · `find traps\|xphb` 1 · `locate animals or plants\|xphb` 1 · `mind spike\|xphb` 1 · `beast sense\|xphb` 1 · `calm emotions\|xphb` 1 · `arcane vigor\|xphb` 1 · `prayer of healing\|xphb` 1 · `aid\|xphb` 1 · `enhance ability\|xphb` 1 · `continual flame\|xphb` 1 · `spiritual weapon\|xphb` 1 · `find steed\|xphb` 1 · `animal messenger\|xphb` 1 · `silence\|xphb` 1 · `warding bond\|xphb` 1 · `zone of truth\|xphb` 1 · `darkness\|xphb` 1 · `levitate\|xphb` 1 · `shatter\|xphb` 1 · `knock\|xphb` 1 · `nystul's magic aura\|xphb` 1 |
| `additionalSpells[].expanded.s3` | 12 (4%) | list 12 |  |
| `additionalSpells[].expanded.s3[]` | 12 (4%) | str 24 | `clairvoyance\|xphb` 3 · `nondetection\|xphb` 1 · `speak with plants\|xphb` 1 · `beacon of hope\|xphb` 1 · `conjure animals\|xphb` 1 · `aura of vitality\|xphb` 1 · `mass healing word\|xphb` 1 · `create food and water\|xphb` 1 · `leomund's tiny hut\|xphb` 1 · `conjure barrage\|xphb` 1 · `elemental weapon\|xphb` 1 · `blink\|xphb` 1 · `phantom steed\|xphb` 1 · `sending\|xphb` 1 · `tongues\|xphb` 1 · `counterspell\|xphb` 1 · `protection from energy\|xphb` 1 · `major image\|xphb` 1 · `sleet storm\|xphb` 1 · `wind wall\|xphb` 1 · `glyph of warding\|xphb` 1 · `magic circle\|xphb` 1 |
| `additionalSpells[].expanded.s4` | 12 (4%) | list 12 |  |
| `additionalSpells[].expanded.s4[]` | 12 (4%) | str 24 | `arcane eye\|xphb` 2 · `divination\|xphb` 2 · `aura of life\|xphb` 2 · `aura of purity\|xphb` 2 · `locate creature\|xphb` 1 · `dominate beast\|xphb` 1 · `mordenkainen's private sanctum\|xphb` 1 · `fabricate\|xphb` 1 · `stone shape\|xphb` 1 · `dimension door\|xphb` 1 · `freedom of movement\|xphb` 1 · `confusion\|xphb` 1 · `death ward\|xphb` 1 · `guardian of faith\|xphb` 1 · `greater invisibility\|xphb` 1 · `hallucinatory terrain\|xphb` 1 · `conjure minor elementals\|xphb` 1 · `control water\|xphb` 1 · `leomund's secret chest\|xphb` 1 · `mordenkainen's faithful hound\|xphb` 1 |
| `additionalSpells[].expanded.s5` | 12 (4%) | list 12 |  |
| `additionalSpells[].expanded.s5[]` | 12 (4%) | str 12 | `legend lore\|xphb` 1 · `commune with nature\|xphb` 1 · `awaken\|xphb` 1 · `greater restoration\|xphb` 1 · `hallow\|xphb` 1 · `creation\|xphb` 1 · `teleportation circle\|xphb` 1 · `dream\|xphb` 1 · `bigby's hand\|xphb` 1 · `mislead\|xphb` 1 · `conjure elemental\|xphb` 1 · `antilife shell\|xphb` 1 |
| `additionalSpells[].innate` | 29 (9%) | dict 59 |  |
| `additionalSpells[].innate._` | 29 (9%) | dict 59 |  |
| `additionalSpells[].innate._.daily` | 26 (8%) | dict 56 |  |
| `additionalSpells[].innate._.daily.1` | 11 (3%) | list 37 |  |
| `additionalSpells[].innate._.daily.1[]` | 11 (3%) | dict 32 · str 5 | `faerie fire\|xphb` 1 · `misty step` 1 · `cure wounds` 1 · `detect thoughts` 1 · `detect thoughts\|xphb` 1 |
| `additionalSpells[].innate._.daily.1[].choose` | 6 (2%) | str 32 | `level=1\|class=druid;wizard` 6 · `level=1\|class=cleric;wizard` 3 · `level=1\|class=bard;sorcerer` 3 · `level=1\|class=bard;cleric` 3 · `level=1\|class=Cleric` 2 · `level=1\|class=Druid` 2 · `level=1\|class=Wizard` 2 · `level=1\|class=Artificer` 1 · `level=1\|class=Bard` 1 · `level=1\|class=Sorcerer` 1 · `level=1\|class=Warlock` 1 · `level=1\|components & miscellaneous=ritual` 1 · `level=1\|class=Bard\|components & miscellaneous=ritual` 1 · `level=1\|class=Cleric\|components & miscellaneous=ritual` 1 · `level=1\|class=Druid\|components & miscellaneous=ritual` 1 · `level=1\|class=Sorcerer\|components & miscellaneous=ritual` 1 · `level=1\|class=Warlock\|components & miscellaneous=ritual` 1 · `level=1\|class=Wizard\|components & miscellaneous=ritual` 1 |
| `additionalSpells[].innate._.daily.1[].count` | 2 (1%) | int 7 | `2` 7 |
| `additionalSpells[].innate._.daily.1e` | 15 (5%) | list 19 |  |
| `additionalSpells[].innate._.daily.1e[]` | 15 (5%) | dict 13 · str 31 | many, e.g. `gaseous form\|xphb` · `augury` · `levitate` |
| `additionalSpells[].innate._.daily.1e[].choose` | 9 (3%) | str 10 · dict 3 | `level=1\|school=E;D` 2 · `level=1\|school=I;N` 2 · `level=2\|school=E;N` 1 · `level=2\|school=I;T` 1 · `level=2\|school=A;D` 1 · `level=1\|class=warlock` 1 · `level=1\|class=cleric` 1 · `level=1\|class=druid` 1 |
| `additionalSpells[].innate._.daily.1e[].choose.count` | 1 (0%) | int 3 | `2` 3 |
| `additionalSpells[].innate._.daily.1e[].choose.from` | 1 (0%) | list 3 |  |
| `additionalSpells[].innate._.daily.1e[].choose.from[]` | 1 (0%) | str 12 | `dissonant whispers` 1 · `false life` 1 · `hex` 1 · `ray of sickness` 1 · `color spray` 1 · `disguise self` 1 · `feather fall` 1 · `longstrider` 1 · `comprehend languages` 1 · `detect evil and good` 1 · `protection from evil and good` 1 · `shield` 1 |
| `additionalSpells[].innate._.rest` | 1 (0%) | dict 1 |  |
| `additionalSpells[].innate._.rest.1` | 1 (0%) | list 1 |  |
| `additionalSpells[].innate._.rest.1[]` | 1 (0%) | dict 1 |  |
| `additionalSpells[].innate._.rest.1[].choose` | 1 (0%) | str 1 | `level=1\|class=Sorcerer` 1 |
| `additionalSpells[].innate._.ritual` | 2 (1%) | list 2 |  |
| `additionalSpells[].innate._.ritual[]` | 2 (1%) | str 2 | `find familiar` 2 |
| `additionalSpells[].innate._.will` | 2 (1%) | list 2 |  |
| `additionalSpells[].innate._.will[]` | 2 (1%) | str 2 | `detect magic` 1 · `nondetection` 1 |
| `additionalSpells[].known` | 35 (11%) | dict 71 |  |
| `additionalSpells[].known._` | 35 (11%) | list 71 |  |
| `additionalSpells[].known._[]` | 35 (11%) | dict 32 · str 54 | many, e.g. `minor illusion\|xphb#c` · `vicious mockery\|xphb#c` · `friends\|xphb#c` |
| `additionalSpells[].known._[].choose` | 16 (5%) | str 32 | `level=0\|class=Wizard` 7 · `level=0\|class=Cleric` 6 · `level=0\|class=Sorcerer` 3 · `level=0\|class=Druid` 3 · `level=0\|class=Cleric;Wizard\|school=N` 1 · `level=0\|class=Artificer` 1 · `level=0\|class=cleric` 1 · `level=0\|class=druid` 1 · `level=0\|class=Bard` 1 · `level=0\|class=Warlock` 1 · `level=0\|class=Bard\|spell attack=m;r;o` 1 · `level=0\|class=Cleric\|spell attack=m;r;o` 1 · `level=0\|class=Druid\|spell attack=m;r;o` 1 · `level=0\|class=Sorcerer\|spell attack=m;r;o` 1 · `level=0\|class=Warlock\|spell attack=m;r;o` 1 · `level=0\|class=Wizard\|spell attack=m;r;o` 1 · `level=0\|class=warlock` 1 |
| `additionalSpells[].known._[].count` | 10 (3%) | int 24 | `2` 13 · `1` 11 |
| `additionalSpells[].name` | 12 (4%) | str 73 | many, e.g. `Abjuration` · `Conjuration` · `Divination` |
| `additionalSpells[].prepared` | 38 (12%) | dict 59 |  |
| `additionalSpells[].prepared.1` | 1 (0%) | list 1 |  |
| `additionalSpells[].prepared.13` | 2 (1%) | dict 1 · list 1 |  |
| `additionalSpells[].prepared.13.daily` | 1 (0%) | dict 1 |  |
| `additionalSpells[].prepared.13.daily.1` | 1 (0%) | list 1 |  |
| `additionalSpells[].prepared.13.daily.1[]` | 1 (0%) | str 1 | `symbol\|xphb` 1 |
| `additionalSpells[].prepared.13[]` | 1 (0%) | dict 1 |  |
| `additionalSpells[].prepared.13[].choose` | 1 (0%) | str 1 | `level=1\|components & miscellaneous=ritual` 1 |
| `additionalSpells[].prepared.13[].count` | 1 (0%) | int 1 | `1` 1 |
| `additionalSpells[].prepared.17` | 1 (0%) | list 1 |  |
| `additionalSpells[].prepared.17[]` | 1 (0%) | dict 1 |  |
| `additionalSpells[].prepared.17[].choose` | 1 (0%) | str 1 | `level=1\|components & miscellaneous=ritual` 1 |
| `additionalSpells[].prepared.17[].count` | 1 (0%) | int 1 | `1` 1 |
| `additionalSpells[].prepared.1[]` | 1 (0%) | dict 1 |  |
| `additionalSpells[].prepared.1[].choose` | 1 (0%) | str 1 | `level=1\|components & miscellaneous=ritual` 1 |
| `additionalSpells[].prepared.1[].count` | 1 (0%) | int 1 | `2` 1 |
| `additionalSpells[].prepared.3` | 7 (2%) | dict 7 |  |
| `additionalSpells[].prepared.3.daily` | 7 (2%) | dict 7 |  |
| `additionalSpells[].prepared.3.daily.1` | 7 (2%) | list 7 |  |
| `additionalSpells[].prepared.3.daily.1[]` | 7 (2%) | str 7 | `see invisibility\|xphb` 1 · `locate object\|xphb` 1 · `lesser restoration\|xphb` 1 · `calm emotions\|xphb` 1 · `magic mouth\|xphb` 1 · `gust of wind\|xphb` 1 · `arcane lock\|xphb` 1 |
| `additionalSpells[].prepared.5` | 2 (1%) | dict 1 · list 1 |  |
| `additionalSpells[].prepared.5.daily` | 1 (0%) | dict 1 |  |
| `additionalSpells[].prepared.5.daily.1` | 1 (0%) | list 1 |  |
| `additionalSpells[].prepared.5.daily.1[]` | 1 (0%) | str 1 | `glyph of warding\|xphb` 1 |
| `additionalSpells[].prepared.5[]` | 1 (0%) | dict 1 |  |
| `additionalSpells[].prepared.5[].choose` | 1 (0%) | str 1 | `level=1\|components & miscellaneous=ritual` 1 |
| `additionalSpells[].prepared.5[].count` | 1 (0%) | int 1 | `1` 1 |
| `additionalSpells[].prepared.9` | 1 (0%) | list 1 |  |
| `additionalSpells[].prepared.9[]` | 1 (0%) | dict 1 |  |
| `additionalSpells[].prepared.9[].choose` | 1 (0%) | str 1 | `level=1\|components & miscellaneous=ritual` 1 |
| `additionalSpells[].prepared.9[].count` | 1 (0%) | int 1 | `1` 1 |
| `additionalSpells[].prepared._` | 28 (9%) | dict 45 · list 4 |  |
| `additionalSpells[].prepared._.daily` | 23 (7%) | dict 44 |  |
| `additionalSpells[].prepared._.daily.1` | 21 (7%) | list 40 |  |
| `additionalSpells[].prepared._.daily.1[]` | 21 (7%) | dict 9 · str 34 | many, e.g. `animal shapes\|xphb` · `control weather\|xphb` · `demiplane\|xphb` |
| `additionalSpells[].prepared._.daily.1[].choose` | 2 (1%) | str 9 | `level=1;2;3;4;5;6;7\|school=A` 1 · `level=1;2;3;4;5;6;7\|school=C` 1 · `level=1;2;3;4;5;6;7\|school=D` 1 · `level=1;2;3;4;5;6;7\|school=E` 1 · `level=1;2;3;4;5;6;7\|school=V` 1 · `level=1;2;3;4;5;6;7\|school=I` 1 · `level=1;2;3;4;5;6;7\|school=N` 1 · `level=1;2;3;4;5;6;7\|school=T` 1 · `level=1;2;3;4;5;6;7;8\|class=Sorcerer` 1 |
| `additionalSpells[].prepared._.daily.1e` | 2 (1%) | list 4 |  |
| `additionalSpells[].prepared._.daily.1e[]` | 2 (1%) | dict 6 · str 2 | `beast sense\|xphb` 1 · `speak with animals\|xphb` 1 |
| `additionalSpells[].prepared._.daily.1e[].choose` | 1 (0%) | str 6 | `level=1\|class=Cleric` 1 · `level=2\|class=Cleric` 1 · `level=1\|class=Druid` 1 · `level=2\|class=Druid` 1 · `level=1\|class=Wizard` 1 · `level=2\|class=Wizard` 1 |
| `additionalSpells[].prepared._.rest` | 1 (0%) | dict 1 |  |
| `additionalSpells[].prepared._.rest.1` | 1 (0%) | list 1 |  |
| `additionalSpells[].prepared._.rest.1[]` | 1 (0%) | dict 1 |  |
| `additionalSpells[].prepared._.rest.1[].choose` | 1 (0%) | str 1 | `level=1\|class=Sorcerer` 1 |
| `additionalSpells[].prepared._.will` | 1 (0%) | list 8 |  |
| `additionalSpells[].prepared._.will[]` | 1 (0%) | dict 8 |  |
| `additionalSpells[].prepared._.will[].choose` | 1 (0%) | str 8 | `level=1\|school=A` 1 · `level=1\|school=C` 1 · `level=1\|school=D` 1 · `level=1\|school=E` 1 · `level=1\|school=V` 1 · `level=1\|school=I` 1 · `level=1\|school=N` 1 · `level=1\|school=T` 1 |
| `additionalSpells[].prepared._[]` | 4 (1%) | str 4 · dict 1 | `otto's irresistible dance\|xphb` 1 · `speak with animals\|xphb` 1 · `charm person\|xphb` 1 · `spider climb\|xphb` 1 |
| `additionalSpells[].prepared._[].choose` | 1 (0%) | str 1 | `level=1\|school=E;I` 1 |
| `additionalSpells[].prepared.s1` | 8 (3%) | list 8 |  |
| `additionalSpells[].prepared.s1[]` | 8 (3%) | str 8 | `shield\|xphb` 1 · `entangle\|xphb` 1 · `detect evil and good\|xphb` 1 · `dissonant whispers\|xphb` 1 · `chromatic orb\|xphb` 1 · `silent image\|xphb` 1 · `inflict wounds\|xphb` 1 · `jump\|xphb` 1 |
| `additionalSpells[].prepared.s2` | 8 (3%) | list 8 |  |
| `additionalSpells[].prepared.s2[]` | 8 (3%) | str 8 | `lesser restoration\|xphb` 1 · `misty step\|xphb` 1 · `mind spike\|xphb` 1 · `enthrall\|xphb` 1 · `shatter\|xphb` 1 · `phantasmal force\|xphb` 1 · `ray of enfeeblement\|xphb` 1 · `spider climb\|xphb` 1 |
| `additionalSpells[].prepared.s3` | 8 (3%) | list 8 |  |
| `additionalSpells[].prepared.s3[]` | 8 (3%) | str 8 | `protection from energy\|xphb` 1 · `conjure animals\|xphb` 1 · `clairvoyance\|xphb` 1 · `hold person\|xphb` 1 · `fireball\|xphb` 1 · `major image\|xphb` 1 · `vampiric touch\|xphb` 1 · `slow\|xphb` 1 |
| `additionalSpells[].prepared.s4` | 8 (3%) | list 8 |  |
| `additionalSpells[].prepared.s4[]` | 8 (3%) | str 8 | `banishment\|xphb` 1 · `dimension door\|xphb` 1 · `divination\|xphb` 1 · `dominate beast\|xphb` 1 · `vitriolic sphere\|xphb` 1 · `hallucinatory terrain\|xphb` 1 · `blight\|xphb` 1 · `polymorph\|xphb` 1 |
| `additionalSpells[].prepared.s5` | 8 (3%) | list 8 |  |
| `additionalSpells[].prepared.s5[]` | 8 (3%) | str 8 | `mass cure wounds\|xphb` 1 · `conjure elemental\|xphb` 1 · `scrying\|xphb` 1 · `modify memory\|xphb` 1 · `wall of force\|xphb` 1 · `seeming\|xphb` 1 · `raise dead\|xphb` 1 · `animate objects\|xphb` 1 |
| `armorProficiencies` | 6 (2%) | list 6 |  |
| `armorProficiencies[]` | 6 (2%) | dict 6 |  |
| `armorProficiencies[].heavy` | 2 (1%) | bool 2 | `True` 2 |
| `armorProficiencies[].light` | 2 (1%) | bool 2 | `True` 2 |
| `armorProficiencies[].medium` | 2 (1%) | bool 2 | `True` 2 |
| `armorProficiencies[].shield` | 2 (1%) | bool 2 | `True` 2 |
| `basicRules2024` | 17 (5%) | bool 17 | `True` 17 |
| `bonusSenses` | 1 (0%) | list 1 |  |
| `bonusSenses[]` | 1 (0%) | dict 1 |  |
| `bonusSenses[].darkvision` | 1 (0%) | int 1 | `60` 1 |
| `category` | 209 (66%) | str 209 | `G` 103 · `O` 38 · `EB` 32 · `D` 13 · `FS` 11 · `DG` 9 · `FS:R` 2 · `FS:P` 1 |
| `conditionImmune` | 2 (1%) | list 2 |  |
| `conditionImmune[]` | 2 (1%) | str 2 | `poisoned` 1 · `frightened` 1 |
| `entries` | 317 (100%) | list 317 |  |
| `expertise` | 7 (2%) | list 7 |  |
| `expertise[]` | 7 (2%) | dict 7 |  |
| `expertise[].anyProficientSkill` | 5 (2%) | int 5 | `1` 5 |
| `expertise[].intimidation` | 1 (0%) | bool 1 | `True` 1 |
| `expertise[].perception` | 1 (0%) | bool 1 | `True` 1 |
| `hasFluffImages` | 44 (14%) | bool 44 | `True` 44 |
| `immune` | 2 (1%) | list 2 |  |
| `immune[]` | 2 (1%) | str 2 | `radiant` 1 · `poison` 1 |
| `languageProficiencies` | 7 (2%) | list 7 |  |
| `languageProficiencies[]` | 7 (2%) | dict 8 |  |
| `languageProficiencies[].any` | 5 (2%) | int 5 | `1` 4 · `3` 1 |
| `languageProficiencies[].draconic` | 1 (0%) | bool 1 | `True` 1 |
| `languageProficiencies[].sylvan` | 1 (0%) | bool 1 | `True` 1 |
| `languageProficiencies[].thieves' cant` | 1 (0%) | bool 1 | `True` 1 |
| `name` | 317 (100%) | str 317 | many, e.g. `Aberrant Anatomy` · `Aberrant Dragonmark` · `Ability Score Improvement` |
| `optionalfeatureProgression` | 4 (1%) | list 4 |  |
| `optionalfeatureProgression[]` | 4 (1%) | dict 4 |  |
| `optionalfeatureProgression[].featureType` | 4 (1%) | list 4 |  |
| `optionalfeatureProgression[].featureType[]` | 4 (1%) | str 4 | `EI` 1 · `FS:F` 1 · `MV:B` 1 · `MM` 1 |
| `optionalfeatureProgression[].name` | 4 (1%) | str 4 | `Eldritch Invocations` 1 · `Fighting Style` 1 · `Maneuvers` 1 · `Metamagic` 1 |
| `optionalfeatureProgression[].progression` | 4 (1%) | dict 4 |  |
| `optionalfeatureProgression[].progression.*` | 4 (1%) | int 4 | `1` 2 · `2` 2 |
| `otherSources` | 4 (1%) | list 4 |  |
| `otherSources[]` | 4 (1%) | dict 4 |  |
| `otherSources[].source` | 4 (1%) | str 4 | `PL` 4 |
| `page` | 315 (99%) | int 315 | many, e.g. `32` · `39` · `52` |
| `prerequisite` | 236 (74%) | list 236 |  |
| `prerequisite[]` | 236 (74%) | dict 255 |  |
| `prerequisite[].ability` | 28 (9%) | list 39 |  |
| `prerequisite[].ability[]` | 28 (9%) | dict 40 |  |
| `prerequisite[].ability[].cha` | 4 (1%) | int 4 | `13` 4 |
| `prerequisite[].ability[].con` | 1 (0%) | int 1 | `13` 1 |
| `prerequisite[].ability[].dex` | 17 (5%) | int 17 | `13` 17 |
| `prerequisite[].ability[].int` | 6 (2%) | int 6 | `13` 6 |
| `prerequisite[].ability[].str` | 8 (3%) | int 8 | `13` 8 |
| `prerequisite[].ability[].wis` | 8 (3%) | int 8 | `13` 8 |
| `prerequisite[].background` | 4 (1%) | list 4 |  |
| `prerequisite[].background[]` | 4 (1%) | dict 4 |  |
| `prerequisite[].background[].displayEntry` | 4 (1%) | str 4 | `{@background Mage of High Sorcery\|DSotDQ}` 1 · `{@background Rune Carver\|BGG}` 1 · `{@background Knight of Solamnia\|DSotDQ}` 1 · `{@background Giant Foundling\|BGG}` 1 |
| `prerequisite[].background[].name` | 4 (1%) | str 4 | `Mage of High Sorcery` 1 · `Rune Carver` 1 · `Knight of Solamnia` 1 · `Giant Foundling` 1 |
| `prerequisite[].campaign` | 30 (9%) | list 34 |  |
| `prerequisite[].campaign[]` | 30 (9%) | str 34 | `Eberron` 14 · `Ravenloft` 9 · `Dragonlance` 7 · `World of Warcraft` 3 · `Planescape` 1 |
| `prerequisite[].exclusiveFeatCategory` | 13 (4%) | list 13 |  |
| `prerequisite[].exclusiveFeatCategory[]` | 13 (4%) | str 13 | `D` 13 |
| `prerequisite[].feat` | 45 (14%) | list 45 |  |
| `prerequisite[].featCategory` | 1 (0%) | list 1 |  |
| `prerequisite[].featCategory[]` | 1 (0%) | str 1 | `D` 1 |
| `prerequisite[].feat[]` | 45 (14%) | str 45 | many, e.g. `initiate of high sorcery\|dsotdq\|initiate of high sorcery (nuitari)` · `initiate of high sorcery\|dsotdq\|initiate of high sorcery (lunitari)` · `initiate of high sorcery\|dsotdq\|initiate of high sorcery (solinari)` |
| `prerequisite[].feature` | 12 (4%) | list 12 |  |
| `prerequisite[].feature[]` | 12 (4%) | str 13 | `Fighting Style` 11 · `Spellcasting` 1 · `Pact Magic` 1 |
| `prerequisite[].level` | 158 (50%) | int 167 · dict 4 | `4` 135 · `19` 32 |
| `prerequisite[].level.class` | 2 (1%) | dict 4 |  |
| `prerequisite[].level.class.name` | 2 (1%) | str 4 | `Sorcerer` 1 · `Wizard` 1 · `Fighter` 1 · `Paladin` 1 |
| `prerequisite[].level.class.visible` | 2 (1%) | bool 4 | `True` 4 |
| `prerequisite[].level.level` | 2 (1%) | int 4 | `1` 4 |
| `prerequisite[].other` | 1 (0%) | str 1 | `No other dragonmark` 1 |
| `prerequisite[].otherSummary` | 3 (1%) | dict 3 |  |
| `prerequisite[].otherSummary.entry` | 3 (1%) | str 3 | `When Gaining the Level 2 Paladin "Fighting Style" Feature` 1 · `When Gaining the Level 2 Ranger "Fighting Style" Feature` 1 · `When Gaining the Level 2 Demon Hunter "Fighting Style" Feature` 1 |
| `prerequisite[].otherSummary.entrySummary` | 3 (1%) | str 3 | `Special` 3 |
| `prerequisite[].proficiency` | 13 (4%) | list 13 |  |
| `prerequisite[].proficiency[]` | 13 (4%) | dict 15 |  |
| `prerequisite[].proficiency[].armor` | 9 (3%) | str 9 | `medium` 4 · `heavy` 2 · `light` 2 · `shield` 1 |
| `prerequisite[].proficiency[].tool` | 1 (0%) | list 3 |  |
| `prerequisite[].proficiency[].tool[]` | 1 (0%) | str 3 | `calligrapher's supplies` 1 · `cartographer's tools` 1 · `painter's supplies` 1 |
| `prerequisite[].proficiency[].weapon` | 1 (0%) | str 1 | `martial` 1 |
| `prerequisite[].proficiency[].weaponGroup` | 2 (1%) | str 2 | `martial` 2 |
| `prerequisite[].race` | 21 (7%) | list 21 |  |
| `prerequisite[].race[]` | 21 (7%) | dict 25 |  |
| `prerequisite[].race[].displayEntry` | 1 (0%) | str 1 | `a Small race` 1 |
| `prerequisite[].race[].name` | 21 (7%) | str 25 | `elf` 5 · `human` 4 · `halfling` 2 · `dragonborn` 2 · `dwarf` 2 · `half-elf` 2 · `gnome` 2 · `tiefling` 2 · `half-orc` 2 · `small race` 1 · `Vampire (Ixalan)` 1 |
| `prerequisite[].race[].subrace` | 4 (1%) | str 4 | `drow` 1 · `high` 1 · `deep` 1 · `wood` 1 |
| `prerequisite[].spellcasting` | 3 (1%) | bool 3 | `True` 3 |
| `prerequisite[].spellcasting2020` | 18 (6%) | bool 18 | `True` 18 |
| `prerequisite[].spellcastingFeature` | 2 (1%) | bool 2 | `True` 2 |
| `repeatable` | 5 (2%) | bool 5 | `True` 5 |
| `repeatableHidden` | 5 (2%) | bool 5 | `True` 5 |
| `reprintedAs` | 50 (16%) | list 50 |  |
| `reprintedAs[]` | 50 (16%) | str 50 | many, e.g. `Aberrant Dragonmark\|EFA` · `Actor\|XPHB` · `Alert\|XPHB` |
| `resist` | 11 (3%) | list 11 |  |
| `resist[]` | 11 (3%) | dict 5 · str 9 | `cold` 3 · `lightning` 2 · `thunder` 1 · `necrotic` 1 · `fire` 1 · `poison` 1 |
| `resist[].choose` | 5 (2%) | dict 5 |  |
| `resist[].choose.count` | 1 (0%) | int 1 | `2` 1 |
| `resist[].choose.from` | 5 (2%) | list 5 |  |
| `resist[].choose.from[]` | 5 (2%) | str 26 | `necrotic` 4 · `psychic` 4 · `radiant` 4 · `poison` 3 · `acid` 2 · `cold` 2 · `fire` 2 · `lightning` 2 · `thunder` 2 · `force` 1 |
| `savingThrowProficiencies` | 2 (1%) | list 2 |  |
| `savingThrowProficiencies[]` | 2 (1%) | dict 2 |  |
| `savingThrowProficiencies[].choose` | 2 (1%) | dict 2 |  |
| `savingThrowProficiencies[].choose.from` | 2 (1%) | list 2 |  |
| `savingThrowProficiencies[].choose.from[]` | 2 (1%) | str 12 | `str` 2 · `dex` 2 · `con` 2 · `int` 2 · `wis` 2 · `cha` 2 |
| `senses` | 4 (1%) | list 4 |  |
| `senses[]` | 4 (1%) | dict 4 |  |
| `senses[].blindsight` | 3 (1%) | int 3 | `10` 2 · `15` 1 |
| `senses[].truesight` | 1 (0%) | int 1 | `60` 1 |
| `skillProficiencies` | 12 (4%) | list 12 |  |
| `skillProficiencies[]` | 12 (4%) | dict 12 |  |
| `skillProficiencies[].acrobatics` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].animal handling` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].any` | 2 (1%) | int 2 | `1` 2 |
| `skillProficiencies[].arcana` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].athletics` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].choose` | 7 (2%) | dict 7 |  |
| `skillProficiencies[].choose.from` | 7 (2%) | list 7 |  |
| `skillProficiencies[].choose.from[]` | 7 (2%) | str 59 | `investigation` 5 · `insight` 5 · `arcana` 4 · `history` 4 · `nature` 4 · `religion` 4 · `perception` 4 · `persuasion` 4 · `athletics` 3 · `acrobatics` 3 · `deception` 3 · `intimidation` 3 · `performance` 3 · `sleight of hand` 2 · `stealth` 2 · `animal handling` 2 · `medicine` 2 · `survival` 2 |
| `skillProficiencies[].deception` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].history` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].insight` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].intimidation` | 2 (1%) | bool 2 | `True` 2 |
| `skillProficiencies[].investigation` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].medicine` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].nature` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].perception` | 2 (1%) | bool 2 | `True` 2 |
| `skillProficiencies[].performance` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].persuasion` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].religion` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].sleight of hand` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].stealth` | 1 (0%) | bool 1 | `True` 1 |
| `skillProficiencies[].survival` | 1 (0%) | bool 1 | `True` 1 |
| `skillToolLanguageProficiencies` | 2 (1%) | list 2 |  |
| `skillToolLanguageProficiencies[]` | 2 (1%) | dict 2 |  |
| `skillToolLanguageProficiencies[].choose` | 2 (1%) | list 2 |  |
| `skillToolLanguageProficiencies[].choose[]` | 2 (1%) | dict 2 |  |
| `skillToolLanguageProficiencies[].choose[].count` | 2 (1%) | int 2 | `3` 2 |
| `skillToolLanguageProficiencies[].choose[].from` | 2 (1%) | list 2 |  |
| `skillToolLanguageProficiencies[].choose[].from[]` | 2 (1%) | str 4 | `anySkill` 2 · `anyTool` 2 |
| `source` | 317 (100%) | str 317 | `XPHB` 77 · `PHB` 42 · `FRHoF` 34 · `AU` 29 · `EFA` 28 · `ABH` 16 · `TCE` 15 · `XGE` 15 · `WoW` 12 · `RHW` 11 · `DSotDQ` 9 · `BGG` 8 · `SatO` 7 · `FTD` 3 · `ERLW` 2 · `LFL` 2 · `PSK` 2 · `SCC` 2 · `BMT` 1 · `MTF` 1 · `PSX` 1 |
| `srd` | 1 (0%) | bool 1 | `True` 1 |
| `srd52` | 17 (5%) | bool 17 | `True` 17 |
| `toolProficiencies` | 10 (3%) | list 10 |  |
| `toolProficiencies[]` | 10 (3%) | dict 10 |  |
| `toolProficiencies[].any` | 1 (0%) | int 1 | `1` 1 |
| `toolProficiencies[].anyArtisansTool` | 2 (1%) | int 2 | `1` 2 |
| `toolProficiencies[].anyMusicalInstrument` | 2 (1%) | int 2 | `1` 1 · `3` 1 |
| `toolProficiencies[].choose` | 1 (0%) | dict 1 |  |
| `toolProficiencies[].choose.count` | 1 (0%) | int 1 | `3` 1 |
| `toolProficiencies[].choose.from` | 1 (0%) | list 1 |  |
| `toolProficiencies[].choose.from[]` | 1 (0%) | str 8 | `carpenter's tools` 1 · `leatherworker's tools` 1 · `mason's tools` 1 · `potter's tools` 1 · `smith's tools` 1 · `tinker's tools` 1 · `weaver's tools` 1 · `woodcarver's tools` 1 |
| `toolProficiencies[].cook's utensils` | 2 (1%) | bool 2 | `True` 2 |
| `toolProficiencies[].poisoner's kit` | 2 (1%) | bool 2 | `True` 2 |
| `traitTags` | 9 (3%) | list 9 |  |
| `traitTags[]` | 9 (3%) | str 9 | `Speed` 8 · `Damage Resistance` 1 |
| `weaponProficiencies` | 4 (1%) | list 4 |  |
| `weaponProficiencies[]` | 4 (1%) | dict 4 |  |
| `weaponProficiencies[].choose` | 1 (0%) | dict 1 |  |
| `weaponProficiencies[].choose.count` | 1 (0%) | int 1 | `4` 1 |
| `weaponProficiencies[].choose.fromFilter` | 1 (0%) | str 1 | `type=martial weapon;mundane weapon\|miscellaneous=mundane` 1 |
| `weaponProficiencies[].firearms` | 1 (0%) | bool 1 | `True` 1 |
| `weaponProficiencies[].improvised` | 1 (0%) | bool 1 | `True` 1 |
| `weaponProficiencies[].martial` | 1 (0%) | bool 1 | `True` 1 |

### Facets

- **source:** XPHB 77 · PHB 42 · FRHoF 34 · AU 29 · EFA 28 · ABH 16 · TCE 15 · XGE 15 · WoW 12 · RHW 11 · DSotDQ 9 · BGG 8 · SatO 7 · FTD 3 · ERLW 2 · LFL 2 · PSK 2 · SCC 2 · BMT 1 · MTF 1 · PSX 1
- **edition:** (missing) 317
- **srd:** (missing) 316 · true 1
- **srd52:** (missing) 300 · true 17
- **basicRules:** (missing) 317
- **basicRules2024:** (missing) 300 · true 17

**Editions per source**

| source | editions |
|---|---|
| ABH | (none) 16 |
| AU | (none) 29 |
| BGG | (none) 8 |
| BMT | (none) 1 |
| DSotDQ | (none) 9 |
| EFA | (none) 28 |
| ERLW | (none) 2 |
| FRHoF | (none) 34 |
| FTD | (none) 3 |
| LFL | (none) 2 |
| MTF | (none) 1 |
| PHB | (none) 42 |
| PSK | (none) 2 |
| PSX | (none) 1 |
| RHW | (none) 11 |
| SCC | (none) 2 |
| SatO | (none) 7 |
| TCE | (none) 15 |
| WoW | (none) 12 |
| XGE | (none) 15 |
| XPHB | (none) 77 |

### Copies

0 entries use `_copy`.

### Rich text nodes

| type | count | keys |
|---|---|---|
| `entries` | 407 | type 407 · name 406 · entries 407 |
| `list` | 85 | type 85 · items 85 · style 25 |
| `item` | 40 | type 40 · name 40 · entries 40 |
| `table` | 33 | type 33 · caption 30 · colLabels 33 · colStyles 33 · rows 33 |
| `(no type)` | 18 | mode 18 · replace 12 · items 12 · names 6 |
| `inset` | 4 | type 4 · name 4 · entries 4 |
| `section` | 1 | type 1 · entries 1 |

### Tags

| tag | count | example |
|---|---|---|
| `variantrule` | 522 | `{@variantrule Expertise\|XPHB}` |
| `spell` | 329 | `{@spell Shield\|XPHB}` |
| `item` | 91 | `{@item cook's utensils\|phb}` |
| `condition` | 84 | `{@condition Stunned\|XPHB}` |
| `filter` | 77 | `{@filter cantrip of your choice from the Sorcerer spell list\|spells\|l…` |
| `dice` | 76 | `{@dice d20}` |
| `skill` | 70 | `{@skill Perception\|XPHB}` |
| `action` | 69 | `{@action Dodge\|XPHB}` |
| `damage` | 36 | `{@damage 1d8}` |
| `feat` | 23 | `{@feat Initiate of High Sorcery\|DSotDQ}` |
| `status` | 21 | `{@status surprised}` |
| `itemProperty` | 15 | `{@itemProperty T\|XPHB\|Thrown}` |
| `dc` | 10 | `{@dc 8}` |
| `creature` | 8 | `{@creature servo\|psk\|servos}` |
| `quickref` | 7 | `{@quickref difficult terrain\|\|3}` |
| `sense` | 6 | `{@sense Blindsight\|XPHB}` |
| `book` | 4 | `{@book Dungeon Master's Guide\|DMG}` |
| `b` | 4 | `{@b Battle Fury.}` |
| `background` | 4 | `{@background Mage of High Sorcery\|DSotDQ}` |
| `table` | 4 | `{@table skills\|phb\|skill proficiency}` |
| `chance` | 2 | `{@chance 10}` |
| `language` | 1 | `{@language Sylvan}` |
| `hazard` | 1 | `{@hazard burning\|XPHB}` |
| `class` | 1 | `{@class fighter\|phb\|Battle Master\|Battle Master\|phb\|2-0}` |
