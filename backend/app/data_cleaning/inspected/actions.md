# actions

## actions → `action` · 48 entries

### Keys

| path | in entries | types | values / examples |
|---|---|---|---|
| `_file` | 48 (100%) | str 48 | `actions.json` 48 |
| `basicRules` | 21 (44%) | bool 21 | `True` 21 |
| `basicRules2024` | 5 (10%) | bool 5 | `True` 5 |
| `entries` | 48 (100%) | list 48 |  |
| `fromVariant` | 8 (17%) | str 8 | `Action Options` 6 · `Healing` 1 · `Spellcasting\|XGE` 1 |
| `name` | 48 (100%) | str 48 | many, e.g. `Activate an Item` · `Attack` · `Cast a Spell` |
| `page` | 48 (100%) | int 48 | many, e.g. `141` · `192` · `361` |
| `reprintedAs` | 19 (40%) | list 19 |  |
| `reprintedAs[]` | 19 (40%) | str 17 · dict 2 | `Help\|XPHB` 2 · `Attack\|XPHB` 1 · `Magic\|XPHB` 1 · `Dash\|XPHB` 1 · `Disengage\|XPHB` 1 · `Dodge\|XPHB` 1 · `Don or Doff a Shield\|XPHB` 1 · `End Concentration\|XPHB` 1 · `Escape a Grapple\|XPHB` 1 · `Hide\|XPHB` 1 · `Improvising an Action\|XPHB` 1 · `Opportunity Attack\|XPHB` 1 · `Ready\|XPHB` 1 · `Search\|XPHB` 1 · `Two-Weapon Fighting\|XPHB` 1 · `Utilize\|XPHB` 1 |
| `reprintedAs[].tag` | 2 (4%) | str 2 | `variantrule` 2 |
| `reprintedAs[].uid` | 2 (4%) | str 2 | `Unarmed Strike\|XPHB` 2 |
| `seeAlsoAction` | 11 (23%) | list 11 |  |
| `seeAlsoAction[]` | 11 (23%) | str 17 | `attack` 4 · `grapple` 2 · `shove aside\|dmg` 2 · `disarm\|dmg` 1 · `mark\|dmg` 1 · `shove` 1 · `two-weapon fighting` 1 · `two-weapon fighting\|xphb` 1 · `escape a grapple` 1 · `tumble\|dmg` 1 · `overrun\|dmg` 1 · `attack\|xphb` 1 |
| `source` | 48 (100%) | str 48 | `PHB` 20 · `XPHB` 18 · `DMG` 8 · `XGE` 2 |
| `srd` | 20 (42%) | bool 20 | `True` 20 |
| `srd52` | 17 (35%) | bool 17 | `True` 17 |
| `time` | 47 (98%) | list 47 |  |
| `time[]` | 47 (98%) | dict 44 · str 6 | `Varies` 4 · `Free` 2 |
| `time[].number` | 41 (85%) | int 44 | `1` 44 |
| `time[].unit` | 41 (85%) | str 44 | `action` 37 · `bonus` 4 · `reaction` 3 |

### Facets

- **source:** PHB 20 · XPHB 18 · DMG 8 · XGE 2
- **edition:** (missing) 48
- **srd:** true 20 · (missing) 28
- **srd52:** (missing) 31 · true 17
- **basicRules:** true 21 · (missing) 27
- **basicRules2024:** (missing) 43 · true 5

**Editions per source**

| source | editions |
|---|---|
| DMG | (none) 8 |
| PHB | (none) 20 |
| XGE | (none) 2 |
| XPHB | (none) 18 |

### Copies

0 entries use `_copy`.

### Rich text nodes

| type | count | keys |
|---|---|---|
| `entries` | 15 | type 15 · name 12 · entries 15 |
| `table` | 3 | type 3 · caption 3 · colLabels 3 · colStyles 3 · rows 3 |
| `inset` | 1 | type 1 · name 1 · entries 1 |
| `list` | 1 | type 1 · items 1 |

### Tags

| tag | count | example |
|---|---|---|
| `skill` | 48 | `{@skill Athletics}` |
| `variantrule` | 30 | `{@variantrule Unarmed Strike\|XPHB}` |
| `action` | 16 | `{@action Use an Object}` |
| `condition` | 13 | `{@condition Incapacitated\|XPHB}` |
| `status` | 11 | `{@status concentration}` |
| `book` | 7 | `{@book Making an Attack\|phb\|9\|making an attack}` |
| `item` | 4 | `{@item shield\|phb}` |
| `dc` | 2 | `{@dc 15}` |
| `subclassFeature` | 1 | `{@subclassFeature Fast Hands\|Rogue\|\|Thief\|\|3}` |
| `quickref` | 1 | `{@quickref difficult terrain\|\|3}` |
| `table` | 1 | `{@table Getting Into and Out of Armor; Donning and Doffing Armor\|phb\|…` |
| `note` | 1 | `{@note Additionally, the Help action may be used to {@book stabilize …` |
| `spell` | 1 | `{@spell shocking grasp}` |
| `dice` | 1 | `{@dice 1d4}` |
