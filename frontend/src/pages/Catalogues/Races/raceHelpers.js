// ─── Sources ───────────────────────────────────────────────────────
export const SOURCE_NAMES = {
  XPHB: "Player Handbook One",
  PHB: "Player Handbook Classic",
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
  MPMM: "Mordenkainen Presents: Monsters of the Multiverse",
  MTF: "Mordenkainen's Tome of Foes",
  VGM: "Volo's Guide to Monsters",
  HOMEBREW: "Homebrew",
};
export const formatSource = (src) => SOURCE_NAMES[src] || src;

// ─── Shared ────────────────────────────────────────────────────────
export const ABILITY_LABELS = {
  str: "STR", dex: "DEX", con: "CON",
  int: "INT", wis: "WIS", cha: "CHA",
};

export const SIZE_LABELS = {
  tiny: "Tiny", small: "Small", medium: "Medium", large: "Large",
};

export const SIZE_ORDER = ["tiny", "small", "medium", "large"];

// Collect unique top-level values (flattens arrays).
export const collectUnique = (items, key) => {
  const set = new Set();
  for (const it of items || []) {
    const v = it?.[key];
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => x && set.add(x));
    else set.add(v);
  }
  return [...set].sort((a, b) => String(a).localeCompare(String(b)));
};

// "Walk 30 ft, Fly 60 ft (hover)" — nulls skipped
export const formatSpeed = (speed) => {
  if (!speed) return "";
  const parts = [];
  const modes = ["walk", "fly", "swim", "climb", "burrow"];
  for (const m of modes) {
    const v = speed[m];
    if (v == null) continue;
    let s = `${cap(m)} ${v} ft`;
    if (m === "fly" && speed.hover) s += " (hover)";
    parts.push(s);
  }
  return parts.join(", ");
};

// "Darkvision 60 ft, Tremorsense 30 ft"
export const formatSenses = (senses) => {
  if (!senses) return "";
  const parts = [];
  for (const k of ["darkvision", "tremorsense", "blindsight", "truesight"]) {
    if (senses[k] != null) parts.push(`${cap(k)} ${senses[k]} ft`);
  }
  return parts.join(", ");
};

// Short header: "Humanoid • Medium" / "Humanoid • Small or Medium"
export const formatTypeAndSize = (race) => {
  const t = race?.creature_type ? cap(race.creature_type) : "";
  const sizes = (race?.sizes || []).map((s) => SIZE_LABELS[s] || cap(s));
  const sizeStr = sizes.length === 0 ? "" : sizes.join(" or ");
  return [t, sizeStr].filter(Boolean).join(" • ");
};

export const cap = (s) =>
  s ? String(s)[0].toUpperCase() + String(s).slice(1) : s;

// Pretty-print a ChooseBlock, e.g. "Choose 1 of STR/DEX/CON, +2 each"
export const formatChoose = (choose, { abilityMode = false } = {}) => {
  if (!choose) return "";
  const opts = Array.isArray(choose.options) ? choose.options : [choose.options];
  const cleaned = opts
    .filter(Boolean)
    .map((o) => (abilityMode ? (ABILITY_LABELS[o] || o.toUpperCase()) : o));
  const body = cleaned.length ? cleaned.join(" / ") : "any";
  const amt = choose.amount != null ? `, +${choose.amount} each` : "";
  return `Choose ${choose.count} of ${body}${amt}`;
};