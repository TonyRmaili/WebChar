# top level
"name",
"rarity",
"reqAttune",
"reqAttuneTags",
"wondrous",
"bonusSpellAttack",
"bonusSpellSaveDc",
"range",
"category",  # self made attribute. only for backend
"weight",
"baseItem",
"dmg1",
"dmg2",  # versitile damage only?
"weaponCategory",
"bonusWeapon",
"tier",
"value",
"recharge",
"rechargeAmount",
"charges",
"resist",
"bonusAc",
"mastery",   # needs regex
"sentient",
"bonusWeaponAttack",
"bonusSavingThrow",
"curse",
"bonusWeaponDamage",
"critThreshold",
"bonusProficiencyBonus",
"bonusSavingThrowConcentration",
"bonusAbilityCheck"

# for filtering
"source",
"lootTables",
"age",

# needs more work or dump
"grantsProficiency"
"strength",
"ac",
"stealth",
"spellScrollLevel",
"grantsLanguage",

# abbreviation translation (done)
"type"
"property",
"dmgType",



# too specific data (low prio)
"crew"
"vehAc",
"vehHp",
"vehSpeed",
"capPassenger",
"capCargo",
"carryingCapacity",
"vehDmgThresh",
"speed",
"valueRarity",
"barDimensions",
"ammoType",
"reload",
"crewMin",
"crewMax",
"travelCost",
"shippingCost",

# new keyword storing (done)
tattoo
"poison",
"staff",
"firearm",
"arrow",
"axe",
"needleBlowgun",
"bolt",
"armor",
"club",
"dagger",
"sword",
"weapon",
"cellEnergy",
"bulletFirearm",
"polearm",
"crossbow",
"spear",
"lance",
"hammer",
"bow",
"mace",
"net",
"rapier",
"bulletSling",
"ammo",


# nested data 
"focus",  # no change 
"light", # no change 
"conditionImmune", # no change 
"modifySpeed", # no change 

"vulnerable"  # no change 

"poisonTypes",  # no change 
"immune", # no change

"packContents", # later


"inherits", # doen
"_copy",  # done
"additionalEntries" # done

"attachedSpells", # done
"entries",   # done
"ability", # done


# remove
[
    "requires",
    "excludes",

    "containerCapacity",
    "basicRules2024",
    "srd",
    "srd52",
    "reprintedAs",
    "referenceSources",
    "page",
    "hasFluffImages",
    "classFeatures",
    "basicRules",
    "miscTags",
    "hasRefs",
    "detail1",
    "hasFluff",
    "group",
    "optionalfeatures",
    "reqAttuneAlt",
    "seeAlsoVehicle",
    "scfType",
    "atomicPackContents",
    "otherSources",
    "additionalSources",
    "alias",
    "seeAlsoDeck",
    "weightNote",
    "typeAlt",
    "edition",
    "detail2",
    "dexterityMax",
]