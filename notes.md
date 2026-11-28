# extra data material used
1. actions ; srd
2. bastions
3. conditionsdiseases; srd
4. charcreationoptions
5. cultsboons
6. deities ; srd
7. languages; srd
8. encounters (table)
9. loot (table)
10. names; perhaps replaces fantasynames generator in python? also table
11. objects
12. rewards
13. senses ;srd
14. skills; srd
15. tables; srd
16. trapshazards; srd
17. variantrules; srd
18. vehicles


<CLEANING PROCCESS>
Remember to scan for all failed attempts
--SRD all done--

-- Rest --





When all those are done we can finaly start looking at wrapping this project into a desktop app with electron or whatever is recommended. For that we need a new branch and remove non relevant things such as auth token, login (stuff that makes sense for a web application). Would also need to some name ideas for the app; WebChar wont hold. 


# Campaign

<File system>



# Catalogue Create Forms


# Fixes for the builder
1. More than one epic boon can get randomized=?
# Fixes for the define



-Spells
1. Some bug blocked loading spells from catalogue? after the define changes. Noticed after creating a spell from the define section. 


# New features
random encounter builder and difficulty calculator

# Stores endpoints and API
let claude revisit the new routers character and catalogue
and mention the update_character bug


    
# Ways to upload and clean data

What way will a normal user aquire data? 
Catalogue will always provide the creation of a data type
Differant sources than 5etools


Single datapoint upload
Entire 5etools data upload


# backend
review all old files from the very start of the project such as security.py and db_setup 
before deploying site


# SpellBook / Play
implement mystic arcanum here?

# HealthPlay


# Biography 
1. changing subrace needs a confirmation "done" before accepting. Right now this is harmless but later changes in the define will remove and add in the new stuff. Lost the feature to swap races/bg


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

1. implement a randomizer

    # Races 
    1. increase size tag to all sizes

    # Items
    setting gold silver cp to create item instead of user needing to do math
    fix "light" to read list[dict] or dict (atleast list[0])

    # Feats
    allow more filter options like resistance 


# popup bug storage reseter in console
Object.keys(localStorage).filter(k => k.startsWith("popup-storage")).forEach(k => localStorage.removeItem(k));
location.reload();



