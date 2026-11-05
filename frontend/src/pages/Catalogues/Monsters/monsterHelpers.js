// ─── Sources ───────────────────────────────────────────────────────
export const SOURCE_NAMES = {
  XMM: "Monster Manual One",
  MM: "Monster Manual Classic",
  XPHB: "Player Handbook One",
  PHB: "Player Handbook Classic",
  XDMG: "Dungeon Master's Guide One",
  DMG: "Dungeon Master's Guide Classic",
  TCE: "Tasha's Cauldron of Everything",
  XGE: "Xanathar's Guide to Everything",
  VGM: "Volo's Guide to Monsters",
  MTF: "Mordenkainen's Tome of Foes",
  MPMM: "Mordenkainen Presents: Monsters of the Multiverse",
  FTD: "Fizban's Treasury of Dragons",
  BGG: "Bigby Presents: Glory of the Giants",
  ERLW: "Eberron: Rising from the Last War",
  EGW: "Explorer's Guide to Wildemount",
  MOT: "Mythic Odysseys of Theros",
  VRGR: "Van Richten's Guide to Ravenloft",
  SCC: "Strixhaven: A Curriculum of Chaos",
  GGR: "Guildmasters Guide to Ravnica",
  ToA: "Tomb of Annihilation",
  WBtW: "The Wild Beyond the Witchlight",
  BMT: "The Book of Many Things",
  SatO: "Sigil and the Outlands",
  GoS: "Ghosts of Saltmarsh",
  BGDIA: "Baldur's Gate: Descent into Avernus",
  DSotDQ: "Dragonlance: Shadow of the Dragon Queen",
  IDRotF: "Icewind Dale: Rime of the Frostmaiden",
  CoS: "Curse of Strahd",
  PotA: "Princes of the Apocalypse",
};
export const formatSource = (s) => SOURCE_NAMES[s] || s;

// ─── Shared ────────────────────────────────────────────────────────
export const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];
export const ABILITY = {
  str: "STR", dex: "DEX", con: "CON",
  int: "INT", wis: "WIS", cha: "CHA",
};
const cap = (s) =>
  typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : s;
export const titleCase = (s) =>
  String(s || "")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");

// effects may be entirely absent (monster has no actions/traits/etc.)
export const getEffectCategories = (monster) => monster?.effects || {};

// ─── CR / Level ────────────────────────────────────────────────────
export const CR_OPTIONS = [
  "0", "1/8", "1/4", "1/2",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
];
const CR_FRAC = { "0": 0, "1/8": 0.125, "1/4": 0.25, "1/2": 0.5 };
export const crToNumber = (cr) => {
  if (cr == null) return null;
  if (cr in CR_FRAC) return CR_FRAC[cr];
  const n = Number(cr);
  return Number.isFinite(n) ? n : null;
};

export const monsterUsesLevel = (m) => m?.cr?.level != null;

// "CR 21" for cr-based, "Level 4" for level-based.
export const formatCR = (cr) => {
  if (!cr) return "";
  if (cr.level != null) return `Level ${cr.level}`;
  if (cr.base != null) return `CR ${cr.base}`;
  return "";
};

export const formatXp = (xp) =>
  xp == null ? "" : new Intl.NumberFormat("en-US").format(xp);

// Full challenge line for the popup body.
export const formatChallenge = (cr) => {
  if (!cr) return "";
  if (cr.level != null) {
    return cr.pb != null ? `${cr.level} (PB +${cr.pb})` : String(cr.level);
  }
  if (cr.base != null) {
    const extras = [];
    if (cr.xp != null) extras.push(`${formatXp(cr.xp)} XP`);
    if (cr.pb != null) extras.push(`PB +${cr.pb}`);
    return extras.length ? `${cr.base} (${extras.join(", ")})` : `${cr.base}`;
  }
  return "";
};

// ─── Type / subtype ────────────────────────────────────────────────
export const getMonsterType = (m) => {
  const t = m?.type;
  if (!t) return "";
  return typeof t === "string" ? t : t.type || "";
};
export const getMonsterSubtypes = (m) => {
  const t = m?.type;
  if (!t || typeof t === "string") return [];
  return Array.isArray(t.tags) ? t.tags : [];
};

export const formatTypeLine = (m) => {
  const size = (m?.size || []).join(" or ");
  const type = getMonsterType(m);
  const subs = getMonsterSubtypes(m);
  const subStr = subs.length ? ` (${subs.join(", ")})` : "";
  const align = (m?.alignment || []).join(", ");
  const head = [size, type].filter(Boolean).join(" ");
  return `${head}${subStr}${align ? `, ${align}` : ""}`;
};

// ─── AC ────────────────────────────────────────────────────────────
export const formatAC = (ac) => {
  if (!Array.isArray(ac) || !ac.length) return "";
  return ac
    .map((a) => {
      let s = String(a.value);
      const from = (a.from || []).join(", ");
      if (from) s += ` (${from})`;
      if (a.condition) s += ` ${a.condition}`;
      if (a.special) s += ` — ${a.special}`;
      return s;
    })
    .join(", ");
};

// ─── HP ────────────────────────────────────────────────────────────
export const formatHP = (hp) => {
  if (!hp) return "";
  if (hp.average != null && hp.formula) return `${hp.average} (${hp.formula})`;
  if (hp.average != null) return String(hp.average);
  if (hp.special) return hp.special;
  return "";
};

// ─── Speed ─────────────────────────────────────────────────────────
export const formatSpeed = (speed) => {
  if (!speed || typeof speed !== "object") return "";
  const parts = [];
  for (const [key, val] of Object.entries(speed)) {
    if (val == null) continue;
    if (key === "walk") parts.unshift(`${val} ft.`);
    else parts.push(`${key} ${val} ft.`);
  }
  return parts.join(", ");
};

// ─── Initiative ────────────────────────────────────────────────────
export const formatInitiative = (init) => {
  if (!init || init.total == null) return "";
  const sign = init.total >= 0 ? "+" : "";
  return `${sign}${init.total}${init.advantage ? " (adv.)" : ""}`;
};

// ─── Senses ────────────────────────────────────────────────────────
export const formatSenses = (senses, passive) => {
  const parts = [];
  if (senses && typeof senses === "object") {
    for (const [k, v] of Object.entries(senses)) {
      if (v == null) continue;
      parts.push(`${cap(k)} ${v} ft.`);
    }
  }
  if (passive != null) parts.push(`Passive Perception ${passive}`);
  return parts.join(", ");
};

export const getMonsterSenses = (m) =>
  m?.senses && typeof m.senses === "object" ? Object.keys(m.senses) : [];

// ─── Skills ────────────────────────────────────────────────────────
export const formatSkills = (skill) => {
  if (!skill || typeof skill !== "object") return "";
  return Object.entries(skill)
    .map(([k, v]) => `${titleCase(k)} ${v}`)
    .join(", ");
};

// ─── Damage / condition resistances/immunities ─────────────────────
export const formatTypedBlock = (block) => {
  if (!block) return "";
  const parts = [];
  if (Array.isArray(block.types) && block.types.length)
    parts.push(block.types.map(cap).join(", "));
  if (Array.isArray(block.conditional)) {
    for (const c of block.conditional) {
      const t = (c.types || []).map(cap).join(", ");
      parts.push(`${t} ${c.note || ""}`.trim());
    }
  }
  if (block.special) parts.push(block.special);
  return parts.filter(Boolean).join("; ");
};

// ─── Languages ─────────────────────────────────────────────────────
export const formatLanguages = (langs) =>
  Array.isArray(langs) && langs.length ? langs.map(titleCase).join(", ") : "—";

// ─── Charges → label ───────────────────────────────────────────────
export const formatCharges = (c) => {
  if (!c) return "";
  const { reset_type, recharge_dice, per_rest_count, max_charges } = c;
  if (reset_type === "recharge_dice") {
    if (!recharge_dice) return "(Recharge)";
    const d = String(recharge_dice);
    if (d === "6") return "(Recharge 6)";
    if (/^\d$/.test(d)) return `(Recharge ${d}-6)`;
    return `(Recharge ${d})`;
  }
  if (reset_type === "long_rest")
    return `(${per_rest_count ?? max_charges}/Day)`;
  if (reset_type === "short_rest")
    return `(${per_rest_count ?? max_charges}/Short Rest)`;
  if (reset_type === "special") return "(Special)";
  return "";
};

// ─── Spellcasting ──────────────────────────────────────────────────
export const formatSpellMeta = (block) => {
  if (!block) return "";
  const parts = [];
  if (block.ability) parts.push(ABILITY[block.ability] || block.ability.toUpperCase());
  if (block.save_dc != null) parts.push(`DC ${block.save_dc}`);
  if (block.spell_attack_bonus != null) {
    const s = block.spell_attack_bonus >= 0 ? "+" : "";
    parts.push(`${s}${block.spell_attack_bonus} to hit`);
  }
  return parts.join(", ");
};

export const formatSpellEntry = (sp) => {
  if (!sp) return "";
  const name = titleCase(sp.name);
  return sp.note ? `${name} (${sp.note})` : name;
};

// ─── Effect categories — fixed display order ───────────────────────
export const EFFECT_SECTIONS = [
  { key: "traits",            title: "Traits" },
  { key: "actions",           title: "Actions" },
  { key: "bonus_actions",     title: "Bonus Actions" },
  { key: "reactions",         title: "Reactions" },
  { key: "legendary_actions", title: "Legendary Actions" },
  { key: "mythic_actions",    title: "Mythic Actions" },
  { key: "lair_actions",      title: "Lair Actions" },
  { key: "regional_effects",  title: "Regional Effects" },
];

// ─── Generic collector ─────────────────────────────────────────────
export const collectUnique = (rows, key) => {
  const set = new Set();
  for (const r of rows || []) {
    const v = r?.[key];
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => x && set.add(x));
    else set.add(v);
  }
  return [...set].sort((a, b) => String(a).localeCompare(String(b)));
};

// ─── Movement modes ────────────────────────────────────────────────
// Returns array of movement modes present on monster (only numeric, >0).
// Skips boolean modifiers like `hover`.
export const getMonsterMovements = (m) => {
  const speed = m?.speed;
  if (!speed || typeof speed !== "object") return [];
  return Object.keys(speed).filter(
    (k) => typeof speed[k] === "number" && speed[k] > 0
  );
};

// ─── Sortable difficulty value ─────────────────────────────────────
// Unified numeric value for sorting — works for both CR and level monsters.
// Returns null when neither is set (those rows go to the end of sorted lists).
export const getMonsterDifficulty = (m) => {
  const cr = m?.cr;
  if (!cr) return null;
  if (cr.level != null) return cr.level;
  return crToNumber(cr.base);
};

// ─── Conditions inflicted / forced saves ───────────────────────────
export const getMonsterConditionInflict = (m) =>
  Array.isArray(m?.condition_inflict) ? m.condition_inflict : [];

export const getMonsterForcedSaves = (m) =>
  Array.isArray(m?.forced_saving_throw) ? m.forced_saving_throw : [];

// Short labels for saves: "constitution" → "CON"
const SAVE_ABBR = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
};
export const formatSaveLabel = (s) =>
  SAVE_ABBR[String(s || "").toLowerCase()] || titleCase(s);



// ─── CR → XP / PB table (xp & pb auto-derived from base CR) ────────
export const CR_STATS = {
  "0":  { xp: 10,     pb: 2 },
  "1/8":{ xp: 25,     pb: 2 },
  "1/4":{ xp: 50,     pb: 2 },
  "1/2":{ xp: 100,    pb: 2 },
  "1":  { xp: 200,    pb: 2 },
  "2":  { xp: 450,    pb: 2 },
  "3":  { xp: 700,    pb: 2 },
  "4":  { xp: 1100,   pb: 2 },
  "5":  { xp: 1800,   pb: 3 },
  "6":  { xp: 2300,   pb: 3 },
  "7":  { xp: 2900,   pb: 3 },
  "8":  { xp: 3900,   pb: 3 },
  "9":  { xp: 5000,   pb: 4 },
  "10": { xp: 5900,   pb: 4 },
  "11": { xp: 7200,   pb: 4 },
  "12": { xp: 8400,   pb: 4 },
  "13": { xp: 10000,  pb: 5 },
  "14": { xp: 11500,  pb: 5 },
  "15": { xp: 13000,  pb: 5 },
  "16": { xp: 15000,  pb: 5 },
  "17": { xp: 18000,  pb: 6 },
  "18": { xp: 20000,  pb: 6 },
  "19": { xp: 22000,  pb: 6 },
  "20": { xp: 25000,  pb: 6 },
  "21": { xp: 33000,  pb: 7 },
  "22": { xp: 41000,  pb: 7 },
  "23": { xp: 50000,  pb: 7 },
  "24": { xp: 62000,  pb: 7 },
  "25": { xp: 75000,  pb: 8 },
  "26": { xp: 90000,  pb: 8 },
  "27": { xp: 105000, pb: 8 },
  "28": { xp: 120000, pb: 8 },
  "29": { xp: 135000, pb: 9 },
  "30": { xp: 155000, pb: 9 },
};
export const crStats = (base) => CR_STATS[String(base)] || null;

// ─── Derived ability math (frontend auto-fill) ─────────────────────
export const abilityMod = (score) => {
  const n = Number(score);
  return Number.isFinite(n) ? Math.floor((n - 10) / 2) : 0;
};
export const signed = (n) => {
  const v = Number(n) || 0;
  return `${v >= 0 ? "+" : ""}${v}`;
};

// Expands {abil:{score,proficient}} → full ability_scores block.
// expertise is always false; save = mod + (proficient ? pb : 0).
export const buildAbilityScores = (input, pb) => {
  const out = {};
  const p = Number(pb) || 0;
  for (const a of ABILITY_ORDER) {
    const row = input?.[a] || {};
    const score = Number(row.score);
    const s = Number.isFinite(score) ? score : 10;
    const mod = abilityMod(s);
    const proficient = !!row.proficient;
    out[a] = { score: s, proficient, expertise: false, mod, save: mod + (proficient ? p : 0) };
  }
  return out;
};

// 10 + Perception skill bonus if set, else 10 + WIS mod.
export const computePassivePerception = (abilityScores, skill) => {
  const perc = skill?.perception;
  if (perc != null && perc !== "") {
    const n = Number(String(perc).trim());
    if (Number.isFinite(n)) return 10 + n;
  }
  return 10 + (abilityScores?.wis?.mod ?? 0);
};

// ─── Recursively strip null/undefined/""/[]/{} — keeps 0 and false ─
export const pruneEmpty = (val) => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string") return val.trim() === "" ? undefined : val;
  if (Array.isArray(val)) {
    const arr = val.map(pruneEmpty).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      const pv = pruneEmpty(v);
      if (pv !== undefined) out[k] = pv;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return val; // number | boolean
};