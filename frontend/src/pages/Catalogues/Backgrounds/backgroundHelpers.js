// ─── Source formatting ─────────────────────────────────────────────
// Minimal map — extend as you confirm book titles. Unknown codes
// fall back to the raw abbreviation.
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
  WBtW: "The Wild Beyond the Witchlight"





};

export const formatSource = (source) => SOURCE_NAMES[source] || source;

// ─── Shared ────────────────────────────────────────────────────────

export const ABILITY = {
  str: "STR", dex: "DEX", con: "CON",
  int: "INT", wis: "WIS", cha: "CHA",
};

export const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

// Collect unique values for a key across backgrounds (flattens arrays).
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

// "magic initiate; wizard" → "Magic Initiate (Wizard)"
const capWords = (s) =>
  String(s)
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

export const formatFeatTag = (raw) => {
  if (typeof raw !== "string") return raw;
  const [base, sub] = raw.split(";").map((s) => s.trim());
  return sub ? `${capWords(base)} (${capWords(sub)})` : capWords(base);
};

// ─── Ability score increase (flat string array) ────────────────────

export const formatAbilityScoreIncrease = (asi) => {
  if (!Array.isArray(asi) || !asi.length) return [];
  return asi.map((a) => ABILITY[a] || String(a).toUpperCase());
};

// Abilities a background offers — for the ability filter.
export const getBackgroundAbilities = (asi) =>
  Array.isArray(asi) ? asi.map((a) => String(a).toLowerCase()) : [];

// ─── cleaned_entries.entries parser ────────────────────────────────
// Markdown-lite: "## heading", "- **label** value" lists, pipe
// tables (2nd line "--- | ---"), and paragraphs. Tags pre-stripped.

const splitRow = (line) => {
  let cells = line.split("|").map((c) => c.trim());
  if (cells.length && cells[0] === "") cells = cells.slice(1);
  if (cells.length && cells[cells.length - 1] === "") cells = cells.slice(0, -1);
  return cells;
};

const isTableSeparator = (line) =>
  /^[\s:|-]+$/.test(line) && line.includes("-");

const parseListItem = (line) => {
  const body = line.replace(/^-\s+/, "");
  const m = body.match(/^\*\*(.+?)\*\*\s*(.*)$/);
  if (m) return { label: m[1].trim(), text: m[2].trim() };
  return { label: null, text: body.trim() };
};

export const parseBackgroundEntries = (text) => {
  if (typeof text !== "string" || !text.trim()) return [];
  const chunks = text.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
  const blocks = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);

    // Table: header line, then a separator line
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

    // Bullet list (every line starts with "- ")
    if (lines.every((l) => l.startsWith("- "))) {
      blocks.push({ type: "list", items: lines.map(parseListItem) });
      continue;
    }

    // Heading, with optional body on following lines
    if (lines[0].startsWith("##")) {
      blocks.push({ type: "heading", text: lines[0].replace(/^#+\s*/, "").trim() });
      const body = lines.slice(1).join(" ").trim();
      if (body) blocks.push({ type: "paragraph", text: body, single: false });
      continue;
    }

    blocks.push({
      type: "paragraph",
      text: lines.join(" "),
      single: lines.length === 1,
    });
  }

  return blocks;
};