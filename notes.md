

# Stores endpoints and API


let claude revisit the new routers character and catalogue
and mention the update_character bug

# Overall 
1. if lag persists use:
    fix by using selectors such as const melee = useCharStore((s) => s.charData.offense.melee);
                                   const updateCharField = useCharStore((s) => s.updateCharField);
    
2. Major function breakout. Far too many repeatable functions everywere
    math.js, functions


    
# Ways to upload and clean data

What way will a normal user aquire data? 
Catalogue will always provide the creation of a data type
Differant sources than 5etools


Single datapoint upload
Entire 5etools data upload


# backend
1. break out resting logic, messy atm but works
2. experiance to all grants experiance to ALL characters, not just he selected ones


Cleaners needs a correct run method for single object and large file pipeline.
Cleaners actually need an overhaul and preparations for SRD law ."perfect" data is the goal this time. 

review all old files from the very start of the project such as security.py and db_setup 
before deploying site


# SpellBook / Play
Let pact slots be added with differant levels like spell slots
implement mystic arcanum here?

# HealthPlay
1. CurrentHp make smaller to at least fit quad digits, some slight overlap on to maxhp (case currentHp = 999 for example)


# Biography 
1. changing subrace needs a confirmation "done" before accepting. Right now this is harmless but later changes in the define will remove and add in the new stuff


# EffectsPlay
some settings of mods may have been lost?
were we ever able to set damage dice as separate? attack.damages and save.damages

# InventoryDefine 


# NEW Resources
Make this. Possible to read from builder once .resources is cleaned
Here lives all that is not spells such as ki, maneuvers, psy dice etc

either remove resources [] from char_adjuster or use it instead of effects for 
things that has charges. it is double dipping right now. did it capture rage? no
Or expand spellbook into resources and call it 
or split slots, sorc points from spell book into resource

or split phys vs spells 

either which way some optianl features needs home


# Campaigns 
1. Settings button for config of AI stuff
2. RAG!!
3. implement an image generator
4. handle image files
5. make camp_files into CardDeck objects

6. DM assistant check for faster generation and streaming response
7. Give assisstant a small chat box in footer, easy to reach and not as advanced? should at least come with the file payload and memory


# Catalogues

1. CRUD operations - Spells only left
2. Exclude filter option? 2 clicks and color change
3. strip all None values from every catalogue object, even for created ones
4. implement a randomizer

    # Races 
    1. increase size tag to all sizes

    # Items
    setting gold silver cp to create item instead of user needing to do math
    fix "light" to read list[dict] or dict (atleast list[0])
    
    # Monsters
    fly fix displaying: [object Object] ft., swim 60 ft., canHover true ft.  

    # Spells
    LLM clean all before implementing CRUD

    # Feats
    data set needs flattening of some prof.keys instead of dict to fit create form

    allow more filter options like resistance 


    # Background 

    # Optional Features



    # Classes
    1. collapsable features
    2. ignore null feauters like subclass and ASI
    3. center the subclass buttons
    4. multiselect subclasses like 5etools
    5. hide all core features and only show subclass feature
    6. Needs its own create class feature before launch to work with SRD laws





# Frontend
MANY repeating constants such as source book names, skills and such needs 
one common place, look catalogue.helpers



# Character Builder (Wizard)

*Feats 
More than one epic boon can get randomized




this goes with SRD law overhaul and perfect data
-----------------------------
keep or throw from final_build
"unresolved"
"spell_list_rules"
"feats"
pending_ability_choices
ability_max_override
feat_ability_bonuses
base_scores
saving_throw_proficiencies
skill_expertise
skill_proficiencies
ability_bonuses
caster_level

Needs logic or improved handling
"caster_level"


These replaced by _mod?
"check": null,
"save": null,

characters land with 0 charges

# popup bug storage reseter in console
Object.keys(localStorage).filter(k => k.startsWith("popup-storage")).forEach(k => localStorage.removeItem(k));
location.reload();

