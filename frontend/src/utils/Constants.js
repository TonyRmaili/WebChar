export const DICE_TYPES = [
    "d4",
    "d6",
    "d8",
    "d10",
    "d12",
    "d20",
    "d100"
]


export const DIE_ORDER = ["d4", "d6", "d8", "d10", "d12", "d20"];

export const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];


export const DAMAGE_TYPES = [
  "slashing",
  "piercing",
  "bludgeoning",
  "fire",
  "cold",
  "acid",
  "lightning",
  "thunder",
  "poison",
  "necrotic",
  "radiant",
  "psychic",
  "force",
];


export const SPEED_TYPES = ["walk", "fly", "swim", "climb", "burrow"];
export const SENSE_TYPES = ["blindsight", "tremorsense", "truesight", "darkvision"];


export const ATTACK_TYPES = [
  { value: "melee", label: "Melee attack" },
  { value: "ranged", label: "Ranged attack" },
  { value: "spell", label: "Spell attack" },
];

export const EFFECT_TYPES = [
  { value: "attack", label: "Attack" },
  { value: "save", label: "Save" },
  { value: "attack_and_save", label: "Attack + Save" },
  { value: "none", label: "None" },
];




export const DEFAULT_ABILITY_SCORES = {
  str: { score: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Strength" },
  dex: { score: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Dexterity" },
  con: { score: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Constitution" },
  int: { score: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Intelligence" },
  wis: { score: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Wisdom" },
  cha: { score: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Charisma" },
};

export const DEFAULT_SKILLS = {
  acrobatics:     { value: null, proficient: false, expertise: false, label: "Acrobatics",      ability: "Dexterity"    },
  animalHandling: { value: null, proficient: false, expertise: false, label: "Animal Handling", ability: "Wisdom"       },
  arcana:         { value: null, proficient: false, expertise: false, label: "Arcana",          ability: "Intelligence" },
  athletics:      { value: null, proficient: false, expertise: false, label: "Athletics",       ability: "Strength"     },
  deception:      { value: null, proficient: false, expertise: false, label: "Deception",       ability: "Charisma"     },
  history:        { value: null, proficient: false, expertise: false, label: "History",         ability: "Intelligence" },
  insight:        { value: null, proficient: false, expertise: false, label: "Insight",         ability: "Wisdom"       },
  intimidation:   { value: null, proficient: false, expertise: false, label: "Intimidation",    ability: "Charisma"     },
  investigation:  { value: null, proficient: false, expertise: false, label: "Investigation",   ability: "Intelligence" },
  medicine:       { value: null, proficient: false, expertise: false, label: "Medicine",        ability: "Wisdom"       },
  nature:         { value: null, proficient: false, expertise: false, label: "Nature",          ability: "Intelligence" },
  perception:     { value: null, proficient: false, expertise: false, label: "Perception",      ability: "Wisdom"       },
  performance:    { value: null, proficient: false, expertise: false, label: "Performance",     ability: "Charisma"     },
  persuasion:     { value: null, proficient: false, expertise: false, label: "Persuasion",      ability: "Charisma"     },
  religion:       { value: null, proficient: false, expertise: false, label: "Religion",        ability: "Intelligence" },
  sleightOfHand:  { value: null, proficient: false, expertise: false, label: "Sleight of Hand", ability: "Dexterity"    },
  stealth:        { value: null, proficient: false, expertise: false, label: "Stealth",         ability: "Dexterity"    },
  survival:       { value: null, proficient: false, expertise: false, label: "Survival",        ability: "Wisdom"       },
};

export const ABILITIES_ORDER = [
  { key: "str", label: "Strength" },
  { key: "dex", label: "Dexterity" },
  { key: "con", label: "Constitution" },
  { key: "int", label: "Intelligence" },
  { key: "wis", label: "Wisdom" },
  { key: "cha", label: "Charisma" },
];

export const SKILLS_ORDER = [
  { key: "wis", label: "Wisdom" },
  { key: "dex", label: "Dexterity" },
  { key: "int", label: "Intelligence" },
  { key: "cha", label: "Charisma" },
  { key: "str", label: "Strength" },
  { key: "con", label: "Constitution" },
];

export const DEFAULT_HEALTH = {
  current_hp: 0,
  max_hp: 0,
  temp_hp: 0,
  barrier: 0,
  max_hp_mod: 0,        
};



// Minions Data

export const DEFAULT_MINION_DATA = {
  name: "",
  amount: 0,
  ac: 0,
  max_hp: 0,
  cr: 0,  // <<< dependant on pb
  exp: 0, // <<< dependant on pb
  pb: 2,
  size: "",
  alignment: "",
  monster_types: [],   
  speed: [],
  habitats: [],
  immunities: [],
  resistances: [],
  senses: [],
  languages: [],
  equipment: [],
  ability_scores: {},
  skills: [],

  traits: [],
  actions: [],
  bonus_actions: [],
  reactions: [],
  legendary_actions: [],
  mythic_actions: [],
  lair_actions: [],
  regional_effects: [],

  initiative: 0,
  legendary_resistance:0,  
  units: [],
};

export const SIZE_OPTIONS = [
  "Miniscule",
  "Tiny",
  "Small",
  "Medium",
  "Large",
  "Huge",
  "Gargantuan",
  "Titan"
]

export const ALIGNMENT_OPTIONS = [
  "Lawful Good",
  "Lawful Neutral",
  "Lawful Evil",
  "Neutral Good",
  "True Neutral", 
  "Neutral Evil",
  "Chaotic Good",
  "Chaotic Neutral",
  "Chaotic Evil",
  "Unaligned"
]


export const HABITAT_OPTIONS = [
  "Any",
  "None",
  "Artic",
  "Coastal",
  "Desert",
  "Forest",
  "Grassland",
  "Hill",
  "Mountain",
  "Planar",
  "Swamp",
  "Underdark",
  "Underwater",
  "Urban"
]

export const TYPE_OPTIONS = [
  "Aberration",
  "Beast",
  "Celestial",
  "Construct",
  "Dragon",
  "Elemental",
  "Fey",
  "Fiend",
  "Giant",
  "Humanoid",
  "Monstrosity",
  "Ooze",
  "Plant",
  "Undead"
]

export const CONDITION_OPTIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Disease",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious"
]

export const SPEED_OPTIONS = [
  "walk",
  "fly",
  "swim",
  "climb",
  "burrow"
];

export const SENSE_OPTIONS = [
  "blindsight",
  "tremorsense",
  "truesight",
  "darkvision"
];

export const LANGUAGE_OPTIONS = [
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
  "Thieves' Cant",
  "Druidic",
  "Aarakocra",
  "Gith",
  "Gnoll",
  "Kuo-Toan",
  "Sahuagin",
  "Minotaur",
  "Modron",
  "Slaad",
  "Yuan-Ti",
  "Telepathy ",
  "Speechless",
  "None"
];

export const SKILL_OPTIONS = {
  acrobatics:     { value: null,  label: "Acrobatics",      ability: "dex" },
  animalHandling: { value: null,  label: "Animal Handling", ability: "wis" },
  arcana:         { value: null,  label: "Arcana",          ability: "int" },
  athletics:      { value: null,  label: "Athletics",       ability: "str" },
  deception:      { value: null,  label: "Deception",       ability: "cha" },
  history:        { value: null,  label: "History",         ability: "int" },
  insight:        { value: null,  label: "Insight",         ability: "wis" },
  intimidation:   { value: null,  label: "Intimidation",    ability: "cha" },
  investigation:  { value: null,  label: "Investigation",   ability: "int" },
  medicine:       { value: null,  label: "Medicine",        ability: "wis" },
  nature:         { value: null,  label: "Nature",          ability: "int" },
  perception:     { value: null,  label: "Perception",      ability: "wis" },
  performance:    { value: null,  label: "Performance",     ability: "cha" },
  persuasion:     { value: null,  label: "Persuasion",      ability: "cha" },
  religion:       { value: null,  label: "Religion",        ability: "int" },
  sleightOfHand:  { value: null,  label: "Sleight of Hand", ability: "dex" },
  stealth:        { value: null,  label: "Stealth",         ability: "dex" },
  survival:       { value: null,  label: "Survival",        ability: "wis" },
};


export const CATEGORY_KEYS = [
  "traits",
  "actions",
  "bonus_actions",
  "reactions",
  "legendary_actions",
  "mythic_actions",
  "lair_actions",
  "regional_effects",
];

export const CATEGORY_LABELS = {
  traits: "Traits",
  actions: "Actions",
  bonus_actions: "Bonus Actions",
  reactions: "Reactions",
  legendary_actions: "Legendary Actions",
  mythic_actions: "Mythic Actions",
  lair_actions: "Lair Actions",
  regional_effects: "Regional Effects",
};

export const ROLL_TYPES = [
  "normal",
  "advantage",
  "disadvantage"
]
