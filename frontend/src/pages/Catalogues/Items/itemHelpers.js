// ─── Sources ───────────────────────────────────────────────────────
export const SOURCE_NAMES = {
  XPHB: "Player Handbook One",
  PHB: "Player Handbook Classic",
  XDMG: "Dungeon Master's Guide One",
  DMG: "Dungeon Master's Guide Classic",
  SCAG: "Sword Coast Adventurer's Guide",
  BGDIA: "Baldur's Gate: Descent into Avernus",
  TCE: "Tasha's Cauldron of Everything",
  XGE: "Xanathar's Guide to Everything",
  ERLW: "Eberron: Rising from the Last War",
  AAG: "Astral Adventure's Guide",
  AI: "Acquisitions Incorporated",
  BGG: "Bigby Presents: Glory of the Giants",
  BMT: "The Book of Many Things",
  DSotDQ: "Dragonlance: Shadow of the Dragon Queen",
  EFA: "Eberron: Forge of the Artificer",
  EGW: "Explorer's Guide to Wildemount",
  FRHoF: "Forgotten Realms: Heroes of Faerun",
  GGR: "Guildmasters Guide to Ravnica",
  GoS: "Ghosts of Saltmarsh",
  MOT: "Mythic Odysseys of Theros",
  SCC: "Strixhaven: A Curriculum of Chaos",
  ToA: "Tomb of Annihilation",
  VRGR: "Van Richten's Guide to Ravenloft",
  WBtW: "The Wild Beyond the Witchlight",
  FTD: "Fizban's Treasury of Dragons",
  IDRotF: "Icewind Dale: Rime of the Frostmaiden",
  CoS: "Curse of Strahd",
  PotA: "Princes of the Apocalypse",
  LLK: "Lost Laboratory of Kwalish",
};
export const formatSource = (src) => SOURCE_NAMES[src] || src;

// ─── Rarity ────────────────────────────────────────────────────────
export const RARITY_ORDER = [
  "common", "uncommon", "rare", "very rare",
  "legendary", "artifact","varies", "none",
  'unknown', 'unknown (magic)'
];

// Rarity inks (theme slots): the higher the rarity, the stronger the ink.
export const RARITY_COLORS = {
  common: "text-ink-faded",
  uncommon: "text-good",
  rare: "text-info",
  "very rare": "text-magic",
  legendary: "text-rubric",
  artifact: "text-bad",
  none: "text-ink-faded",
  unknown: "text-ink-faded",
  'unknown (magic)': "text-ink-faded",
  varies: "text-ink-faded",
};

export const rarityClass = (rarity) =>
  RARITY_COLORS[(rarity || "").toLowerCase()] || RARITY_COLORS.none;

const cap = (s) =>
  s ? String(s)[0].toUpperCase() + String(s).slice(1) : s;

export const formatRarity = (r) =>
  (r || "")
    .split(" ")
    .map(cap)
    .join(" ");

// "major" + "legendary" → "Major Legendary"
export const formatTierRarity = (tier, rarity) => {
  const parts = [];
  if (tier && tier !== "none") parts.push(cap(tier));
  if (rarity && rarity !== "none") parts.push(formatRarity(rarity));
  return parts.join(" ");
};

// ─── Collect ───────────────────────────────────────────────────────
export const collectUnique = (items, key) => {
  const set = new Set();
  for (const it of items) {
    const v = it?.[key];
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => x && set.add(x));
    else set.add(v);
  }
  return [...set].sort((a, b) => String(a).localeCompare(String(b)));
};

export const attuneLabel = (reqAttune) => {
  if (!reqAttune) return null;
  if (reqAttune === true) return "Attunement";
  return `Attunement (${reqAttune})`;
};

// ─── Currency ──────────────────────────────────────────────────────
// Convert raw copper value to its natural denominations.
// D&D currency: 100 cp = 10 sp = 1 gp.
//   1340534 → "13405gp 3sp 4cp"
//      100000 → "1000gp"
//         150 → "1gp 5sp"
//           7 → "7cp"
//           0 → "0cp"
export const formatValue = (cp) => {
  if (cp == null || cp === "") return null;
  const n = Number(cp);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return "0cp";

  const gp = Math.floor(n / 100);
  const sp = Math.floor((n % 100) / 10);
  const cpRem = n % 10;

  const parts = [];
  if (gp) parts.push(`${gp}gp`);
  if (sp) parts.push(`${sp}sp`);
  if (cpRem) parts.push(`${cpRem}cp`);

  return parts.join(" ");
};

// ─── Charged ───────────────────────────────────────────────────────
// A charged amount/max_charges value can be:
//   number (legacy)                    → "1"
//   { fixed: 3, roll: null }           → "3"
//   { fixed: null, roll: {die_type, dice_amount, mod} } → "1d3" or "1d3+1"
export const formatChargeValue = (val) => {
  if (val == null) return null;
  if (typeof val === "number") return String(val);
  if (typeof val !== "object") return String(val);
  if (val.fixed != null) return String(val.fixed);
  if (val.roll) {
    const { die_type, dice_amount, mod } = val.roll;
    const base = `${dice_amount || 1}${die_type || "d6"}`;
    if (mod && Number(mod) !== 0) {
      const m = Number(mod);
      return `${base}${m > 0 ? `+${m}` : m}`;
    }
    return base;
  }
  return null;
};

// Build a "Charges" display string from a charged object.
//   { recharges_at: "dawn", amount: {roll:{die_type:"d3",dice_amount:1,mod:0}}, max_charges: {fixed:3} }
//     → "3 max, regains 1d3 at dawn"
export const formatCharged = (charged) => {
  if (!charged) return null;
  const max = formatChargeValue(charged.max_charges);
  const amount = formatChargeValue(charged.amount);
  const at = charged.recharges_at;

  const parts = [];
  if (max) parts.push(`${max} max`);
  if (amount && at) parts.push(`regains ${amount} at ${at}`);
  else if (at) parts.push(`recharges at ${at}`);
  else if (amount) parts.push(`regains ${amount}`);
  return parts.length ? parts.join(", ") : null;
};

// ─── Speed modifications ───────────────────────────────────────────
// Convert modifySpeed object to a list of display chips.
// Returns [{ label: "Fly", value: "+10 ft" }, ...]
export const formatModifySpeed = (modSpeed) => {
  if (!modSpeed || typeof modSpeed !== "object") return [];
  const capf = (s) => s[0].toUpperCase() + s.slice(1);
  const out = [];
  const allSpeeds = ["walk", "fly", "swim", "climb", "burrow"];

  for (const speed of allSpeeds) {
    if (modSpeed.static?.[speed] != null) {
      out.push({ label: capf(speed), value: `${modSpeed.static[speed]} ft` });
    }
    if (modSpeed.bonus?.[speed] != null) {
      const v = Number(modSpeed.bonus[speed]);
      out.push({ label: capf(speed), value: `${v >= 0 ? "+" : ""}${v} ft` });
    }
    if (modSpeed.multiply?.[speed] != null) {
      out.push({ label: capf(speed), value: `×${modSpeed.multiply[speed]}` });
    }
  }
  return out;
};

// ─── Range & Light ─────────────────────────────────────────────────
export const formatRange = (range) => {
  if (!range) return null;
  const { min, max } = range;
  if (min != null && max != null) return `${min}/${max} ft`;
  if (max != null) return `${max} ft`;
  if (min != null) return `${min} ft`;
  return null;
};

export const formatLight = (light) => {
  if (!light) return null;
  const parts = [];
  if (light.bright != null) parts.push(`${light.bright} ft bright`);
  if (light.dim != null) parts.push(`${light.dim} ft dim`);
  return parts.length ? parts.join(", ") : null;
};

// ─── Homebrew ──────────────────────────────────────────────────────
SOURCE_NAMES.HOMEBREW = "Homebrew";

// ─── Item creation constants ───────────────────────────────────────
export const ITEM_TYPES = [
  "Spellcasting Focus", "Melee Weapon", "Instrument", "Rod", "Wand",
  "Adventuring Gear", "Trade Good", "Other", "Ring", "Vehicle", "Tool",
  "Treasure", "Shield", "Heavy Armor", "Mount", "Medium Armor", "Potion",
  "Explosive", "Gaming Set", "Ranged Weapon", "Light Armor", "Scroll",
  "Ammunition", "Generic Variant", "Tattoo", "Poison", "Wondrous",
];

export const ITEM_RARITIES = [
  "common", "uncommon", "rare", "very rare", "legendary", "artifact", "none",
];

export const ITEM_TIERS = ["none", "minor", "major"];

export const WEAPON_BASE_ITEMS = [
  "sickle", "drum", "greataxe", "warhammer", "shield", "plate armor",
  "battleaxe", "quarterstaff", "dagger", "scale mail", "greatsword",
  "longsword", "spear", "mace", "breastplate", "trident", "shortsword",
  "flail", "greatclub", "whip", "chain mail", "shortbow",
  "studded leather armor", "maul", "leather armor", "horn", "lyre", "lute",
  "war pick", "javelin", "club", "longbow", "musket", "pike", "morningstar",
  "scimitar", "dart", "rapier", "sling", "pistol", "chain shirt",
];

export const WEAPON_CATEGORIES = ["simple", "martial"];

export const WEAPON_PROPERTY_INFO = {
  "Ammunition": "You can use a weapon that has the ammunition property to make a ranged attack only if you have ammunition to fire from the weapon. Each time you attack with the weapon, you expend one piece of ammunition. Drawing the ammunition from a quiver, case, or other container is part of the attack. Loading a one-handed weapon requires a free hand. At the end of the battle, you can recover half your expended ammunition by taking a minute to search the battlefield. If you use a weapon that has the ammunition property to make a melee attack, you treat the weapon as an improvised weapon. A sling must be loaded to deal any damage when used in this way.",
  "Burst Fire": "A weapon that has the burst fire property can make a single-target attack, or it can spray a 10-foot-cube area within normal range with shots. Each creature in the area must succeed on a DC 15 Dexterity saving throw or take the weapon's normal damage. This action uses ten pieces of ammunition.",
  "Finesse": "When making an attack with a finesse weapon, you use your choice of your Strength or Dexterity modifier for the attack and damage rolls. You must use the same modifier for both rolls.",
  "Heavy": "Creatures that are Small or Tiny have disadvantage on attack rolls with heavy weapons. A heavy weapon's size and bulk make it too large for a Small or Tiny creature to use effectively.",
  "Light": "A light weapon is small and easy to handle, making it ideal for use when fighting with two weapons.",
  "Loading": "Because of the time required to load this weapon, you can fire only one piece of ammunition from it when you use an action, bonus action, or reaction to fire it, regardless of the number of attacks you can normally make.",
  "Reach": "This weapon adds 5 feet to your reach when you attack with it. This property also determines your reach for opportunity attacks with a reach weapon.",
  "Reload": "A limited number of shots can be made with a weapon that has the reload property. A character must then reload it using an action or a bonus action (the character's choice).",
  "Thrown": "If a weapon has the thrown property, you can throw the weapon to make a ranged attack. If the weapon is a melee weapon, you use the same ability modifier for that attack roll and damage roll that you would use for a melee attack with the weapon.",
  "Two-Handed": "This weapon requires two hands to use. This property is relevant only when you attack with the weapon, not when you simply hold it.",
  "Versatile": "This weapon can be used with one or two hands. A damage value in parentheses appears with the property—the damage when the weapon is used with two hands to make a melee attack.",
  "Vestige of Divergence": "This item is a Vestige of Divergence. See the Vestiges of Divergence section for more information.",
};

export const WEAPON_PROPERTIES = Object.keys(WEAPON_PROPERTY_INFO).sort();

export const propertyDescription = (name) => WEAPON_PROPERTY_INFO[name] || null;

export const WEAPON_MASTERY_INFO = {
  "Cleave": "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn.",
  "Graze":  "If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.",
  "Nick":   "When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.",
  "Push":   "If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.",
  "Sap":    "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  "Slow":   "If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn't exceed 10 feet.",
  "Topple": "If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.",
  "Vex":    "If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.",
};

export const WEAPON_MASTERIES = Object.keys(WEAPON_MASTERY_INFO).sort();

export const masteryDescription = (name) => WEAPON_MASTERY_INFO[name] || null;

export const RECHARGE_OPTIONS = [
  "dawn", "dusk", "longrest", "shortrest", "special",
];

export const ITEM_AGES = ["modern", "renaissance", "futuristic"];

export const STANDARD_CLASSES = [
  "Artificer", "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk",
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard",
];

export const SPEED_TYPES = ["walk", "fly", "swim", "climb", "burrow"];
export const SPEED_MODES = [
  { value: "static",   label: "Set to (ft)" },
  { value: "bonus",    label: "Bonus (ft)" },
  { value: "multiply", label: "Multiply (×)" },
];

// Dice notation validator.
export const isValidDiceNotation = (s) => /^\d+d\d+(\+\d+)?$/i.test(String(s || "").trim());

export const itemKindFromType = (typesArr) => {
  const t = new Set(typesArr || []);
  if (t.has("Melee Weapon") || t.has("Ranged Weapon") || t.has("Ammunition")) return "weapon";
  if (t.has("Light Armor") || t.has("Medium Armor") || t.has("Heavy Armor") || t.has("Shield")) return "armor";
  if (t.has("Vehicle")) return "vehicle";
  if (t.has("Mount")) return "mount";
  return null;
};