// ─── Source / category formatting ──────────────────────────────────

export const SOURCE_NAMES = {
  EFA: "Eberron: Forge of the Artificer",
  ERLW: "Eberron: Rising from the Last War",
  XPHB: "Player Handbook One",
  PHB: "Player Handbook Classic",
  DSotDQ: "Dragonlance: Shadow of the Dragon Queen",
  SatO: "Sigil and the Outlands",
  TCE: "Tasha's Cauldron of Everything",
  ABH: "Astarion's Book of Hungers",
  FRHoF: "Forgotten Realms: Heroes of Faerun",
  XGE: "Xanathars's Guide to Everything",
  BMT: "The Book of Many Things",
  LFL: "Lorwyn: First Light",
  BGG: "Bigby Presents: Glory of the Giants",
  FTD: "Fizban's Treasury of Dragons",
  PSK: "Plane Shift: Kaladesh",
  SCC: "Strixhaven: A Curriculum of Chaos",
  MTF: "Mordenkainen's Tome of Foes",
  PSX: "Plane Shift: Ixalan",
};

export const formatSource = (source) => SOURCE_NAMES[source] || source;

export const formatCategory = (category) => {
  if (typeof category !== "string" || !category) return category;
  return category
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
};

// ─── Shared ────────────────────────────────────────────────────────

export const ABILITY = {
  str: "STR", dex: "DEX", con: "CON",
  int: "INT", wis: "WIS", cha: "CHA",
};

export const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

// Set of abilities a feat *could* grant.
// Fixed { str: 1 } → ["str"];  { choose: { from: [...] } } → the from list.
// A choose-from feat therefore matches a filter for any ability it offers.
export const getFeatAbilities = (asi) => {
  if (!Array.isArray(asi) || !asi.length) return [];
  const set = new Set();
  for (const entry of asi) {
    if (entry.choose) {
      for (const k of entry.choose.from || []) set.add(k);
    } else {
      for (const k of Object.keys(entry)) set.add(k);
    }
  }
  return [...set];
};

// ─── Prerequisite formatting ───────────────────────────────────────
// prerequisite is an array of ALTERNATIVES (OR between entries).
// Within one entry, multiple keys are ANDed (e.g. campaign + level).

const formatPrereqClause = (p) => {
  const parts = [];

  if (p.level != null) {
    if (typeof p.level === "object") {
      const cls = p.level.class?.name;
      parts.push(cls ? `${cls} level ${p.level.level}` : `Level ${p.level.level}`);
    } else {
      parts.push(`Level ${p.level}`);
    }
  }
  if (Array.isArray(p.race)) {
    parts.push(p.race.map((r) => r?.name || r).join(" or "));
  }
  if (Array.isArray(p.background)) {
    parts.push(p.background.map((b) => `${b.name} background`).join(" or "));
  }
  if (Array.isArray(p.ability)) {
    const a = p.ability.flatMap((o) =>
      Object.entries(o).map(([k, v]) => `${ABILITY[k] || k.toUpperCase()} ${v}+`)
    );
    if (a.length) parts.push(a.join(", "));
  }
  if (Array.isArray(p.feat)) {
    parts.push(p.feat.map((f) => (typeof f === "string" ? f : f.name)).join(" or "));
  }
  if (p.spellcasting || p.spellcasting2020 || p.spellcastingFeature) {
    parts.push("Spellcasting feature");
  }
  if (Array.isArray(p.proficiency)) {
    const pr = p.proficiency.flatMap((o) =>
      Object.entries(o).map(([k, v]) => `${v} ${k}`)
    );
    if (pr.length) parts.push(`${pr.join(", ")} proficiency`);
  }
  if (Array.isArray(p.campaign)) {
    parts.push(`${p.campaign.join("/")} campaign`);
  }
  if (typeof p.other === "string") parts.push(p.other);
  // exclusiveFeatCategory is an internal marker — intentionally not shown.

  return parts.join(", ");
};

export const formatPrerequisite = (prereq) => {
  if (!Array.isArray(prereq)) return [];
  return prereq.map(formatPrereqClause).filter(Boolean);
};

// ─── Ability score increase ────────────────────────────────────────

export const formatAbilityScoreIncrease = (asi) => {
  if (!Array.isArray(asi) || !asi.length) return [];
  const out = [];
  for (const entry of asi) {
    if (entry.choose) {
      const from = (entry.choose.from || []).map((k) => ABILITY[k] || k.toUpperCase());
      const count = entry.choose.count || 1;
      const amount = entry.choose.amount || 1;
      out.push(`Choose ${count} of ${from.length ? from.join(" / ") : "any"} (+${amount})`);
    } else {
      for (const [k, v] of Object.entries(entry)) {
        out.push(`${ABILITY[k] || k.toUpperCase()} +${v}`);
      }
    }
  }
  return out;
};

// ─── cleaned_data.entries parser ───────────────────────────────────
// Markdown-lite: "## heading", paragraphs, and pipe tables whose
// 2nd line is a "--- | ---" separator. Tags are already stripped.

const splitRow = (line) => {
  let cells = line.split("|").map((c) => c.trim());
  if (cells.length && cells[0] === "") cells = cells.slice(1);
  if (cells.length && cells[cells.length - 1] === "") cells = cells.slice(0, -1);
  return cells;
};

const isTableSeparator = (line) =>
  /^[\s:|-]+$/.test(line) && line.includes("-");

export const parseFeatEntries = (text) => {
  if (typeof text !== "string" || !text.trim()) return [];
  const chunks = text.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
  const blocks = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);

    // Table: header line, then a separator line
    if (lines.length >= 2 && isTableSeparator(lines[1])) {
      const header = splitRow(lines[0]);
      const rows = lines.slice(2).map(splitRow);
      // Lift an immediately preceding one-line paragraph as the caption
      let caption = null;
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "paragraph" && prev.single) {
        caption = prev.text;
        blocks.pop();
      }
      blocks.push({ type: "table", header, rows, caption });
      continue;
    }

    // Heading line, with optional body on following lines
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

// ─── additional_spells helpers ─────────────────────────────────────

export const formatSpellAbility = (sa) => {
  if (!sa) return null;
  if (sa.fixed) return ABILITY[sa.fixed] || String(sa.fixed).toUpperCase();
  if (Array.isArray(sa.choose_from) && sa.choose_from.length)
    return sa.choose_from.map((a) => ABILITY[a] || a.toUpperCase()).join(" / ");
  return null;
};

export const formatSpellEntry = (s) => {
  let label;
  if (s.name) {
    label = s.name;
  } else if (s.choice) {
    const c = s.choice;
    if (Array.isArray(c.from) && c.from.length) {
      label = `Choose ${c.count || 1} of: ${c.from.join(", ")}`;
    } else if (c.filter) {
      const f = c.filter;
      const lvl = f.spell_level === 0 ? "cantrip" : `level ${f.spell_level} spell`;
      const cls = (f.class_list || []).join("/");
      label = `Choose ${c.count || 1} ${cls ? cls + " " : ""}${lvl}`;
    } else {
      label = `Choose ${c.count || 1}`;
    }
  } else {
    label = "—";
  }

  const meta = [];
  if (s.free_cast) {
    const r =
      { long_rest: "long rest", short_rest: "short rest" }[s.free_cast.recharge] ||
      s.free_cast.recharge;
    meta.push(`${s.free_cast.amount}/${r} free`);
  }
  if (s.level_requirement) meta.push(`req. lvl ${s.level_requirement}`);

  return { label, meta: meta.join(" · ") };
};