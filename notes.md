
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

1. Crossplatform features ; Embedder, DiceTower; Omega Search, Card Deck, 
2. 
3. Settings. Here we configure account (with openai settings too and user private api key for later)
4. Header can be semi-visible and "follow" scrolling. 



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


*Feats 
More than one epic boon can get randomized





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






Card Deck: as the project has grown so has the popup cards too. Perhaps its time to have them organized and once a card is minized it lands into the corresponding deck instead of having them sit at the bottom like they are now
Dice Tower: here the user can setup a bunch of premade dice to make large amounts of rolls directly. This helps out DM that controls lots of groups or players that have many minions. There needs to be clever tools that one can use to make these dice loadouts and how it can connect to differant parts of the page
Remove the dependancy of local storage of things: like mentioned before perhaps now forgotten by you? when i first made this project i used to store the character sheet and other states in local storage for some reason. Now there can be 2 sources of truth in the project and we need to remove and adjust the logic so we read from backend only. 
Removal of redundant files and better folder structure: i have removed many but some lingers on. 
Settings: not much expect for allowing the user to set api keys, removal of profiles and select styling for the page. Currently this page sits on 2 very differant styles: the standard one (dark blue with orange text; robotic line boxes all that) and parchemnt. Parchement is slowly taking over but i want both to exist and later maybe a third style. So a dedicated 
Security: page needs to be made much more secure if i plan to make it into a webpage. Which leads to what i want to discus now

Initially this project was thought to be hosted online as a website. Either i use my pc as the server backend if its among friends and later to a dedicated webhotell. If this is the route i am doing the security needs to be modern and up to standards
However recently i've been thinking to make it into a desktop app were users can just download it and go. I believe this react project is suitable to be converted like that (because its react html and so). 
There are some features and more will come were i use AI chat to help the DM. These api keys are mine but a user needs to config their own otherwise the AI features will be locked. Is it easily done for this project to connect online once its made into an app? 
There is also a donation section i want to have because i plan to launch it for free: maybe i should take a charge or subscription instead. either way paypal or other pay methods needs to get involved.