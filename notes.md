
# Minions
1. Allow name change that triggers a new minion (separete save json which essentially makes a copy for modding a monster template)
2. delete backend minion for deletion


# DiceTower (minions)
1. handle charged effects
2. better logic for selecting units (UI and update for sending minon effects)
3. complete the minionCard (display purpose only)
4. Optimize the popup size with draggable sides and bottom, also make it resizable window


# MinionsPlay
1. connect to resting logic?

# Overall 
1. if lag persists use:
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
2. Major function breakout. Far too many repeatable functions everywere
    math.js, functions, elements such as buttons and styling
3. Organize folders and files - rename some files
4. All api calls define in corresponding store
    


# Effects (absorbed Traits)
1. for damage allow multi-damage type selector

# backend
1. break out resting logic, messy atm but works


# SpellBook / Play
let pact slots be up to 9 or more / currently max at 5
implement mystic arcanum here?

# HealthPlay

1. current hp can exceed max_hp when max_hp_mod is reduced ?
2. add in round tracker


# Biography 
1. change filename char name

# EffectsPlay

# InventoryDefine 
1. bad formating from items upon creation. this is data problem not inventory problem

# NEW Resources
Make this. Possible to read from builder once .resources is cleaned
Here lives all that is not spells such as ki, maneuvers, psy dice etc

 

-----  init tracker

1. track conditions




# Campaigns 
1. Settings button for config of AI stuff
2. RAG!!
3. implement an image generator
4. handle image files
5. make minimizing of windows not have a fixed location OR fixed initially but movable and
    not stacking over each other from differant sources

6. same grp statblock stack like cards (hanibal explains)
7. DM assistant check for faster generation and steam response


# Catalogues

1. Add in "Card Deck" or remove if it cannot be differant enough from sticky footer
2. CRUD operations - Spells only left
3. Exclude filter option? 2 clicks and color change
4. strip all None values from every catalogue object, even for created ones
5. implement a randomizer

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
    4. restyle Traits Panel, its too weird and the text labels are too small (bold?)
    5. multiselect subclasses like 5etools
    6. hide all core features and only show subclass button



# Header and overall navigation
1. "Characters" and "Combat" absorbed into "Player"
    1. in "Player" we create characters in 3 differant ways
       1. Custom; follows the regular char creation
       2. Wizard; a click and choose type of guided creation data drawn from catalogues
       3. QuickClass import- the randomizer with more starting options (maybe without AI too)

2. DM-Tools gets removed and all its features will be accessed across the platform, mostly in Campaings

3. Crossplatform features ; Embedder, DiceTower; Omega Search, Card Deck, 
   
4. User Profile change into Settings. Here we configure account (with openai settings too and user private api key for later)


5. Header can be semi-visible and "follow" scrolling. 



# Backend
app.main starting to get too large, migrate endpoints to dedicated routes in files
CRUD endpoints for catalogue can have general functions for create,update and delete


all cleaners can be inside a folder under app along with outputs, raw_data,instructions and schema. Cleaners needs a correct run method for single object and large file pipeline.
It is chaos right now

AIdata folder soon redundant

review all old files from the very start of the project such as security.py and db_setup 
before deploying site

embedder and vector_dbs rehaul for later and migrate under app



# Frontend
MANY repeating constants such as source book names, skills and such needs 
one common place

Deadfiles needs cleanup



# popup bug storage reseter in console
Object.keys(localStorage).filter(k => k.startsWith("popup-storage")).forEach(k => localStorage.removeItem(k));
location.reload();





# Character Builder (Wizard)

# include
Needs a reset all button

# backend
handle sorcpoints, invocations and more options?


# Sheets 

prepared spells per caster? only "one" edition
Name and json savefile change to fit the data object naming.



<final build comparison to live save profile>




spells need an overhaul anyway, for now they are placed correctly inside spellbook



----------------


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