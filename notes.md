

# Minions
1. neat dividers for all the subcomponents
2. empty backward compatible traits, actions etc needs to get removed
3. define hit-dice?
4. connect CR to PB and exp yield
5. pipe-in equipments from real items database
6. fix the stupid "one-character at a time bug" in senses and speed fts input  
7. Allow name change that triggers a new minion (separete save json which essentially makes a copy for modding a monster template)
8. delete backend minion for deletion
9. handle spells in effects?
    how will this be once AI cleans data?
    and for old spellcasting features from 2014?

# DiceTower (minions)
1. handle charged effects
2. better logic for selecting units (UI and update for sending minon effects)
3. complete the minionCard (display purpose only)
4. Optimize the popup size with draggable sides and bottom, also make it resizable window


# MinionsPlay
1. connect to resting logic

# Overall
1. Collapse right area? 
2. Giga lag (large Interaction to Next Paint (INP) > 16k ms) due to const { charData, updateCharField } = useCharStore();
    fix by using selectors such as const melee = useCharStore((s) => s.charData.offense.melee);
                                   const updateCharField = useCharStore((s) => s.updateCharField);
    Fixed:
    HealthPlay
    OffensCard
    GeneralStats
    Effects
    EffectsPlay
    AbilityScore
    SpellPlay
    Combat
3. Major function breakout. Far too many repeatable functions everywere
    math.js, functions, elements such as buttons and styling
4. Organize folders and files - rename some files
5. All api calls define in corresponding store
    

# GeneralStats
1. Optimize space and style for OffenseCard because of remove of init


# AbilityScores
1. Minor tweaks for abilityScoreCard


# Effects (absorbed Traits)
1. for damage allow multi-damage type selector

# backend
1. break out resting logic, messy atm but works


# SpellBook / Play
1. Save innate spells and charges like the rest
2. Make switching from innate to not innate reset the data for charges
3. SpellPlay needs better stacking of components

# HealthPlay
1. Minor tweaks to GUI
2. current hp can exceed max_hp when max_hp_mod is reduced 


# Biography 
1. Add alignments
2. fix the page
3. change filename

# EffectsPlay
1. categories by damage type and combine all same terms (const, dX )

 



-----  init tracker
1. store init tracker values in storage so that i navigating in the site dont reset the tracker
2. Redesing init tracker. This will be an encounter manager with listings of all monster from 5edata that is cleaned
    proper monster card that also shows in the init tracker for when a monster has its turn
    template adding system that adds template to all selected monsters in a selected encounter
        ex. grants all monsters darkvision, +hp .. etc
3. track conditions



# DM tools
1. Creating tables for loot, events etc



# monster improvment
1. Mod an already defined statblock
2. merge multiple templates?
3. Expand monsterblocks to allow direct play from tracker ; perhaps api to 5etools finally? 
    Use AI to clean the json ?





# Monster Cleaning
(example from "Erinyes")

1. missed languages ; telepathy 120 ft added in senses instead -> clarify that telepathy is a language
2. Let AI ignore Passive perception otherwise its added in Senses
3. halucinated gear? added Magic Rope from traits to gear
4. effect_types = > remove none and keep passive only (aswell in frontend)

5. concerning? 
 "notes": "The erinyes has a magic rope. While bearing it, the erinyes can use the Entangling Rope action. The rope has AC 20, HP 90, and immunity to poison and psychic damage. The rope turns to dust if reduced to 0 Hit Points, if it is 5+ feet away from the erinyes for 1 hour or more, or if the erinyes dies. If the rope is damaged or destroyed, the erinyes can fully restore it when finishing a short or long rest.",

= > "charges": {
     "has": false,
     "max_charges": 0,
     "current_charges": 0,
     "reset_amount": 0
 }


# QuickClass Bug Fixes and Improvments

1. prompted ability score gets increased via feats adding (lock pre-defined scores?)
