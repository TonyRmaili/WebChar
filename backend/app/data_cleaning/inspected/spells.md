# spells

## spells → `spell` · 1038 entries

### Keys

| path | in entries | types | values / examples |
|---|---|---|---|
| `_file` | 1038 (100%) | str 1038 | `spells/spells-xphb.json` 391 · `spells/spells-phb.json` 361 · `spells/spells-xge.json` 95 · `spells/spells-wow.json` 69 · `spells/spells-au.json` 33 · `spells/spells-tce.json` 21 · `spells/spells-frhof.json` 19 · `spells/spells-egw.json` 15 · `spells/spells-ai.json` 7 · `spells/spells-ftd.json` 7 · `spells/spells-scc.json` 5 · `spells/spells-bmt.json` 3 · `spells/spells-llk.json` 3 · `spells/spells-aag.json` 2 · `spells/spells-idrotf.json` 2 · `spells/spells-sato.json` 2 · `spells/spells-aitfr-avt.json` 1 · `spells/spells-efa.json` 1 · `spells/spells-ggr.json` 1 |
| `abilityCheck` | 57 (5%) | list 57 |  |
| `abilityCheck[]` | 57 (5%) | str 60 | `intelligence` 27 · `strength` 25 · `wisdom` 5 · `dexterity` 3 |
| `additionalSources` | 1 (0%) | list 1 |  |
| `additionalSources[]` | 1 (0%) | dict 1 |  |
| `additionalSources[].page` | 1 (0%) | int 1 | `190` 1 |
| `additionalSources[].source` | 1 (0%) | str 1 | `FTD` 1 |
| `affectsCreatureType` | 77 (7%) | list 77 |  |
| `affectsCreatureType[]` | 77 (7%) | str 428 | `humanoid` 49 · `beast` 40 · `celestial` 39 · `elemental` 39 · `fey` 39 · `fiend` 39 · `aberration` 31 · `plant` 30 · `dragon` 25 · `giant` 25 · `monstrosity` 25 · `ooze` 25 · `undead` 13 · `construct` 9 |
| `alias` | 2 (0%) | list 2 |  |
| `alias[]` | 2 (0%) | str 2 | `Firebolt` 2 |
| `areaTags` | 643 (62%) | list 643 |  |
| `areaTags[]` | 643 (62%) | str 677 | `ST` 324 · `S` 119 · `MT` 89 · `C` 44 · `Y` 23 · `W` 22 · `N` 21 · `Q` 13 · `L` 12 · `R` 5 · `E` 4 · `H` 1 |
| `basicRules` | 127 (12%) | bool 127 | `True` 127 |
| `basicRules2024` | 339 (33%) | bool 339 | `True` 339 |
| `components` | 1038 (100%) | dict 1038 |  |
| `components.m` | 529 (51%) | dict 182 · str 347 | many, e.g. `a coin` · `a pinch of sand` · `a piece of tinder` |
| `components.m.consume` | 86 (8%) | bool 83 · str 3 | `True` 83 · `optional` 3 |
| `components.m.cost` | 173 (17%) | int 173 | `100000` 27 · `10000` 20 · `50000` 20 · `2500` 18 · `5000` 10 · `500000` 9 · `25000` 9 · `30000` 8 · `150000` 8 · `1000` 8 · `40000` 7 · `20000` 4 · `500` 4 · `10` 4 · `60000` 3 · `15000` 3 · `1` 3 · `1500` 2 · `2500000` 2 · `110000` 1 · `99900` 1 · `2` 1 · `100` 1 |
| `components.m.text` | 182 (18%) | str 182 | many, e.g. `a crystal rod worth at least 5,000 gp, which the spell consumes` · `a gem worth at least 50 gp` · `incense and powdered diamond worth at least 300 gp, which the spell c…` |
| `components.r` | 3 (0%) | bool 3 | `True` 3 |
| `components.s` | 867 (84%) | bool 867 | `True` 867 |
| `components.v` | 986 (95%) | bool 986 | `True` 986 |
| `conditionImmune` | 12 (1%) | list 12 |  |
| `conditionImmune[]` | 12 (1%) | str 18 | `poisoned` 4 · `frightened` 4 · `paralyzed` 3 · `charmed` 3 · `restrained` 2 · `petrified` 1 · `prone` 1 |
| `conditionInflict` | 193 (19%) | list 193 |  |
| `conditionInflict[]` | 193 (19%) | str 246 | `charmed` 33 · `blinded` 33 · `restrained` 31 · `prone` 28 · `incapacitated` 20 · `frightened` 18 · `unconscious` 16 · `deafened` 16 · `stunned` 15 · `invisible` 10 · `poisoned` 9 · `petrified` 6 · `paralyzed` 5 · `exhaustion` 4 · `grappled` 2 |
| `damageImmune` | 19 (2%) | list 19 |  |
| `damageImmune[]` | 19 (2%) | str 88 | `poison` 11 · `fire` 9 · `psychic` 9 · `thunder` 8 · `cold` 7 · `acid` 6 · `lightning` 6 · `necrotic` 6 · `radiant` 6 · `bludgeoning` 5 · `force` 5 · `piercing` 5 · `slashing` 5 |
| `damageInflict` | 411 (40%) | list 411 |  |
| `damageInflict[]` | 411 (40%) | str 557 | `fire` 82 · `force` 68 · `necrotic` 62 · `cold` 53 · `psychic` 50 · `radiant` 48 · `lightning` 39 · `bludgeoning` 39 · `acid` 32 · `thunder` 29 · `piercing` 22 · `poison` 21 · `slashing` 12 |
| `damageResist` | 33 (3%) | list 33 |  |
| `damageResist[]` | 33 (3%) | str 145 | `fire` 15 · `cold` 15 · `bludgeoning` 12 · `piercing` 12 · `slashing` 12 · `lightning` 12 · `thunder` 12 · `radiant` 11 · `poison` 11 · `acid` 11 · `necrotic` 9 · `force` 7 · `psychic` 6 |
| `damageVulnerable` | 2 (0%) | list 2 |  |
| `damageVulnerable[]` | 2 (0%) | str 20 | `acid` 2 · `cold` 2 · `fire` 2 · `force` 2 · `lightning` 2 · `necrotic` 2 · `poison` 2 · `psychic` 2 · `radiant` 2 · `thunder` 2 |
| `duration` | 1038 (100%) | list 1038 |  |
| `duration[]` | 1038 (100%) | dict 1041 |  |
| `duration[].concentration` | 438 (42%) | bool 438 | `True` 438 |
| `duration[].duration` | 698 (67%) | dict 698 |  |
| `duration[].duration.amount` | 698 (67%) | int 698 | `1` 489 · `10` 125 · `8` 43 · `24` 32 · `6` 3 · `7` 2 · `30` 2 · `2` 2 |
| `duration[].duration.type` | 698 (67%) | str 698 | `minute` 401 · `hour` 247 · `round` 30 · `day` 20 |
| `duration[].duration.upTo` | 3 (0%) | bool 3 | `True` 3 |
| `duration[].ends` | 28 (3%) | list 28 |  |
| `duration[].ends[]` | 28 (3%) | str 33 | `dispel` 28 · `trigger` 5 |
| `duration[].type` | 1038 (100%) | str 1041 | `timed` 698 · `instant` 312 · `permanent` 28 · `special` 3 |
| `entries` | 1038 (100%) | list 1038 |  |
| `entriesHigherLevel` | 388 (37%) | list 388 |  |
| `hasFluff` | 1 (0%) | bool 1 | `True` 1 |
| `hasFluffImages` | 91 (9%) | bool 91 | `True` 91 |
| `level` | 1038 (100%) | int 1038 | `2` 171 · `1` 162 · `3` 147 · `5` 127 · `4` 110 · `6` 88 · `0` 82 · `7` 56 · `8` 49 · `9` 46 |
| `meta` | 68 (7%) | dict 68 |  |
| `meta.ritual` | 68 (7%) | bool 68 | `True` 68 |
| `miscTags` | 796 (77%) | list 796 |  |
| `miscTags[]` | 796 (77%) | str 1415 | `SGT` 339 · `OBJ` 134 · `UA` 98 · `WLT` 90 · `HL` 73 · `UBA` 72 · `SMN` 66 · `PRM` 62 · `ADV` 53 · `SCT` 49 · `LGT` 47 · `DFT` 45 · `SCL` 44 · `AAD` 39 · `TP` 29 · `OBS` 29 · `FMV` 28 · `THP` 23 · `BO` 23 · `MAC` 20 · `PIR` 14 · `ALT` 11 · `PS` 11 · `RO` 10 · `LGTS` 6 |
| `name` | 1038 (100%) | str 1038 | many, e.g. `Air Bubble` · `Create Spelljamming Helm` · `Distort Value` |
| `otherSources` | 105 (10%) | list 105 |  |
| `otherSources[]` | 105 (10%) | dict 111 |  |
| `otherSources[].page` | 105 (10%) | int 111 | many, e.g. `11` · `50` · `51` |
| `otherSources[].source` | 105 (10%) | str 111 | `RMR` 54 · `EEPC` 43 · `SCAG` 4 · `AitFR-FCD` 2 · `IDRotF` 1 · `GGR` 1 · `ERLW` 1 · `TCE` 1 · `AitFR-AVT` 1 · `EGW` 1 · `VGM` 1 · `MOT` 1 |
| `page` | 1038 (100%) | int 1038 | many, e.g. `22` · `75` · `76` |
| `range` | 1038 (100%) | dict 1038 |  |
| `range.distance` | 1037 (100%) | dict 1037 |  |
| `range.distance.amount` | 691 (67%) | int 691 | `60` 213 · `30` 156 · `120` 106 · `90` 62 · `10` 47 · `150` 32 · `15` 17 · `300` 15 · `5` 14 · `500` 10 · `100` 7 · `1` 7 · `20` 4 · `1000` 1 |
| `range.distance.type` | 1037 (100%) | str 1037 | `feet` 680 · `self` 172 · `touch` 165 · `miles` 11 · `sight` 5 · `unlimited` 4 |
| `range.type` | 1038 (100%) | str 1038 | `point` 942 · `emanation` 39 · `cone` 20 · `radius` 16 · `line` 11 · `sphere` 5 · `cube` 3 · `special` 1 · `hemisphere` 1 |
| `referenceSources` | 469 (45%) | list 469 |  |
| `referenceSources[]` | 469 (45%) | str 2658 | many, e.g. `LoX` · `OoW` · `AitFR-FCD` |
| `reprintedAs` | 389 (37%) | list 389 |  |
| `reprintedAs[]` | 389 (37%) | str 389 | many, e.g. `Summon Dragon\|XPHB` · `Acid Splash\|XPHB` · `Aid\|XPHB` |
| `savingThrow` | 442 (43%) | list 442 |  |
| `savingThrow[]` | 442 (43%) | str 474 | `constitution` 136 · `dexterity` 135 · `wisdom` 115 · `strength` 35 · `charisma` 29 · `intelligence` 24 |
| `scalingLevelDice` | 42 (4%) | dict 37 · list 5 |  |
| `scalingLevelDice.label` | 37 (4%) | str 37 | `fire damage` 3 · `Radiant damage` 3 · `necrotic damage` 2 · `acid damage` 2 · `poison damage` 2 · `cold damage` 2 · `radiant damage` 2 · `lightning damage` 2 · `psychic damage` 2 · `Lightning damage` 2 · `Fire damage` 2 · `Psychic damage` 2 · `damage` 2 · `piercing damage` 1 · `force damage` 1 · `thunder damage` 1 · `Acid damage` 1 · `Necrotic damage` 1 · `Poison damage` 1 · `Cold damage` 1 · `Piercing damage` 1 · `Thunder damage` 1 |
| `scalingLevelDice.scaling` | 37 (4%) | dict 37 |  |
| `scalingLevelDice.scaling.1` | 37 (4%) | str 37 | `1d8` 15 · `1d6` 14 · `1d10` 4 · `1d4` 2 · `1d12` 2 |
| `scalingLevelDice.scaling.11` | 37 (4%) | str 37 | `3d6` 14 · `3d8` 14 · `3d10` 4 · `3d4` 2 · `3d12` 2 · `1d12` 1 |
| `scalingLevelDice.scaling.17` | 37 (4%) | str 37 | `4d6` 14 · `4d8` 14 · `4d10` 4 · `4d4` 2 · `4d12` 2 · `2d6` 1 |
| `scalingLevelDice.scaling.5` | 37 (4%) | str 37 | `2d6` 14 · `2d8` 14 · `2d10` 4 · `2d4` 2 · `2d12` 2 · `1d10` 1 |
| `scalingLevelDice[]` | 5 (0%) | dict 9 |  |
| `scalingLevelDice[].label` | 5 (0%) | str 9 | `thunder damage on moving` 1 · `thunder damage on hit` 1 · `fire damage to secondary creature` 1 · `fire damage on hit` 1 · `necrotic damage` 1 · `necrotic damage to wounded creature` 1 · `Necrotic damage` 1 · `Necrotic damage to wounded creature` 1 · `extra Radiant damage` 1 |
| `scalingLevelDice[].scaling` | 5 (0%) | dict 9 |  |
| `scalingLevelDice[].scaling.1` | 4 (0%) | str 6 | `1d8` 3 · `1d12` 2 · `{{spellcasting_mod}}` 1 |
| `scalingLevelDice[].scaling.11` | 5 (0%) | str 9 | `3d8` 3 · `2d8` 2 · `3d12` 2 · `2d8 + {{spellcasting_mod}}` 1 · `2d6` 1 |
| `scalingLevelDice[].scaling.17` | 5 (0%) | str 9 | `4d8` 3 · `3d8` 2 · `4d12` 2 · `3d8 + {{spellcasting_mod}}` 1 · `3d6` 1 |
| `scalingLevelDice[].scaling.5` | 5 (0%) | str 9 | `2d8` 3 · `1d8` 2 · `2d12` 2 · `1d8 + {{spellcasting_mod}}` 1 · `1d6` 1 |
| `school` | 1038 (100%) | str 1038 | `V` 213 · `T` 182 · `C` 180 · `A` 128 · `E` 100 · `N` 94 · `D` 74 · `I` 67 |
| `source` | 1038 (100%) | str 1038 | `XPHB` 391 · `PHB` 361 · `XGE` 95 · `WoW` 69 · `AU` 33 · `TCE` 21 · `FRHoF` 19 · `EGW` 15 · `AI` 7 · `FTD` 7 · `SCC` 5 · `BMT` 3 · `LLK` 3 · `AAG` 2 · `IDRotF` 2 · `SatO` 2 · `AitFR-AVT` 1 · `EFA` 1 · `GGR` 1 |
| `spellAttack` | 72 (7%) | list 72 |  |
| `spellAttack[]` | 72 (7%) | str 72 | `R` 45 · `M` 27 |
| `srd` | 319 (31%) | bool 302 · str 17 | `True` 302 · `Arcane Hand` 1 · `Instant Summons` 1 · `Black Tentacles` 1 · `Secret Chest` 1 · `Tiny Hut` 1 · `Acid Arrow` 1 · `Faithful Hound` 1 · `Magnificent Mansion` 1 · `Private Sanctum` 1 · `Arcane Sword` 1 · `Arcanist's Magic Aura` 1 · `Freezing Sphere` 1 · `Resilient Sphere` 1 · `Irresistible Dance` 1 · `Telepathic Bond` 1 · `Hideous Laughter` 1 · `Floating Disk` 1 |
| `srd52` | 339 (33%) | bool 322 · str 17 | `True` 322 · `Arcane Hand` 1 · `Instant Summons` 1 · `Black Tentacles` 1 · `Secret Chest` 1 · `Tiny Hut` 1 · `Acid Arrow` 1 · `Faithful Hound` 1 · `Magnificent Mansion` 1 · `Private Sanctum` 1 · `Arcane Sword` 1 · `Arcanist's Magic Aura` 1 · `Freezing Sphere` 1 · `Resilient Sphere` 1 · `Irresistible Dance` 1 · `Telepathic Bond` 1 · `Hideous Laughter` 1 · `Floating Disk` 1 |
| `time` | 1038 (100%) | list 1038 |  |
| `time[]` | 1038 (100%) | dict 1040 |  |
| `time[].condition` | 35 (3%) | str 35 | many, e.g. `which you take when you speak to another creature` · `which you take when you fail a D20 Test or when a creature hits you w…` · `which you take when a creature you can see within 60 feet of you fail…` |
| `time[].note` | 1 (0%) | str 2 | `Overgrowth` 1 · `Enrichment` 1 |
| `time[].number` | 1038 (100%) | int 1040 | `1` 998 · `10` 34 · `8` 4 · `24` 2 · `12` 2 |
| `time[].unit` | 1038 (100%) | str 1040 | `action` 782 · `minute` 104 · `bonus` 99 · `hour` 35 · `reaction` 20 |

### Facets

- **source:** XPHB 391 · PHB 361 · XGE 95 · WoW 69 · AU 33 · TCE 21 · FRHoF 19 · EGW 15 · AI 7 · FTD 7 · SCC 5 · BMT 3 · LLK 3 · AAG 2 · IDRotF 2 · SatO 2 · AitFR-AVT 1 · EFA 1 · GGR 1
- **edition:** (missing) 1038
- **srd:** (missing) 719 · true 302 · a name (str) 17
- **srd52:** (missing) 699 · true 322 · a name (str) 17
- **basicRules:** (missing) 911 · true 127
- **basicRules2024:** (missing) 699 · true 339

**Editions per source**

| source | editions |
|---|---|
| AAG | (none) 2 |
| AI | (none) 7 |
| AU | (none) 33 |
| AitFR-AVT | (none) 1 |
| BMT | (none) 3 |
| EFA | (none) 1 |
| EGW | (none) 15 |
| FRHoF | (none) 19 |
| FTD | (none) 7 |
| GGR | (none) 1 |
| IDRotF | (none) 2 |
| LLK | (none) 3 |
| PHB | (none) 361 |
| SCC | (none) 5 |
| SatO | (none) 2 |
| TCE | (none) 21 |
| WoW | (none) 69 |
| XGE | (none) 95 |
| XPHB | (none) 391 |

### Copies

0 entries use `_copy`.

### Rich text nodes

| type | count | keys |
|---|---|---|
| `entries` | 638 | type 638 · name 638 · entries 638 |
| `item` | 63 | type 63 · name 63 · entries 63 |
| `list` | 58 | type 58 · style 19 · items 58 |
| `cell` | 29 | type 29 · roll 29 |
| `table` | 28 | type 28 · caption 22 · colLabels 28 · colStyles 28 · rows 28 |
| `quote` | 3 | type 3 · entries 3 · by 3 |
| `inset` | 1 | type 1 · name 1 · source 1 · page 1 · entries 1 |

### Tags

| tag | count | example |
|---|---|---|
| `variantrule` | 870 | `{@variantrule Emanation [Area of Effect]\|XPHB\|Emanation}` |
| `damage` | 753 | `{@damage 2d4}` |
| `condition` | 600 | `{@condition charmed}` |
| `spell` | 160 | `{@spell light}` |
| `scaledamage` | 148 | `{@scaledamage 4d4\|3-9\|1d4}` |
| `dice` | 139 | `{@dice 1d6}` |
| `creature` | 132 | `{@creature Battle Familiar\|AU}` |
| `action` | 123 | `{@action Study\|XPHB}` |
| `skill` | 67 | `{@skill Investigation}` |
| `status` | 58 | `{@status concentration}` |
| `quickref` | 49 | `{@quickref difficult terrain\|\|3}` |
| `filter` | 45 | `{@filter magen\|bestiary\|search=magen\|source=IDRotF}` |
| `i` | 33 | `{@i I said what?!}` |
| `sense` | 29 | `{@sense darkvision}` |
| `race` | 24 | `{@race Dragonborn}` |
| `b` | 23 | `{@b Vision of the Far Realm.}` |
| `chance` | 19 | `{@chance 25\|\|\|Random reading!\|Regular reading}` |
| `scaledice` | 14 | `{@scaledice 6d10\|1-9\|2d10}` |
| `item` | 13 | `{@item spelljamming helm\|AAG}` |
| `dc` | 11 | `{@dc 15}` |
| `hazard` | 10 | `{@hazard burning\|XPHB}` |
| `book` | 7 | `{@book school of magic\|PHB\|10\|The Schools of Magic}` |
| `classFeature` | 6 | `{@classFeature Divine Sense\|Paladin\|PHB\|1}` |
| `hit` | 5 | `{@hit +8}` |
| `class` | 3 | `{@class Druid\|WoW}` |
| `d20` | 2 | `{@d20 8}` |
| `adventure` | 1 | `{@adventure appendix C\|IDRotF\|21}` |
| `note` | 1 | `{@note Additional {@filter animal form choices\|bestiary\|Miscellaneous…` |
