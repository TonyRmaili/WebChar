/* ═══════════════════════════════════════════════════════════════════
   catalogueHelpers — the pure functions every catalogue page shares.

   Every category now uses the same data shapes (see the project doc
   data-model.md), so the words for them live here once instead of in
   each page's own helper file:

     sources & editions   formatSource, EDITION_LABELS, isHomebrew, isOwner
     words                cap, titleCase, labelFromId, plural
     ids & names          nameFromId, buildNameIndex
     rule words           ABILITIES, SKILLS, TOOLS, LANGUAGES, GROUP_LABELS
     lists                collectUnique, toggleIn, matchesQuery, byName
     text                 parseText (markdown-lite → blocks), featureText
     values               formatValue (number · formula · level table)
     grants & choices     describeGrants, describeChoice, formatCurrency,
                          formatItemGrant
     features             describeFeature
     prerequisites        describePrerequisites, prerequisiteKinds
     filters              offeredAbilities, offeredSkills, offeredFeats, offeredKinds
     forms                pruneEmpty, numOrNull

   A page's own helper file (backgroundHelpers.js, …) keeps only what
   belongs to that category.
   ═══════════════════════════════════════════════════════════════════ */

// ─── Sources & editions ────────────────────────────────────────────

export const HOMEBREW = "HOMEBREW";

export const SOURCE_NAMES = {
  AAG: "Astral Adventurer's Guide",
  AATM: "Adventure Atlas: The Mortuary",
  ABH: "Astarion's Book of Hungers",
  AI: "Acquisitions Incorporated",
  "AitFR-AVT": "Adventures in the Forgotten Realms: A Verdant Tomb",
  "AitFR-DN": "Adventures in the Forgotten Realms: Deepest Night",
  "AitFR-FCD": "Adventures in the Forgotten Realms: From Cyan Depths",
  "AitFR-ISF": "Adventures in the Forgotten Realms: In Scarlet Flames",
  "AitFR-THP": "Adventures in the Forgotten Realms: The Hidden Page",
  AU: "Arcana Unleashed",
  AUD: "Arcana Unleashed: Deadfall",
  AWM: "Adventure with Muk",
  AZfyT: "A Zib for Your Thoughts",
  BAM: "Boo's Astral Menagerie",
  BGDIA: "Baldur's Gate: Descent Into Avernus",
  BGG: "Bigby Presents: Glory of the Giants",
  BMT: "The Book of Many Things",
  CM: "Candlekeep Mysteries",
  CoA: "Chains of Asmodeus",
  CoS: "Curse of Strahd",
  CRCotN: "Critical Role: Call of the Netherdeep",
  DC: "Essentials Kit: Divine Contention",
  DIP: "Essentials Kit: Dragon of Icespire Peak",
  DitLCoT: "Descent into the Lost Caverns of Tsojcanth",
  DMG: "Dungeon Master's Guide Classic",
  DoD: "Domains of Delight",
  DoSI: "Dragons of Stormwreck Isle",
  "DrDe-BD": "Dragon Delves: Baker's Doesn't",
  DSotDQ: "Dragonlance: Shadow of the Dragon Queen",
  EEPC: "Elemental Evil Player's Companion",
  EET: "Elemental Evil: Trinkets",
  EFA: "Eberron: Forge of the Artificer",
  EGW: "Explorer's Guide to Wildemount",
  ERLW: "Eberron: Rising from the Last War",
  ESK: "Essentials Kit",
  FRAiF: "Forgotten Realms: Adventures in Faer\u00fbn",
  FRHoF: "Forgotten Realms: Heroes of Faer\u00fbn",
  FTD: "Fizban's Treasury of Dragons",
  GGR: "Guildmasters' Guide to Ravnica",
  GoS: "Ghosts of Saltmarsh",
  GotSF: "Giants of the Star Forge",
  "HAT-LMI": "Honor Among Thieves: Legendary Magic Items",
  "HAT-TG": "Thieves' Gallery",
  HftT: "Hunt for the Thessalhydra",
  HoL: "Ravenloft: The House of Lament",
  HOMEBREW: "Homebrew",
  HotB: "Heroes of the Borderlands",
  HotDQ: "Hoard of the Dragon Queen",
  ICC: "World of Warcraft: Icecrown Citadel",
  IDRotF: "Icewind Dale: Rime of the Frostmaiden",
  IMR: "Infernal Machine Rebuild",
  JttRC: "Journeys through the Radiant Citadel",
  KftGV: "Keys from the Golden Vault",
  KKW: "Krenko's Way",
  LFL: "Lorwyn: First Light",
  LLK: "Lost Laboratory of Kwalish",
  LMoP: "Lost Mine of Phandelver",
  LoX: "Light of Xaryxis",
  LR: "Locathah Rising",
  LRDT: "Red Dragon's Tale: A LEGO Adventure",
  MaBJoV: "Minsc and Boo's Journal of Villainy",
  MCV1SC: "Monstrous Compendium Volume 1: Spelljammer Creatures",
  MCV2DC: "Monstrous Compendium Vol. 2: Dragonlance Creatures",
  MCV3MC: "Monstrous Compendium Vol. 3: Minecraft Creatures",
  MCV4EC: "Monstrous Compendium Volume 4: Eldraine Creatures",
  MFF: "Mordenkainen's Fiendish Folio",
  MGELFT: "Muk's Guide to Everything He Learned From Tasha",
  MisMV1: "Misplaced Monsters: Volume One",
  MM: "Monster Manual Classic",
  MOT: "Mythic Odysseys of Theros",
  MPMM: "Mordenkainen Presents: Monsters of the Multiverse",
  MPP: "Morte's Planar Parade",
  MTF: "Mordenkainen's Tome of Foes",
  NF: "Netheril's Fall",
  "NRH-ASS": "NERDS Restoring Harmony: A Sticky Situation",
  "NRH-AT": "NERDS Restoring Harmony: Adventure Together",
  "NRH-AVitW": "NERDS Restoring Harmony: A Voice in the Wilderness",
  "NRH-AWoL": "NERDS Restoring Harmony: A Web of Lies",
  "NRH-CoI": "NERDS Restoring Harmony: Circus of Illusion",
  "NRH-TCMC": "NERDS Restoring Harmony: The Candy Mountain Caper",
  "NRH-TLT": "NERDS Restoring Harmony: The Lost Tomb",
  OGA: "One Grung Above",
  OotA: "Out of the Abyss",
  OoW: "The Orrery of the Wanderer",
  PaBTSO: "Phandelver and Below: The Shattered Obelisk",
  PHB: "Player Handbook Classic",
  PL: "Project_Lamordia",
  PotA: "Princes of the Apocalypse",
  PSA: "Plane Shift: Amonkhet",
  PSD: "Plane Shift: Dominaria",
  PSI: "Plane Shift: Innistrad",
  PSK: "Plane Shift: Kaladesh",
  PSX: "Plane Shift: Ixalan",
  PSZ: "Plane Shift: Zendikar",
  QftIS: "Quests from the Infinite Staircase",
  RHW: "Ravenloft: The Horrors Within",
  RMBRE: "The Lost Dungeon of Rickedness: Big Rick Energy",
  RoT: "Rise of Tiamat",
  RoTOS: "The Rise of Tiamat Online Supplement",
  RtG: "Return to the Glory",
  RWG: "Red Wizards' Gambit",
  SADS: "Sapphire Anniversary Dice Set",
  SatO: "Sigil and the Outlands",
  SCAG: "Sword Coast Adventurer's Guide",
  SCC: "Strixhaven: A Curriculum of Chaos",
  SDW: "Essentials Kit: Sleeping Dragon's Wake",
  SKT: "Storm King's Thunder",
  SLW: "Essentials Kit: Storm Lord's Wrath",
  TCE: "Tasha's Cauldron of Everything",
  TftYP: "Tales from the Yawning Portal",
  ToA: "Tomb of Annihilation",
  ToFW: "Turn of Fortune's Wheel",
  TTP: "The Tortle Package",
  UATheMysticClass: "Unearthed Arcana: The Mystic Class",
  UtHftLH: "Uni and the Hunt for the Lost Horn",
  VD: "Vecna Dossier",
  VEoR: "Vecna: Eve of Ruin",
  VGM: "Volo's Guide to Monsters",
  VRGR: "Van Richten's Guide to Ravenloft",
  WBtW: "The Wild Beyond the Witchlight",
  WDH: "Waterdeep: Dragon Heist",
  WDMM: "Waterdeep: Dungeon of the Mad Mage",
  WoW: "World of Warcraft",
  WttHC: "Stranger Things: Welcome to the Hellfire Club",
  XDMG: "Dungeon Master's Guide One",
  XGE: "Xanathar's Guide to Everything",
  XMM: "Monster Manual One",
  XMtS: "X Marks the Spot",
  XPHB: "Player Handbook One",
};

export const formatSource = (source) => SOURCE_NAMES[source] || source || "";

export const EDITIONS = ["one", "classic"];
export const EDITION_LABELS = { one: "One (2024)", classic: "Classic (2014)" };
export const formatEdition = (e) => EDITION_LABELS[e] || e || "";

export const isHomebrew = (entry) => entry?.source === HOMEBREW;

// Only the user who made a homebrew entry may edit or delete it.
export const isOwner = (entry, user) => isHomebrew(entry) && !!user && entry.created_by === user;

// ─── Words ─────────────────────────────────────────────────────────

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with"]);

export const cap = (s) => (typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : s);

// "sleight of hand" → "Sleight of Hand"
export const titleCase = (s) =>
  String(s ?? "")
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : cap(w)))
    .join(" ");

// "3 uses" / "1 use"
export const plural = (n, word, many = `${word}s`) => `${n} ${Number(n) === 1 ? word : many}`;

// Ids whose words need an apostrophe or brackets to read right.
const ID_LABELS = {
  thieves_tools: "Thieves' Tools",
  thieves_cant: "Thieves' Cant",
  alchemists_supplies: "Alchemist's Supplies",
  brewers_supplies: "Brewer's Supplies",
  calligraphers_supplies: "Calligrapher's Supplies",
  carpenters_tools: "Carpenter's Tools",
  cartographers_tools: "Cartographer's Tools",
  cobblers_tools: "Cobbler's Tools",
  cooks_utensils: "Cook's Utensils",
  glassblowers_tools: "Glassblower's Tools",
  jewelers_tools: "Jeweler's Tools",
  leatherworkers_tools: "Leatherworker's Tools",
  masons_tools: "Mason's Tools",
  navigators_tools: "Navigator's Tools",
  painters_supplies: "Painter's Supplies",
  poisoners_kit: "Poisoner's Kit",
  potters_tools: "Potter's Tools",
  smiths_tools: "Smith's Tools",
  tinkers_tools: "Tinker's Tools",
  weavers_tools: "Weaver's Tools",
  woodcarvers_tools: "Woodcarver's Tools",
  artisans_tools: "Artisan's Tools",
  vehicles_land: "Vehicles (Land)",
  vehicles_water: "Vehicles (Water)",
  vehicles_air: "Vehicles (Air)",
  vehicles_space: "Vehicles (Space)",
  three_dragon_ante_set: "Three-Dragon Ante Set",
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

// Any snake_case grant id → words: "animal_handling" → "Animal Handling".
export const labelFromId = (id) => {
  if (id == null) return "";
  const key = String(id);
  return ID_LABELS[key] || GROUP_LABELS[key]?.name || titleCase(key.replace(/_/g, " "));
};

// ─── Ids & names ───────────────────────────────────────────────────
// Every entry has an id "<name>-<source>", lowercase, with dashes
// ("holy-symbol-xphb"); grants and choices point at entries by id.

const SOURCE_SUFFIXES = Object.keys(SOURCE_NAMES)
  .map((s) => `-${s.toLowerCase()}`)
  .sort((a, b) => b.length - a.length);

// "magic-initiate-xphb" → "Magic Initiate". With an index (id → name)
// from buildNameIndex, the catalogue's own name is used when it's loaded.
export const nameFromId = (id, index) => {
  if (!id) return "";
  if (index?.[id]) return index[id];
  let base = String(id);
  const suffix = SOURCE_SUFFIXES.find((s) => base.endsWith(s));
  if (suffix) base = base.slice(0, -suffix.length);
  return titleCase(base.replace(/-/g, " "));
};

// { id: name } over any number of catalogue lists.
export const buildNameIndex = (...lists) => {
  const out = {};
  for (const list of lists) {
    for (const e of Array.isArray(list) ? list : []) {
      if (e?.id && e.name) out[e.id] = e.name;
    }
  }
  return out;
};

// ─── Rule words (the ids the data uses) ────────────────────────────

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
export const ABILITY_SHORT = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
export const ABILITY_NAMES = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

export const SKILLS = {
  acrobatics: "dex", animal_handling: "wis", arcana: "int", athletics: "str",
  deception: "cha", history: "int", insight: "wis", intimidation: "cha",
  investigation: "int", medicine: "wis", nature: "int", perception: "wis",
  performance: "cha", persuasion: "cha", religion: "int", sleight_of_hand: "dex",
  stealth: "dex", survival: "wis",
};
export const SKILL_IDS = Object.keys(SKILLS);

export const ARTISANS_TOOLS = [
  "alchemists_supplies", "brewers_supplies", "calligraphers_supplies", "carpenters_tools",
  "cartographers_tools", "cobblers_tools", "cooks_utensils", "glassblowers_tools",
  "jewelers_tools", "leatherworkers_tools", "masons_tools", "painters_supplies",
  "potters_tools", "smiths_tools", "tinkers_tools", "weavers_tools", "woodcarvers_tools",
];
export const GAMING_SETS = ["dice_set", "dragonchess_set", "playing_card_set", "three_dragon_ante_set"];
export const MUSICAL_INSTRUMENTS = [
  "bagpipes", "drum", "dulcimer", "flute", "horn", "lute", "lyre", "pan_flute", "shawm", "viol",
];
export const OTHER_TOOLS = [
  "disguise_kit", "forgery_kit", "herbalism_kit", "navigators_tools", "poisoners_kit", "thieves_tools",
  "vehicles_land", "vehicles_water", "vehicles_air", "vehicles_space",
];
export const TOOLS = [...ARTISANS_TOOLS, ...OTHER_TOOLS, ...GAMING_SETS, ...MUSICAL_INSTRUMENTS];

export const STANDARD_LANGUAGES = [
  "common", "common_sign_language", "draconic", "dwarvish", "elvish", "giant", "gnomish",
  "goblin", "halfling", "orc",
];
export const RARE_LANGUAGES = [
  "abyssal", "celestial", "deep_speech", "druidic", "infernal", "primordial", "aquan",
  "auran", "ignan", "terran", "sylvan", "thieves_cant", "undercommon",
];
export const LANGUAGES = [...STANDARD_LANGUAGES, ...RARE_LANGUAGES];

// Named groups a pool can pick from (one table, as in the pipeline's
// common_schema.GROUPS). `name` is the group on its own; `one` / `many`
// read after a number: "choose 1 standard language", "choose 2 standard languages".
export const GROUP_LABELS = {
  all_skills: { name: "Any Skill", one: "skill", many: "skills" },
  proficient_skills: { name: "A Skill You're Proficient In", one: "skill you're proficient in", many: "skills you're proficient in" },
  proficient_skills_tools: { name: "A Skill or Tool You're Proficient With", one: "skill or tool you're proficient with", many: "skills or tools you're proficient with" },
  all_tools: { name: "Any Tool", one: "tool", many: "tools" },
  artisans_tools: { name: "Artisan's Tools", one: "type of artisan's tools", many: "types of artisan's tools" },
  gaming_sets: { name: "Gaming Sets", one: "gaming set", many: "gaming sets" },
  musical_instruments: { name: "Musical Instruments", one: "musical instrument", many: "musical instruments" },
  vehicles: { name: "Vehicles", one: "vehicle type", many: "vehicle types" },
  all_languages: { name: "Any Language", one: "language", many: "languages" },
  standard_languages: { name: "Standard Languages", one: "standard language", many: "standard languages" },
  rare_languages: { name: "Rare Languages", one: "rare language", many: "rare languages" },
  simple_weapons: { name: "Simple Weapons", one: "simple weapon", many: "simple weapons" },
  martial_weapons: { name: "Martial Weapons", one: "martial weapon", many: "martial weapons" },
  all_weapons: { name: "Any Weapon", one: "weapon", many: "weapons" },
  all_feats: { name: "Any Feat", one: "feat", many: "feats" },
  arcane_focuses: { name: "Arcane Focuses", one: "arcane focus", many: "arcane focuses" },
  druidic_focuses: { name: "Druidic Focuses", one: "druidic focus", many: "druidic focuses" },
  holy_symbols: { name: "Holy Symbols", one: "holy symbol", many: "holy symbols" },
  all: { name: "Anything", one: "option", many: "options" },
};

export const isGroup = (id) => typeof id === "string" && id in GROUP_LABELS;

// The groups a pool of each kind can use in a form.
export const POOL_GROUPS = {
  skills: ["all_skills"],
  expertise: ["proficient_skills"],
  tools: ["all_tools", "artisans_tools", "gaming_sets", "musical_instruments"],
  languages: ["all_languages", "standard_languages", "rare_languages"],
  saves: [],
};

export const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing",
  "poison", "psychic", "radiant", "slashing", "thunder",
];
export const CONDITIONS = [
  "blinded", "charmed", "deafened", "disease", "exhaustion", "frightened", "grappled", "incapacitated",
  "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious",
];
export const SPEED_MODES = ["walk", "fly", "swim", "climb", "burrow"];
export const SENSES = ["darkvision", "blindsight", "tremorsense", "truesight"];
export const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan", "varies"];
export const CREATURE_TYPES = [
  "aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend",
  "giant", "humanoid", "monstrosity", "ooze", "plant", "undead",
];

// ["small", "medium"] → "Small or Medium"
export const formatSize = (sizes) => (sizes || []).map(titleCase).join(" or ");

// The named blocks of a text ("**Darkvision.** …" → "Darkvision"), in order.
export const namedBlocks = (text) => {
  const out = [];
  for (const b of parseText(text)) {
    if (b.lead) out.push(b.lead.replace(/[.:]$/, ""));
    if (b.type === "list") b.items.forEach((it) => it.lead && out.push(it.lead.replace(/[.:]$/, "")));
  }
  return [...new Set(out)];
};

export const CLASS_IDS = [
  "artificer", "bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard",
];
export const SPELL_SCHOOLS = [
  "abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation",
];

export const FEAT_CATEGORIES = {
  origin: "Origin", general: "General", fighting_style: "Fighting Style",
  epic_boon: "Epic Boon", dragonmark: "Dragonmark", dark_gift: "Dark Gift",
};

export const FEATURE_TYPES = {
  eldritch_invocation: "Eldritch Invocation", maneuver: "Maneuver", metamagic: "Metamagic",
  elemental_discipline: "Elemental Discipline", artificer_infusion: "Artificer Infusion",
  arcane_shot: "Arcane Shot", rune: "Rune", renown_perk: "Renown Perk", pact_boon: "Pact Boon",
  fighting_style: "Fighting Style",
};
export const formatFeatureType = (t) => FEATURE_TYPES[t] || titleCase(String(t || "").replace(/_/g, " "));

// "superiority_dice" → "Superiority Die" (one) / "Superiority Dice" (many)
const resourceWords = (id, n) => {
  const many = labelFromId(id);
  if (n !== 1) return many;
  return many.replace(/ Dice$/, " Die").replace(/ Points$/, " Point").replace(/ Uses$/, " Use");
};

// A cost from a class resource: { resource, amount } or { resource, min, max }
// → "1 Superiority Die", "1–9 Sorcery Points".
export const describeConsumes = (c) => {
  if (!c?.resource) return "";
  if (c.amount != null) return `${c.amount} ${resourceWords(c.resource, c.amount)}`;
  if (c.min != null || c.max != null) return `${c.min ?? 1}–${c.max ?? "?"} ${resourceWords(c.resource, 2)}`;
  return resourceWords(c.resource, 2);
};

export const CATEGORY_LABELS = {
  traits: "Trait", actions: "Action", bonus_actions: "Bonus Action", reactions: "Reaction",
  legendary_actions: "Legendary Action", mythic_actions: "Mythic Action",
  lair_actions: "Lair Action", regional_effects: "Regional Effect",
};

// ─── Lists ─────────────────────────────────────────────────────────

// Unique values of a key across entries (arrays are flattened), sorted.
export const collectUnique = (rows, key) => {
  const set = new Set();
  for (const r of rows || []) {
    const v = typeof key === "function" ? key(r) : r?.[key];
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => x != null && x !== "" && set.add(x));
    else set.add(v);
  }
  return [...set].sort((a, b) => String(a).localeCompare(String(b)));
};

// Add or remove one value from a list.
export const toggleIn = (list, value) =>
  (list || []).includes(value) ? list.filter((x) => x !== value) : [...(list || []), value];

// The search box matches the name (and aliases, when an entry has them).
export const matchesQuery = (entry, query) => {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  if (String(entry?.name || "").toLowerCase().includes(q)) return true;
  return (entry?.aliases || []).some((a) => String(a).toLowerCase().includes(q));
};

export const byName = (a, b) => String(a?.name || "").localeCompare(String(b?.name || ""));

// A filter row: empty selection = everything passes; otherwise any overlap.
export const passesAny = (selected, values) =>
  !selected?.length || (values || []).some((v) => selected.includes(v));

// ─── Text ──────────────────────────────────────────────────────────
// Every entry's `text` is made by the pipeline's text_renderer, in one
// markdown-lite:
//   paragraphs split by a blank line · "**Name.** text" named paragraphs ·
//   "- item" lists ("  - " nested, "- **Name.** text" named items) ·
//   tables as "a | b" rows, with "--- | ---" under the header when there is
//   one and the caption as a one-line paragraph above · **bold** · *italic*
//
// parseText(text) → blocks:
//   { type: "paragraph", lead, text }        lead = the bold name, if any
//   { type: "list", items: [{ lead, text, depth }] }
//   { type: "table", caption, header, rows }
//   { type: "heading", text }                "## Heading" (homebrew text)

const splitRow = (line) => {
  let cells = line.split("|").map((c) => c.trim());
  if (cells.length && cells[0] === "") cells = cells.slice(1);
  if (cells.length && cells[cells.length - 1] === "") cells = cells.slice(0, -1);
  return cells;
};

const isSeparator = (line) => /^[\s:|-]+$/.test(line) && line.includes("-");
const LEAD = /^\*\*(.+?)\*\*\s*(.*)$/s;

// "Why Are You Here?." → "Why Are You Here?"
const cleanLead = (lead) => lead.trim().replace(/([?!])\.$/, "$1");

const splitLead = (text) => {
  const m = String(text).match(LEAD);
  return m ? { lead: cleanLead(m[1]), text: m[2].trim() } : { lead: null, text: String(text).trim() };
};

export const parseText = (text) => {
  if (typeof text !== "string" || !text.trim()) return [];
  const chunks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).filter((c) => c.trim());
  const blocks = [];

  for (const chunk of chunks) {
    const raw = chunk.split("\n").filter((l) => l.trim());
    const lines = raw.map((l) => l.trim());

    // Table: a "--- | ---" second line, or every line a row of cells
    const hasHeader = lines.length >= 2 && isSeparator(lines[1]);
    if (hasHeader || (lines.length >= 2 && lines.every((l) => l.includes(" | ")))) {
      const header = hasHeader ? splitRow(lines[0]) : null;
      const rows = (hasHeader ? lines.slice(2) : lines).map(splitRow);
      let caption = null;
      const prev = blocks[blocks.length - 1];
      if (prev?.type === "paragraph" && prev.single && !prev.lead) {
        caption = prev.text;
        blocks.pop();
      }
      blocks.push({ type: "table", caption, header, rows });
      continue;
    }

    // List: every line an item ("- "), maybe indented
    if (lines.every((l) => l.startsWith("- "))) {
      blocks.push({
        type: "list",
        items: raw.map((l) => {
          const depth = Math.floor((l.length - l.trimStart().length) / 2);
          return { ...splitLead(l.trim().replace(/^-\s+/, "")), depth };
        }),
      });
      continue;
    }

    if (lines[0].startsWith("#")) {
      blocks.push({ type: "heading", text: lines[0].replace(/^#+\s*/, "") });
      if (lines.length > 1) blocks.push({ type: "paragraph", ...splitLead(lines.slice(1).join(" ")), single: false });
      continue;
    }

    blocks.push({ type: "paragraph", ...splitLead(lines.join(" ")), single: lines.length === 1 });
  }
  return blocks;
};

// Inline **bold** / *italic* → [{ text, bold, italic }] runs.
export const parseInline = (text) => {
  const out = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m;
  const s = String(text ?? "");
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push(m[1] != null ? { text: m[1], bold: true } : { text: m[2], italic: true });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
};

// A feature's own part of the entry's text (the same rule as the
// pipeline's llm_schema.feature_text):
//   a "**Name.**" paragraph, plus the plain paragraphs after it, up to
//   the next named one; or a named list item "- **Name.** …".
const NAMED = /^\s*(?:-\s+)?\*\*(.+?)\.?\*\*/;

export const featureText = (text, name) => {
  if (typeof text !== "string" || !name) return "";
  const want = name.trim().toLowerCase();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(NAMED);
    if (!m || m[1].replace(/\.$/, "").trim().toLowerCase() !== want) continue;
    const out = [lines[i].trim()];
    const isItem = lines[i].trimStart().startsWith("- ");
    for (const next of lines.slice(i + 1)) {
      if (isItem && (!next.trim() || next.trimStart().startsWith("- "))) break;
      if (!isItem && NAMED.test(next) && !next.trimStart().startsWith("- ")) break;
      out.push(next.trimEnd());
    }
    return out.join("\n").trim();
  }
  return "";
};

// ─── Values ────────────────────────────────────────────────────────
// A value is a number, a formula ("pb", "8 + con_mod + pb") or a level
// table ({"1": "2d6", "5": "3d6"}).

const FORMULA_WORDS = {
  pb: "PB", level: "level", spell_mod: "spell mod", spell_level: "spell level", class_level: "class level",
  str_mod: "Str mod", dex_mod: "Dex mod", con_mod: "Con mod", int_mod: "Int mod", wis_mod: "Wis mod", cha_mod: "Cha mod",
};

export const formatFormula = (f) =>
  String(f).replace(/[a-z_]+/g, (w) => FORMULA_WORDS[w] || ABILITY_SHORT[w] || w);

export const formatValue = (v) => {
  if (v == null || v === "") return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return formatFormula(v);
  if (typeof v === "object") {
    return Object.entries(v)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([lvl, x]) => `${formatFormula(x)} (level ${lvl}+)`)
      .join(", ");
  }
  return String(v);
};

// ─── Grants & choices ──────────────────────────────────────────────

const CURRENCY_ORDER = ["pp", "gp", "ep", "sp", "cp"];

// { gp: 15, sp: 5 } → "15 GP, 5 SP"
export const formatCurrency = (cur) =>
  CURRENCY_ORDER.filter((k) => cur?.[k]).map((k) => `${cur[k]} ${k.toUpperCase()}`).join(", ");

// One item grant → "10 Parchment", "Pouch (with 15 GP)", "Jewelry (worth 10 GP)"
export const formatItemGrant = (g, index) => {
  if (!g) return "";
  const name = g.name ? cap(g.name) : nameFromId(typeof g.item === "string" ? g.item : "", index);
  let out = g.qty > 1 ? `${g.qty} ${name}` : name;
  if (g.contains) out += ` (with ${formatCurrency(g.contains)})`;
  if (g.worth) out += ` (worth ${formatCurrency(g.worth)})`;
  return out;
};

// When a use comes back: "short rest", "dawn", …
export const RESET_WORDS = {
  short: "short rest", long: "long rest", long_rest: "long rest", turn: "turn", recharge: "recharge",
  dawn: "dawn", dusk: "dusk", midnight: "midnight", special: "special",
};

// Item rarities, weakest first ("none" = mundane).
export const RARITY_ORDER = [
  "none", "common", "uncommon", "rare", "very rare", "legendary", "artifact", "varies", "unknown (magic)", "unknown",
];
export const formatRarity = (r) => (r === "none" ? "Mundane" : titleCase(r || ""));

const formatFeatGrant = (g, index) =>
  `${nameFromId(g.feat, index)}${g.option ? ` (${titleCase(g.option)})` : ""}`;

/* How a granted spell is ready, in the sheet Spellbook's words. The data
   keeps `how` + `uses` (common_schema SpellGrant / a spell pool):
     innate        how "known" or "prepared" (the same on the sheet: always
                   prepared, on no class list), free casts optional:
                   uses { max, reset: long | short | dawn }
     at_will       uses "at_will"
     ritual        uses "ritual" (ritual only)
     list          how "list" (added to your class's spell list)
   Item spells (how "item") have their own words (charges, per day…). */
export const SPELL_READY = [
  { value: "innate", label: "innate" },
  { value: "at_will", label: "at will" },
  { value: "ritual", label: "ritual only" },
  { value: "list", label: "on your spell list" },
];
export const FREE_CAST_RESETS = [
  { value: "long", label: "per long rest" },
  { value: "short", label: "per short rest" },
  { value: "dawn", label: "per day" },
];
export function spellReady(g) {
  const u = g?.uses;
  if (g?.how === "list") return { ready: "list", max: null, reset: "long" };
  if (u === "at_will") return { ready: "at_will", max: null, reset: "long" };
  if (u === "ritual") return { ready: "ritual", max: null, reset: "long" };
  const free = u && typeof u === "object" && u.max != null;
  return { ready: "innate", max: free ? u.max : null, reset: (free && u.reset) || "long" };
}
// The data for a ready choice: { how, uses } (uses undefined = none).
export function spellReadyGrant({ ready, max, reset }) {
  if (ready === "list") return { how: "list", uses: undefined };
  if (ready === "at_will") return { how: "prepared", uses: "at_will" };
  if (ready === "ritual") return { how: "prepared", uses: "ritual" };
  const free = max != null && max !== "" && max !== 0;
  return { how: "prepared", uses: free ? { max, reset: reset || "long" } : undefined };
}
// "innate, 1/long rest" · "at will" · "ritual only" · "on your spell list"
export const formatSpellReady = (g) => {
  if (g?.how === "item") return formatSpellUses(g.uses);
  const r = spellReady(g);
  if (r.ready !== "innate") return SPELL_READY.find((x) => x.value === r.ready).label;
  return r.max != null ? `innate, ${formatValue(r.max)} free ${Number(r.max) === 1 ? "cast" : "casts"} per ${r.reset === "dawn" ? "day" : RESET_WORDS[r.reset] || r.reset}` : "innate";
};

// How often a spell from a grant can be cast: "1/long rest", "3 charges",
// "once per dawn", "at will"…
export const formatSpellUses = (uses) => {
  if (!uses) return "";
  if (uses === "at_will") return "at will";
  if (uses === "ritual") return "ritual only";
  if (uses.resource === "charges") return plural(uses.cost ?? 1, "charge");
  if (uses.resource) return `${uses.cost ?? 1} ${labelFromId(uses.resource)}`;
  if (uses.max != null) {
    if (uses.reset === "never") return Number(uses.max) === 1 ? "once" : `${formatValue(uses.max)} times, then it's gone`;
    return `${formatValue(uses.max)}/${RESET_WORDS[uses.reset] || uses.reset || "long rest"}`;
  }
  return "";
};

const formatSpellGrant = (g, index) => {
  const bits = [];
  if (g.at && g.at > 1) bits.push(`at level ${g.at}`);
  const ready = formatSpellReady(g);
  if (ready) bits.push(ready);
  if (g.cast_at) bits.push(`as a level ${g.cast_at} spell`);
  return `${nameFromId(g.spell, index)}${bits.length ? ` (${bits.join(", ")})` : ""}`;
};

const joinWords = (list) => list.filter(Boolean).join(", ");

const formatMap = (obj, unit = " ft.") =>
  Object.entries(obj || {}).map(([k, v]) =>
    `${titleCase(k)} ${typeof v === "number" ? `${v}${unit}` : v === "walk" ? "equal to your walking speed" : formatValue(v)}`);

/* What an entry gives outright → rows { label, value } for a card.
   `index` (optional) names catalogue ids: buildNameIndex(feats, items, spells). */
export const describeGrants = (grants, index) => {
  const g = grants || {};
  const rows = [];
  const add = (label, value) => value && rows.push({ label, value });

  if (g.ability) add("Ability Scores", Object.entries(g.ability).map(([a, n]) => `${ABILITY_NAMES[a]} ${n >= 0 ? "+" : ""}${n}`).join(", "));
  add("Feats", joinWords((g.feats || []).map((f) => formatFeatGrant(f, index))));
  add("Skills", joinWords((g.skills || []).map(labelFromId)));
  add("Expertise", joinWords((g.expertise || []).map(labelFromId)));
  add("Saving Throws", joinWords((g.saves || []).map((a) => ABILITY_NAMES[a])));
  add("Tools", joinWords((g.tools || []).map(labelFromId)));
  add("Languages", joinWords((g.languages || []).map(labelFromId)));
  add("Weapons", joinWords((g.weapons || []).map(labelFromId)));
  add("Armor", joinWords((g.armor || []).map(labelFromId)));
  add("Speed", joinWords(formatMap(g.speed)));
  add("Senses", joinWords([...formatMap(g.senses), ...formatMap(g.senses_bonus).map((s) => `+${s}`)]));
  const d = g.defenses || {};
  add("Resistances", joinWords((d.resist || []).map(labelFromId)));
  add("Immunities", joinWords([...(d.immune || []), ...(d.condition_immune || [])].map(labelFromId)));
  add("Vulnerabilities", joinWords((d.vulnerable || []).map(labelFromId)));
  add("Equipment", joinWords([...(g.items || []).map((i) => formatItemGrant(i, index)), formatCurrency(g.currency)]));
  add("Spells", joinWords((g.spells || []).map((s) => formatSpellGrant(s, index))));
  add("Optional Features", joinWords((g.optional_features || []).map((id) => nameFromId(id, index))));
  return rows;
};

// A filter a pool picks from ({ spell_level: 1, class: "wizard" } …) → words.
export const describeFilter = (filter) => {
  if (!filter || typeof filter !== "object") return "";
  const list = (v) => (Array.isArray(v) ? v : [v]);
  const bits = [];
  if (filter.category) bits.push(list(filter.category).map((c) => FEAT_CATEGORIES[c] || titleCase(c)).join(" or "));
  if (filter.spell_level != null) {
    const lv = list(filter.spell_level);
    bits.push(lv.length === 1 ? (lv[0] === 0 ? "cantrip" : `level ${lv[0]}`) : `level ${lv[0]}–${lv[lv.length - 1]}`);
  }
  if (filter.school) bits.push(list(filter.school).map(titleCase).join(" or "));
  if (filter.class) bits.push(list(filter.class).map(titleCase).join(" or "));
  if (filter.feature_type) bits.push(list(filter.feature_type).map(titleCase).join(" or "));
  if (filter.ritual) bits.push("ritual");
  return bits.join(" ");
};

const KIND_NOUN = {
  skills: ["skill", "skills"], tools: ["tool", "tools"], languages: ["language", "languages"],
  feats: ["feat", "feats"], spells: ["spell", "spells"], items: ["item", "items"],
  weapons: ["weapon", "weapons"], armor: ["armor", "armor"], expertise: ["skill", "skills"],
  saves: ["saving throw", "saving throws"], optional_features: ["option", "options"],
  spell_ability: ["spellcasting ability", "spellcasting abilities"],
  "defenses.resist": ["resistance", "resistances"], "defenses.immune": ["immunity", "immunities"],
};

const formatBonusSets = (sets) =>
  (sets || []).map((s) => s.map((n) => `+${n}`).join("/")).join(" or ");

/* One choice → { label, value, options? }.
   options (bundles only): [{ label, rows, choices }] for nesting. */
export const describeChoice = (choice, index) => {
  if (!choice) return null;
  if (choice.type === "ability") {
    const from = (choice.from || []).map((a) => ABILITY_SHORT[a]).join(", ");
    return { label: choice.label || "Ability Scores", value: `${formatBonusSets(choice.bonus_sets)} among ${from}${choice.note ? ` (${choice.note})` : ""}` };
  }
  if (choice.type === "bundle") {
    return {
      label: choice.label || "Choose one",
      value: "choose one:",
      options: (choice.options || []).map((o) => ({
        label: o.label || o.id,
        rows: describeGrants(o.grants, index),
        choices: (o.choices || []).map((c) => describeChoice(c, index)).filter(Boolean),
      })),
    };
  }
  // pool
  const kind = Array.isArray(choice.grant) ? choice.grant[0] : choice.grant;
  const [one, many] = KIND_NOUN[kind] || ["option", "options"];
  const n = choice.count || 1;
  const from = choice.from;
  let value;
  if (typeof from === "string") {
    const g = GROUP_LABELS[from];
    value = `choose ${n} ${g ? (n === 1 ? g.one : g.many) : labelFromId(from)}`;
  } else if (Array.isArray(from)) {
    const byId = kind === "spells" || kind === "feats" || kind === "items" || kind === "optional_features";
    const names = from.map((id) => (isGroup(id) ? `any ${GROUP_LABELS[id].one}` : byId ? nameFromId(id, index) : labelFromId(id)));
    value = `choose ${n} from ${names.join(", ")}`;
  } else if (kind === "spells" && from && typeof from === "object") {
    // "choose 2 Cleric cantrips", "choose 1 level 1 Enchantment or Necromancy spell"
    const { spell_level, ...rest } = from;
    const lv = spell_level == null ? [] : Array.isArray(spell_level) ? spell_level : [spell_level];
    const noun = lv.length === 1 && lv[0] === 0 ? (n === 1 ? "cantrip" : "cantrips") : n === 1 ? one : many;
    const level = lv.length && !(lv.length === 1 && lv[0] === 0) ? describeFilter({ spell_level }) : "";
    value = `choose ${n} ${level} ${describeFilter(rest)} ${noun}`.replace(/\s+/g, " ");
  } else {
    value = `choose ${n} ${describeFilter(from)} ${n === 1 ? one : many}`.replace(/\s+/g, " ");
  }
  if (kind === "spells") {
    value += ` (${formatSpellReady(choice)})`;
  }
  return { label: choice.label || titleCase(kind), value };
};

// ─── Features ──────────────────────────────────────────────────────

const RESET = RESET_WORDS;

export const formatUses = (uses) => {
  if (!uses) return "";
  if (uses.reset === "recharge") return `Recharge ${uses.recharge ?? ""}`.trim();
  return `${formatValue(uses.max)}/${RESET[uses.reset] || uses.reset}`;
};

// Damage parts → "8d6 Fire (+1d6 per slot level)", "1d10 (level 1+), 2d10 (level 5+) Fire"
const formatDamage = (parts) =>
  (parts || [])
    .map((d) => [
      formatValue(d.dice), d.bonus ? `+ ${formatValue(d.bonus)}` : "", d.type ? labelFromId(d.type) : "",
      d.per_slot ? `(+${d.per_slot} per slot level)` : "",
    ].filter(Boolean).join(" "))
    .join(" + ");

// Short words for a feature's mechanics: ["1/long rest", "Action",
// "DC 8 + Con mod + PB Dex save", "2d6 Fire", "toggle"].
export const describeFeature = (f) => {
  if (!f) return [];
  const out = [];
  if (f.uses) out.push(formatUses(f.uses));
  if (f.category && f.category !== "traits") out.push(CATEGORY_LABELS[f.category] || titleCase(f.category));
  const a = f.action;
  if (a?.attack) {
    const hit = a.attack.bonus != null ? ` ${formatValue(a.attack.bonus)} to hit` : "";
    out.push(`${titleCase(a.attack.kind)} attack${hit}`);
    if (a.attack.damage?.length) out.push(formatDamage(a.attack.damage));
  }
  if (a?.save) {
    out.push(`${a.save.dc != null ? `DC ${formatValue(a.save.dc)} ` : ""}${ABILITY_SHORT[a.save.ability] || a.save.ability} save`);
    if (a.save.damage?.length) out.push(formatDamage(a.save.damage));
  }
  if (a?.damage?.length) out.push(formatDamage(a.damage));
  if (a?.heal) out.push(`heals ${formatValue(a.heal)}${a.heal_per_slot ? ` (+${a.heal_per_slot} per slot level)` : ""}`);
  if (a?.temp_hp) out.push(`${formatValue(a.temp_hp)} temporary HP${a.temp_hp_per_slot ? ` (+${a.temp_hp_per_slot} per slot level)` : ""}`);
  if (f.toggle) out.push("toggle");
  for (const m of f.modifiers || []) {
    const op = ["add", "base", "min", "set"].find((k) => k in m);
    out.push(`${m.target} ${op === "add" ? "+" : `${op} `}${formatValue(m[op])}`);
  }
  return out;
};

// ─── Filter values (what an entry offers) ──────────────────────────

const walkChoices = (choices, fn) => {
  for (const c of choices || []) {
    fn(c);
    if (c.type === "bundle") for (const o of c.options || []) walkChoices(o.choices, fn);
  }
};

// An entry and its options (a feat's Cleric / Druid / Wizard, a race's
// subraces): the filters look at all of them.
export const entryParts = (entry) => (entry ? [entry, ...(entry.options || []), ...(entry.subraces || [])] : []);

// Abilities an entry raises, fixed or by choice.
export const offeredAbilities = (entry) => {
  const set = new Set();
  for (const part of entryParts(entry)) {
    Object.keys(part.grants?.ability || {}).forEach((a) => set.add(a));
    walkChoices(part.choices, (c) => c.type === "ability" && (c.from || []).forEach((a) => set.add(a)));
  }
  return [...set];
};

// Skills an entry gives, fixed or as a pick from a list.
export const offeredSkills = (entry) => {
  const set = new Set();
  for (const part of entryParts(entry)) {
    (part.grants?.skills || []).forEach((s) => set.add(s));
    walkChoices(part.choices, (c) => {
      if (c.type === "pool" && c.grant === "skills" && Array.isArray(c.from)) c.from.forEach((s) => set.add(s));
    });
  }
  return [...set];
};

// The kinds of thing an entry gives ("spells", "skills", "resistances"…),
// fixed or by choice — for a "Gives" filter.
export const GIVES_LABELS = {
  ability: "Ability Scores", feats: "Feats", skills: "Skills", expertise: "Expertise", tools: "Tools",
  languages: "Languages", saves: "Saving Throws", weapons: "Weapon Proficiencies", armor: "Armor Training",
  spells: "Spells", senses: "Senses", speed: "Speed", defenses: "Resistances & Immunities",
  optional_features: "Class Options", items: "Equipment",
};

export const offeredKinds = (entry) => {
  const set = new Set();
  const add = (k) => {
    const base = String(k).split(".")[0];
    const key = base === "senses_bonus" ? "senses" : base === "currency" ? "items" : base;
    if (key in GIVES_LABELS) set.add(key);
  };
  for (const part of entryParts(entry)) {
    Object.keys(part.grants || {}).forEach(add);
    walkChoices(part.choices, (c) => {
      if (c.type === "ability") add("ability");
      if (c.type === "pool") (Array.isArray(c.grant) ? c.grant : [c.grant]).forEach(add);
    });
  }
  return [...set];
};

// Keys of one grants object an entry or its options have ("darkvision",
// "fly", "fire"…), for the senses / speed / resistance filters.
const grantKeys = (entry, pick) => {
  const set = new Set();
  for (const part of entryParts(entry)) pick(part.grants || {}).forEach((k) => set.add(k));
  return [...set];
};
export const offeredSenses = (entry) => grantKeys(entry, (g) => Object.keys(g.senses || {}));
export const offeredSpeeds = (entry) => grantKeys(entry, (g) => Object.keys(g.speed || {}).filter((k) => k !== "walk"));
export const offeredResistances = (entry) =>
  grantKeys(entry, (g) => [...(g.defenses?.resist || []), ...(g.defenses?.immune || [])]);

// Feats an entry gives: feat ids, plus "category:<name>" for a pick by category.
export const offeredFeats = (entry) => {
  const set = new Set((entry?.grants?.feats || []).map((f) => f.feat));
  walkChoices(entry?.choices, (c) => {
    if (c.type !== "pool" || c.grant !== "feats") return;
    if (Array.isArray(c.from)) c.from.forEach((f) => set.add(f));
    else if (c.from && typeof c.from === "object") (c.from.category || []).forEach((k) => set.add(`category:${k}`));
    else if (c.from === "all_feats") set.add("category:any");
  });
  return [...set];
};

export const formatFeatOffer = (value, index) => {
  if (!String(value).startsWith("category:")) return nameFromId(value, index);
  const k = value.slice("category:".length);
  return k === "any" ? "Any feat" : `Any ${FEAT_CATEGORIES[k] || titleCase(k)} feat`;
};

// ─── Prerequisites ─────────────────────────────────────────────────
// A list of groups: ANY one group is enough; inside a group ALL parts are
// needed; inside a list part (ability, race, feat…) any one item is enough.

const anyOf = (list) => list.filter(Boolean).join(" or ");

export const PREREQUISITE_LABELS = {
  level: "Level", class_level: "Class Level", ability: "Ability Score", race: "Species", background: "Background",
  feat: "Feat", feat_category: "Feat", no_other_feat_category: "Feat", feature: "Class Feature",
  spellcasting: "Spellcasting", proficiency: "Proficiency", optional_feature: "Class Option", pact: "Pact Boon",
  spell: "Spell", item: "Item", campaign: "Campaign", note: "Other",
};

const describeGroup = (g, index) => {
  const parts = [];
  if (g.level) parts.push(`Level ${g.level}+`);
  for (const c of g.class_level || []) parts.push(`${titleCase(c.class)} level ${c.level}${c.subclass ? ` (${titleCase(c.subclass)})` : ""}`);
  if (g.ability?.length) parts.push(anyOf(g.ability.map((o) => Object.entries(o).map(([a, n]) => `${ABILITY_SHORT[a]} ${n}+`).join(" and "))));
  if (g.race?.length) parts.push(anyOf(g.race.map((r) => r.size || titleCase([r.subrace, r.race].filter(Boolean).join(" ")))));
  if (g.background?.length) parts.push(`${anyOf(g.background.map((b) => nameFromId(b, index)))} background`);
  if (g.feat?.length) parts.push(`${anyOf(g.feat.map((f) => nameFromId(f, index)))} feat`);
  if (g.feat_category?.length) parts.push(`a ${anyOf(g.feat_category.map((k) => FEAT_CATEGORIES[k] || titleCase(k)))} feat`);
  if (g.no_other_feat_category?.length) parts.push(`no other ${anyOf(g.no_other_feat_category.map((k) => FEAT_CATEGORIES[k] || titleCase(k)))} feat`);
  if (g.feature?.length) parts.push(`${anyOf(g.feature.map(labelFromId))} feature`);
  if (g.spellcasting) parts.push("the ability to cast at least one spell");
  if (g.proficiency?.length) parts.push(`${anyOf(g.proficiency.map((p) => Object.entries(p).map(([k, v]) => `${labelFromId(v)}${k === "armor" ? " armor" : ""}`).join(" and ")))} proficiency`);
  if (g.optional_feature?.length) parts.push(anyOf(g.optional_feature.map((o) => nameFromId(o, index))));
  if (g.pact?.length) parts.push(`Pact of the ${anyOf(g.pact.map(titleCase))}`);
  if (g.spell?.length) parts.push(`${anyOf(g.spell.map((sp) => nameFromId(sp, index)))} spell`);
  if (g.item?.length) parts.push(anyOf(g.item));
  if (g.campaign?.length) parts.push(`${anyOf(g.campaign)} campaign`);
  if (g.note) parts.push(g.note);
  return parts.join(", ");
};

// "Level 4+, Str 13+ or Dex 13+" — one string per alternative group.
export const describePrerequisites = (prereqs, index) =>
  (prereqs || []).map((g) => describeGroup(g, index)).filter(Boolean);

// The kinds of prerequisite an entry has ("none" when it has none).
export const prerequisiteKinds = (entry) => {
  const groups = entry?.prerequisites || [];
  if (!groups.length) return ["none"];
  const set = new Set();
  for (const g of groups) Object.keys(g).forEach((k) => set.add(PREREQUISITE_LABELS[k] ? k.replace(/^(feat_category|no_other_feat_category)$/, "feat") : k));
  return [...set];
};

// ─── Forms ─────────────────────────────────────────────────────────

// Drops null / undefined / "" / [] / {} everywhere; keeps 0 and false
// (the same contract as the cleaned data).
export const pruneEmpty = (value) => {
  if (Array.isArray(value)) {
    const out = value.map(pruneEmpty).filter((v) => v !== undefined);
    return out.length ? out : undefined;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const p = pruneEmpty(v);
      if (p !== undefined) out[k] = p;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === null || value === undefined || value === "") return undefined;
  return value;
};

export const numOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// A blank that may hold a number, a formula or a level table:
//   "6" → 6 · "2 + pb" stays a string · "" → undefined
//   "1: 1d10, 5: 2d10, 11: 3d10" → {"1": "1d10", "5": "2d10", "11": "3d10"}
// (a cantrip's dice by character level). textFromValue is the way back.
const LEVEL_TABLE = /^\s*\d+\s*:/;
const oneValue = (t) => (/^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t);
export const valueFromText = (t) => {
  const s = String(t ?? "").trim();
  if (!s) return undefined;
  if (LEVEL_TABLE.test(s)) {
    const out = {};
    for (const part of s.split(",")) {
      const m = part.match(/^\s*(\d+)\s*:\s*(.+?)\s*$/);
      if (m) out[m[1]] = oneValue(m[2]);
    }
    return out;
  }
  return oneValue(s);
};
export const textFromValue = (v) => {
  if (v == null) return "";
  if (typeof v === "object") return Object.entries(v).sort(([a], [b]) => Number(a) - Number(b)).map(([k, x]) => `${k}: ${x}`).join(", ");
  return String(v);
};