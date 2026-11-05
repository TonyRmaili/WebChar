// ─── Source formatting ─────────────────────────────────────────────
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
};

export const FEATURE_TYPES = [
  "eldritch_invocation",
  "maneuver",
  "artificer_infusion",
  "fighting_style",
  "arcane_shot",
  "elemental_discipline",
  "metamagic",
  "renown_perk",
  "knight_rune",
  "pact_boon",
];

export const RESOURCE_OPTIONS = [
  "Arcane Shot",
  "Superiority Die",
  "Sorcery Point",
  "Ki Point",
];

export const formatSource = (src) => SOURCE_NAMES[src] || src;

// ─── Resource cost ─────────────────────────────────────────────────
// `consumes` comes in two shapes: the cleaned catalogue stores an object
// { name, amount? }, homebrew made in the create form stores a plain
// string ("Sorcery Point"). Both become text like "2 Sorcery Points".
export const formatConsumes = (consumes) => {
  if (!consumes) return "";
  if (typeof consumes === "string") return consumes;
  if (typeof consumes !== "object" || !consumes.name) return "";
  const amount = consumes.amount;
  if (amount == null || amount === "") return consumes.name;
  return `${amount} ${consumes.name}${Number(amount) === 1 ? "" : "s"}`;
};

// ─── Feature type formatting ───────────────────────────────────────
// "eldritch_invocation" → "Eldritch Invocation"
export const formatFeatureType = (s) =>
  String(s || "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

// ─── Generic helpers ───────────────────────────────────────────────
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

const cap = (s) =>
  typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : s;

export const formatSpellName = (s) =>
  String(s || "")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");

// ─── Prerequisite formatting ───────────────────────────────────────
// prereq shape: { level: {value, class?, subclass?}, optionalFeatures, spells, other }
export const formatPrerequisite = (prereq) => {
  if (!prereq || typeof prereq !== "object") return [];
  const parts = [];

  if (prereq.level) {
    const { value, class: cls, subclass } = prereq.level;
    let s = `Level ${value}`;
    if (cls) s += ` ${cls}`;
    if (subclass) s += ` (${subclass})`;
    parts.push(s);
  }

  if (Array.isArray(prereq.optionalFeatures) && prereq.optionalFeatures.length)
    parts.push(prereq.optionalFeatures.join(", "));

  if (Array.isArray(prereq.spells) && prereq.spells.length)
    parts.push(`${prereq.spells.join(", ")} spell`);

  if (Array.isArray(prereq.other) && prereq.other.length)
    parts.push(...prereq.other);

  return parts;
};

// ─── Spellcasting ability ──────────────────────────────────────────
const ABIL_FULL = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

export const formatSpellAbility = (ability) => {
  if (!ability || typeof ability !== "object") return "";
  if (ability.fixed) return `${ABIL_FULL[ability.fixed] || ability.fixed}`;
  if (Array.isArray(ability.choose_from) && ability.choose_from.length)
    return ability.choose_from.map((a) => ABIL_FULL[a] || a).join(" or ");
  return "";
};

// ─── SpellChoice rendering (granted + ritual_choice) ───────────────
// Schema uses Field(alias="from") with populate_by_name — handle either key.
export const formatSpellChoice = (choice) => {
  if (!choice || typeof choice !== "object") return "";
  const fromList = choice.from || choice.from_ || [];
  const count = choice.count;
  const filter = choice.filter;

  if (Array.isArray(fromList) && fromList.length) {
    const names = fromList.map(formatSpellName).join(", ");
    return count && count !== fromList.length
      ? `Choose ${count}: ${names}`
      : names;
  }

  if (filter && typeof filter === "object") {
    const bits = [];
    if (filter.spell_level != null)
      bits.push(filter.spell_level === 0 ? "cantrip" : `level-${filter.spell_level}`);
    if (Array.isArray(filter.school) && filter.school.length)
      bits.push(filter.school.map(cap).join("/"));
    if (Array.isArray(filter.class_list) && filter.class_list.length)
      bits.push(`from the ${filter.class_list.join("/")} list`);
    if (filter.ritual) bits.push("ritual");
    if (filter.spell_attack) bits.push("with a spell attack");

    const desc = bits.length ? bits.join(" ") : "spells";
    return count ? `Choose ${count} ${desc}` : desc;
  }

  return "";
};

// ─── Markdown-lite entries parser ──────────────────────────────────
// Mirrors backgroundHelpers/spellHelpers — ## headings, "- " lists,
// pipe tables, paragraphs, optional "**bold lead**".

const splitRow = (line) => {
  let cells = line.split("|").map((c) => c.trim());
  if (cells.length && cells[0] === "") cells = cells.slice(1);
  if (cells.length && cells[cells.length - 1] === "") cells = cells.slice(0, -1);
  return cells;
};

const isTableSeparator = (line) =>
  /^[\s:|-]+$/.test(line) && line.includes("-");

const splitBoldLead = (text) => {
  const m = text.match(/^\*\*(.+?)\*\*\s*(.*)$/);
  if (m) return { lead: m[1].trim(), text: m[2].trim() };
  return { lead: null, text };
};

const parseListItem = (line) => {
  const body = line.replace(/^-\s+/, "");
  const m = body.match(/^\*\*(.+?)\*\*\s*(.*)$/);
  if (m) return { label: m[1].trim(), text: m[2].trim() };
  return { label: null, text: body.trim() };
};

export const parseEntries = (text) => {
  if (typeof text !== "string" || !text.trim()) return [];
  const chunks = text.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
  const blocks = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);

    // Table
    if (lines.length >= 2 && isTableSeparator(lines[1])) {
      const header = splitRow(lines[0]);
      const rows = lines.slice(2).map(splitRow);
      let caption = null;
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "paragraph" && prev.single) {
        caption = prev.text;
        blocks.pop();
      }
      blocks.push({ type: "table", header, rows, caption });
      continue;
    }

    // Bullet list
    if (lines.every((l) => l.startsWith("- "))) {
      blocks.push({ type: "list", items: lines.map(parseListItem) });
      continue;
    }

    // Heading (+ optional body)
    if (lines[0].startsWith("##")) {
      blocks.push({ type: "heading", text: lines[0].replace(/^#+\s*/, "").trim() });
      const body = lines.slice(1).join(" ").trim();
      if (body) {
        const { lead, text: rest } = splitBoldLead(body);
        blocks.push({ type: "paragraph", lead, text: rest, single: false });
      }
      continue;
    }

    const joined = lines.join(" ");
    const { lead, text: rest } = splitBoldLead(joined);
    blocks.push({
      type: "paragraph",
      lead,
      text: rest,
      single: lines.length === 1,
    });
  }

  return blocks;
};