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
  ABH: "Astarion's Book of Hungers",
  AI: "Acquisitions Incorporated",
  BGG: "Bigby Presents: Glory of the Giants",
  BMT: "The Book of Many Things",
  DSotDQ: "Dragonlance: Shadow of the Dragon Queen",
  EFA: "Eberron: Forge of the Artificer",
  EGW: "Explorer's Guide to Wildemount",
  FRHoF: "Forgotten Realms: Heroes of Faerun",
  GGR: "Guildmasters Guide to Ravnica",
  GoS: "Ghosts of Saltmarsh",
  LFL: "Lorwyn: First Light",
  MOT: "Mythic Odysseys of Theros",
  PSA: "Plane Shift: Amonkhet",
  PSI: "Plane Shift: Innistrad",
  SatO: "Sigil and the Outlands",
  SCC: "Strixhaven: A Curriculum of Chaos",
  ToA: "Tomb of Annihilation",
  VRGR: "Van Richten's Guide to Ravenloft",
  WBtW: "The Wild Beyond the Witchlight",
  FTD: "Fizban's Treasury of Dragons",
  LLK: "Lost Laboratory of Kwalish",
  "AitFR-AVT": "Adventures in the Forgotten Realms: A Verdant Tomb",
  IDRotF: "Icewind Dale: Rime of the Frostmaiden"

};

export const formatSource = (source) => SOURCE_NAMES[source] || source;

// ─── Shared ────────────────────────────────────────────────────────

export const SCHOOL_NAMES = {
  A: "Abjuration", C: "Conjuration", D: "Divination",
  E: "Enchantment", V: "Evocation", I: "Illusion",
  N: "Necromancy", T: "Transmutation",
};

const cap = (s) =>
  typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : s;

export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

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

// Classes that can cast a spell, looked up by name from the
// class_list dict. Same-named spells from different sources share
// an entry — intended (same class availability).
export const getSpellClasses = (spell, classList) =>
  (classList && classList[spell?.name]) || [];

// ─── Level + school subheader ──────────────────────────────────────
// level 0 → "Evocation cantrip";  level 1 → "1st-level evocation"
export const formatLevelSchool = (level, school) => {
  const schoolName =
    SCHOOL_NAMES[school] || cap(school) || "";
  if (level === 0) return `${schoolName} cantrip`.trim();
  const lvl = `${ordinal(level)}-level`;
  return `${lvl} ${schoolName.toLowerCase()}`.trim();
};

export const LEVEL_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const formatLevelChip = (lvl) => (lvl === 0 ? "Cantrip" : String(lvl));

// ─── Casting time ──────────────────────────────────────────────────
export const formatTime = (time) => {
  if (!Array.isArray(time) || !time.length) return "";
  return time
    .map((t) => {
      const n = t.number != null ? t.number : "";
      const unit = t.unit || "";
      const base = `${n} ${unit}${t.number > 1 ? "s" : ""}`.trim();
      return t.condition ? `${base} (${t.condition})` : base;
    })
    .join(", ");
};

// ─── Range ─────────────────────────────────────────────────────────
const SHAPED = ["cone", "line", "cube", "radius", "sphere", "hemisphere"];

export const formatRange = (range) => {
  if (!range || typeof range !== "object") return "";
  const { type, distance } = range;

  if (type === "special") return "Special";

  if (SHAPED.includes(type)) {
    const amt = distance?.amount;
    const unit = distance?.type === "miles" ? "mile" : "foot";
    return amt != null
      ? `Self (${amt}-${unit} ${type})`
      : `Self (${type})`;
  }

  // point / self / touch etc. — described by the distance object
  if (!distance) return cap(type) || "";
  switch (distance.type) {
    case "self": return "Self";
    case "touch": return "Touch";
    case "sight": return "Sight";
    case "unlimited": return "Unlimited";
    case "feet":
    case "miles": {
      const u = distance.type === "miles"
        ? (distance.amount === 1 ? "mile" : "miles")
        : "feet";
      return `${distance.amount} ${u}`;
    }
    default:
      return cap(distance.type) || cap(type) || "";
  }
};

// ─── Components ────────────────────────────────────────────────────
export const formatComponents = (c) => {
  if (!c || typeof c !== "object") return "";
  const parts = [];
  if (c.v) parts.push("V");
  if (c.s) parts.push("S");
  if (c.m) {
    if (typeof c.m === "string") parts.push(`M (${c.m})`);
    else if (c.m && typeof c.m === "object" && c.m.text)
      parts.push(`M (${c.m.text})`);
    else parts.push("M");
  }
  return parts.join(", ");
};

// ─── Duration ──────────────────────────────────────────────────────
export const formatDuration = (duration) => {
  if (!Array.isArray(duration) || !duration.length) return "";
  return duration
    .map((d) => {
      if (d.type === "instant") return "Instantaneous";
      if (d.type === "permanent") {
        const ends = (d.ends || []).join(" or ");
        return ends ? `Until ${ends}` : "Permanent";
      }
      if (d.type === "special") return "Special";
      if (d.type === "timed" && d.duration) {
        const amt = d.duration.amount;
        const unit = d.duration.type;
        const plural = amt > 1 ? `${unit}s` : unit;
        const body = `${amt} ${plural}`;
        return d.concentration
          ? `Concentration, up to ${body}`
          : `up to ${body}`;
      }
      return cap(d.type) || "";
    })
    .join(", ");
};

// ─── cleaned_data.entries parser ───────────────────────────────────
// Markdown-lite: "## heading", "- " lists, pipe tables (2nd line
// "--- | ---"), and paragraphs. Leading "**Bold.**" on a paragraph
// is split into a bold lead-in. Tags pre-stripped.

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

export const parseSpellEntries = (text) => {
  if (typeof text !== "string" || !text.trim()) return [];
  const chunks = text.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
  const blocks = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);

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

    if (lines.every((l) => l.startsWith("- "))) {
      blocks.push({
        type: "list",
        items: lines.map((l) => splitBoldLead(l.replace(/^-\s+/, ""))),
      });
      continue;
    }

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


// ─── Damage types ──────────────────────────────────────────────────
// Assumes spell.damage_inflict is a string array. Defensive against alts.
export const getSpellDamageTypes = (spell) => {
  const v = spell?.damage_inflict ?? spell?.damage_types ?? spell?.damageInflict;
  return Array.isArray(v) ? v : [];
};

// ─── Ritual ────────────────────────────────────────────────────────
export const isSpellRitual = (spell) =>
  Boolean(spell?.meta?.ritual ?? spell?.ritual);

// ─── Concentration ─────────────────────────────────────────────────
export const isSpellConcentration = (spell) => {
  const dur = spell?.duration;
  if (!Array.isArray(dur)) return false;
  return dur.some((d) => d?.concentration === true);
};

// ─── Action type ───────────────────────────────────────────────────
// Returns one of: "action" | "bonus" | "reaction" | "other"
export const getSpellActionType = (spell) => {
  const t = spell?.time?.[0];
  if (!t || !t.unit) return "other";
  const u = String(t.unit).toLowerCase();
  if (u === "action") return "action";
  if (u === "bonus") return "bonus";
  if (u === "reaction") return "reaction";
  return "other";
};

export const ACTION_TYPES = [
  { value: "action",   label: "Action" },
  { value: "bonus",    label: "Bonus Action" },
  { value: "reaction", label: "Reaction" },
  { value: "other",    label: "Other" },
];

// ─── Components ────────────────────────────────────────────────────
// Each value is a predicate against spell.components.
// "M w/ cost" assumes m is an object carrying a `cost` (in cp) or `consume`.
const hasMaterialWithCost = (m) => {
  if (!m || typeof m !== "object") return false;
  return Boolean(m.cost) || m.consume === true;
};

export const COMPONENT_OPTIONS = [
  { value: "v", label: "V",       test: (c) => Boolean(c?.v) },
  { value: "s", label: "S",       test: (c) => Boolean(c?.s) },
  { value: "m", label: "M",       test: (c) => Boolean(c?.m) },
  { value: "mc", label: "M w/ cost", test: (c) => hasMaterialWithCost(c?.m) },
];