# Chunking example: “The Sunken Abbey”

A fake note run through the test chunker (limits: aim for 400 tokens, never cut a block below 800, tiny = under 60).

## 1. The note, as plain text

Headings are shown with `#` (Title), `##` (Heading), `###` (Subheading).

```text
# The Sunken Abbey

A three-level dungeon for 4–5 characters of level 5. The abbey of Saint Orrin slid into Gloamwater Lake a century ago when the lich Dragnipurake tore the ground open to reach the relic beneath it. The party arrives by boat from Harrowfen, hired by the fisherfolk whose nets now come up full of bones.

Running time: two sessions. Session one covers the approach and the drowned nave; session two the crypts and the lich's lair.

## Background

Saint Orrin was a healer who sealed a fragment of the Starless Crown in the abbey's foundations. The crown fragment hums with necrotic power and whispers to anything undead nearby. Dragnipurake, once the abbey's own archivist Brother Daveth, learned of the fragment from forbidden marginalia in the library. He spent forty years preparing his phylactery before he dared to take it.

On the night of the Drowning, Dragnipurake split the lakeshore with a ritual of unmaking. The abbey sank in under an hour. The monks who did not drown rose again as his servants, and they still keep their old routines: ringing bells nobody hears, singing hymns to an empty altar, sweeping floors under three fathoms of black water.

The lich has not yet bonded with the fragment. The saint's last ward still holds it in a reliquary in the lowest crypt, and every year the ward grows weaker. Sister Maelis, the only monk who escaped, believes the ward fails at the next new moon: eleven days after the party arrives.

## Rumours

Roll a d4 or pick one when the party asks around Harrowfen.

- 1. The bells still ring at midnight; you can hear them from the jetty. (True)
- 2. Brother Daveth survived and lives as a hermit on Gull Island. (False: he is the lich)
- 3. Anyone who drinks the lake water dreams of a black crown. (True)
- 4. The abbey's treasure vault holds a thousand gold pieces. (Half true: 300 gp and the hymnal)

## Area 1: The Drowned Nave

Read aloud:
  Green light filters down through the broken rose window. Pews drift in slow circles above the flagstones, and somewhere ahead a bell tolls once, muffled and wrong.
  At the far end, a figure in a dripping habit kneels before the altar, its back to you. It is singing.

[Image: Map of the drowned nave: entrance doors in the south, altar in the north, collapsed bell tower in the east corner]

The nave is fully underwater. Characters without a swim speed or water breathing have disadvantage on attack rolls with weapons other than daggers, javelins, spears and tridents. The kneeling figure is Brother Hollis, a drowned monk (use the @Wight stat block, but it is vulnerable to radiant damage). He finishes his hymn before attacking unless disturbed.

A DC 14 Wisdom (Perception) check spots fresh scratches on the altar: someone has tried to pry it open recently. Beneath it, a stair spirals down to Area 2.

d6 | Encounter in the nave | Notes
1 | 2 drowned monks sweeping | Ignore the party unless touched
2 | A swarm of eels | Use swarm of poisonous snakes, swim 40 ft
3 | The bell rings by itself | Everyone makes a DC 12 Wisdom save or is frightened for 1 minute
4 | A floating hymnal | Contains Brother Daveth's handwriting in the margins
5 | Sister Maelis's lost lantern | Still burning; sheds bright light underwater
6 | Nothing, just silence | Grant inspiration to whoever notices how quiet it is

## Area 2: The Crypts

The crypts are a maze of low vaults where the abbey buried its abbots. The water here is still and cold enough to hurt; each hour a creature spends in it without protection, it must succeed on a DC 10 Constitution saving throw or gain one level of exhaustion. The walls are lined with niches, and in each niche a skull has been turned to face the lowest crypt, as if listening. The lich arranged them this way so that any intruder's footsteps would be heard by the skulls and passed on to him. If the party moves without care, Dragnipurake knows where they are and sends his servants to herd them toward the flooded ossuary, where a bone naga waits coiled among the remains of forty monks. Careful characters can muffle the skulls by turning them back to face the walls, which takes ten minutes for each vault and a DC 13 Dexterity (Stealth) check, or by covering their eye sockets with cloth, wax or mud. Clever parties might even use the skulls against the lich: whispering false plans to them makes Dragnipurake prepare for the wrong attack, and a DC 15 Charisma (Deception) check makes him believe the party has fled entirely. The deepest vault holds the tomb of Abbot Senn, whose ghost still guards the way down. Senn is not hostile at first; he mistakes the party for pilgrims and asks them to pray with him. If they do, he tells them the ward's true name, Orrin's Mercy, which lets anyone who speaks it pass through the ward unharmed. If they refuse or attack him, he wails, and every skull in the crypts begins to scream, alerting the lich and drawing six drowned monks within three rounds. The way down from Senn's tomb is a narrow shaft, barely wide enough for a Medium creature, that drops thirty feet into the reliquary chamber. Anyone who climbs down without a rope must make a DC 12 Strength (Athletics) check or fall and take 3d6 bludgeoning damage as they hit the stone floor below.

Handout: Letter found on Brother Daveth's desk
  Abbot — I have read what the saint left in the margins, and I cannot unread it. There is a crown beneath us, or a piece of one, and it is not holy.
  I ask your leave to study it. I ask only to understand. If you refuse me again, I will understand that too. — D.

## NPCs

### Dragnipurake, the Drowned Lich

Appearance: a skeletal figure in an archivist's robe, its skull crusted with barnacles. Pages of soaked parchment orbit it like fish.

Wants: to bond with the crown fragment before the ward fails, then raise the abbey from the lake as his fortress.

Phylactery: the hymnal the party may find in Area 1. Destroying it requires singing Saint Orrin's last hymn backwards over it.

Combat: use the @Lich stat block. He prefers to flee and return through his drowned servants rather than fight to the end.

### Sister Maelis

A gaunt woman of seventy, the last living monk of Saint Orrin. She runs the Harrowfen shrine and pays the party in relics. She is honest but terrified, and lies only about one thing: she helped Daveth translate the marginalia, and has never forgiven herself.

## Session prep

[x] Print the nave map
[ ] Pick music for the drowned hymn
[ ] Decide what the crown fragment does if a player touches it
```

## 2. The chunks

The whole note is about 1632 tokens. It becomes these chunks; the first line of each is the label that gets embedded with it.

### Chunk 1 · about 124 tokens

```text
Campaign: Salt · Note: The Sunken Abbey · Section: (top of the note)
A three-level dungeon for 4–5 characters of level 5. The abbey of Saint Orrin slid into Gloamwater Lake a century ago when the lich Dragnipurake tore the ground open to reach the relic beneath it. The party arrives by boat from Harrowfen, hired by the fisherfolk whose nets now come up full of bones.
Running time: two sessions. Session one covers the approach and the drowned nave; session two the crypts and the lich's lair.
```

### Chunk 2 · about 264 tokens

```text
Campaign: Salt · Note: The Sunken Abbey · Section: Background
Saint Orrin was a healer who sealed a fragment of the Starless Crown in the abbey's foundations. The crown fragment hums with necrotic power and whispers to anything undead nearby. Dragnipurake, once the abbey's own archivist Brother Daveth, learned of the fragment from forbidden marginalia in the library. He spent forty years preparing his phylactery before he dared to take it.
On the night of the Drowning, Dragnipurake split the lakeshore with a ritual of unmaking. The abbey sank in under an hour. The monks who did not drown rose again as his servants, and they still keep their old routines: ringing bells nobody hears, singing hymns to an empty altar, sweeping floors under three fathoms of black water.
The lich has not yet bonded with the fragment. The saint's last ward still holds it in a reliquary in the lowest crypt, and every year the ward grows weaker. Sister Maelis, the only monk who escaped, believes the ward fails at the next new moon: eleven days after the party arrives.
```

### Chunk 3 · about 114 tokens

```text
Campaign: Salt · Note: The Sunken Abbey · Section: Rumours
Roll a d4 or pick one when the party asks around Harrowfen.
- 1. The bells still ring at midnight; you can hear them from the jetty. (True)
- 2. Brother Daveth survived and lives as a hermit on Gull Island. (False: he is the lich)
- 3. Anyone who drinks the lake water dreams of a black crown. (True)
- 4. The abbey's treasure vault holds a thousand gold pieces. (Half true: 300 gp and the hymnal)
```

### Chunk 4 · about 373 tokens

```text
Campaign: Salt · Note: The Sunken Abbey · Section: Area 1: The Drowned Nave
Read aloud:
  Green light filters down through the broken rose window. Pews drift in slow circles above the flagstones, and somewhere ahead a bell tolls once, muffled and wrong.
  At the far end, a figure in a dripping habit kneels before the altar, its back to you. It is singing.
[Image: Map of the drowned nave: entrance doors in the south, altar in the north, collapsed bell tower in the east corner]
The nave is fully underwater. Characters without a swim speed or water breathing have disadvantage on attack rolls with weapons other than daggers, javelins, spears and tridents. The kneeling figure is Brother Hollis, a drowned monk (use the @Wight stat block, but it is vulnerable to radiant damage). He finishes his hymn before attacking unless disturbed.
A DC 14 Wisdom (Perception) check spots fresh scratches on the altar: someone has tried to pry it open recently. Beneath it, a stair spirals down to Area 2.
d6 | Encounter in the nave | Notes
1 | 2 drowned monks sweeping | Ignore the party unless touched
2 | A swarm of eels | Use swarm of poisonous snakes, swim 40 ft
3 | The bell rings by itself | Everyone makes a DC 12 Wisdom save or is frightened for 1 minute
4 | A floating hymnal | Contains Brother Daveth's handwriting in the margins
5 | Sister Maelis's lost lantern | Still burning; sheds bright light underwater
6 | Nothing, just silence | Grant inspiration to whoever notices how quiet it is
```

### Chunk 5 · about 492 tokens

```text
Campaign: Salt · Note: The Sunken Abbey · Section: Area 2: The Crypts
The crypts are a maze of low vaults where the abbey buried its abbots. The water here is still and cold enough to hurt; each hour a creature spends in it without protection, it must succeed on a DC 10 Constitution saving throw or gain one level of exhaustion. The walls are lined with niches, and in each niche a skull has been turned to face the lowest crypt, as if listening. The lich arranged them this way so that any intruder's footsteps would be heard by the skulls and passed on to him. If the party moves without care, Dragnipurake knows where they are and sends his servants to herd them toward the flooded ossuary, where a bone naga waits coiled among the remains of forty monks. Careful characters can muffle the skulls by turning them back to face the walls, which takes ten minutes for each vault and a DC 13 Dexterity (Stealth) check, or by covering their eye sockets with cloth, wax or mud. Clever parties might even use the skulls against the lich: whispering false plans to them makes Dragnipurake prepare for the wrong attack, and a DC 15 Charisma (Deception) check makes him believe the party has fled entirely. The deepest vault holds the tomb of Abbot Senn, whose ghost still guards the way down. Senn is not hostile at first; he mistakes the party for pilgrims and asks them to pray with him. If they do, he tells them the ward's true name, Orrin's Mercy, which lets anyone who speaks it pass through the ward unharmed. If they refuse or attack him, he wails, and every skull in the crypts begins to scream, alerting the lich and drawing six drowned monks within three rounds. The way down from Senn's tomb is a narrow shaft, barely wide enough for a Medium creature, that drops thirty feet into the reliquary chamber. Anyone who climbs down without a rope must make a DC 12 Strength (Athletics) check or fall and take 3d6 bludgeoning damage as they hit the stone floor below.
```

### Chunk 6 · about 95 tokens

```text
Campaign: Salt · Note: The Sunken Abbey · Section: Area 2: The Crypts
Handout: Letter found on Brother Daveth's desk
  Abbot — I have read what the saint left in the margins, and I cannot unread it. There is a crown beneath us, or a piece of one, and it is not holy.
  I ask your leave to study it. I ask only to understand. If you refuse me again, I will understand that too. — D.
```

### Chunk 7 · about 146 tokens

```text
Campaign: Salt · Note: The Sunken Abbey · Section: NPCs › Dragnipurake, the Drowned Lich
Appearance: a skeletal figure in an archivist's robe, its skull crusted with barnacles. Pages of soaked parchment orbit it like fish.
Wants: to bond with the crown fragment before the ward fails, then raise the abbey from the lake as his fortress.
Phylactery: the hymnal the party may find in Area 1. Destroying it requires singing Saint Orrin's last hymn backwards over it.
Combat: use the @Lich stat block. He prefers to flee and return through his drowned servants rather than fight to the end.
```

### Chunk 8 · about 82 tokens

```text
Campaign: Salt · Note: The Sunken Abbey · Section: NPCs › Sister Maelis
A gaunt woman of seventy, the last living monk of Saint Orrin. She runs the Harrowfen shrine and pays the party in relics. She is honest but terrified, and lies only about one thing: she helped Daveth translate the marginalia, and has never forgiven herself.
```

### Chunk 9 · about 46 tokens

```text
Campaign: Salt · Note: The Sunken Abbey · Section: Session prep
[x] Print the nave map
[ ] Pick music for the drowned hymn
[ ] Decide what the crown fragment does if a player touches it
```

## 3. A paragraph too long to keep whole

Only for this demo, the hard limit is lowered to 300 so the crypts paragraph must be split. Each piece starts with the last sentence of the one before (the overlap).

### Piece 1

```text
Campaign: Salt · Note: The Sunken Abbey · Section: Area 2: The Crypts
The crypts are a maze of low vaults where the abbey buried its abbots. The water here is still and cold enough to hurt; each hour a creature spends in it without protection, it must succeed on a DC 10 Constitution saving throw or gain one level of exhaustion. The walls are lined with niches, and in each niche a skull has been turned to face the lowest crypt, as if listening. The lich arranged them this way so that any intruder's footsteps would be heard by the skulls and passed on to him. If the party moves without care, Dragnipurake knows where they are and sends his servants to herd them toward the flooded ossuary, where a bone naga waits coiled among the remains of forty monks. Careful characters can muffle the skulls by turning them back to face the walls, which takes ten minutes for each vault and a DC 13 Dexterity (Stealth) check, or by covering their eye sockets with cloth, wax or mud.
```

### Piece 2

```text
Campaign: Salt · Note: The Sunken Abbey · Section: Area 2: The Crypts
Careful characters can muffle the skulls by turning them back to face the walls, which takes ten minutes for each vault and a DC 13 Dexterity (Stealth) check, or by covering their eye sockets with cloth, wax or mud. Clever parties might even use the skulls against the lich: whispering false plans to them makes Dragnipurake prepare for the wrong attack, and a DC 15 Charisma (Deception) check makes him believe the party has fled entirely. The deepest vault holds the tomb of Abbot Senn, whose ghost still guards the way down. Senn is not hostile at first; he mistakes the party for pilgrims and asks them to pray with him. If they do, he tells them the ward's true name, Orrin's Mercy, which lets anyone who speaks it pass through the ward unharmed. If they refuse or attack him, he wails, and every skull in the crypts begins to scream, alerting the lich and drawing six drowned monks within three rounds.
```

