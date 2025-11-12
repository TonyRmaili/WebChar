

# Minoions/+Play
1. Create units such as summons and followers etc
2. make windows or large collapsables?
3. pipe in dice tower
4. connect to rest logic


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
    Comabt
    

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


# Dice Tower
1. An importable box that can open anywere in the page
2. 


# monster improvment
1. Mod an already defined statblock
2. merge multiple templates?
3. Expand monsterblocks to allow direct play from tracker ; perhaps api to 5etools finally? 
    Use AI to clean the json ?


# Exports 
1. Pictures






