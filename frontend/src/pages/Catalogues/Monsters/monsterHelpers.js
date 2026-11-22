import {
  ABILITIES, ABILITY_NAMES, ABILITY_SHORT, CATEGORY_LABELS,
  cap, titleCase, labelFromId, plural, formatValue, formatSize, nameFromId, pruneEmpty, valueFromText, textFromValue,
} from "../catalogueHelpers";
import { headerToForm, formToHeader } from "../catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   monsterHelpers — the Monsters catalogue: statblock wording, the
   values its filters offer, and the record ↔ form conversion.

   A monster record (data-model §4h) is a whole statblock: size, type,
   AC, HP, speed, abilities, saves, skills, senses, defenses, languages,
   CR, `features` (traits, actions, … each with its numbers in
   `action`), `spellcasting` blocks, gear (`items`) and `variants`.
   It has no `text` of its own: every feature carries its own.
   ═══════════════════════════════════════════════════════════════════ */

// ─── Challenge ─────────────────────────────────────────────────────

export const CR_OPTIONS = [
  "0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
];

// XP and proficiency bonus by CR (the DMG table), for a new statblock.
const CR_XP = [10, 25, 50, 100, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500,
  13000, 15000, 18000, 20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000, 105000, 120000, 135000, 155000];
export const crStats = (cr) => {
  const i = CR_OPTIONS.indexOf(String(cr));
  if (i < 0) return null;
  const n = crNumber(cr);
  return { xp: CR_XP[i], pb: n < 1 ? 2 : Math.floor((n - 1) / 4) + 2 }; // CR 1–4 +2, 5–8 +3 … 29–30 +9
};

const FRACTIONS = { "1/8": 0.125, "1/4": 0.25, "1/2": 0.5 };
export const crNumber = (cr) => {
  if (cr == null || cr === "unknown") return null;
  if (cr in FRACTIONS) return FRACTIONS[cr];
  const n = Number(cr);
  return Number.isFinite(n) ? n : null;
};

// A number to sort and range-filter by: the CR, or the level of a
// level-based statblock (sidekicks, Dragonlance NPCs).
export const monsterDifficulty = (m) => crNumber(m?.cr?.cr) ?? (m?.level != null ? Number(m.level) : null);

// "CR 17" · "CR 1/4" · "Level 4" · ""
export const formatCR = (m) =>
  m?.cr?.cr && m.cr.cr !== "unknown" ? `CR ${m.cr.cr}` : m?.level != null ? `Level ${m.level}` : "";

const thousands = (n) => new Intl.NumberFormat("en-US").format(n);

// "17 (XP 18,000, or 20,000 in lair; PB +6)"
export const formatChallenge = (m) => {
  const c = m?.cr;
  if (!c?.cr) return "";
  if (c.cr === "unknown") return "Unknown";
  const xp = [];
  if (c.xp != null) xp.push(`XP ${thousands(c.xp)}`);
  if (c.xp_lair != null) xp.push(`or ${thousands(c.xp_lair)} in lair${c.lair && c.lair !== c.cr ? ` (CR ${c.lair})` : ""}`);
  if (c.xp_coven != null) xp.push(`or ${thousands(c.xp_coven)} in a coven${c.coven ? ` (CR ${c.coven})` : ""}`);
  const pb = c.pb != null ? `PB +${c.pb}` : m.pb_note ? `PB ${m.pb_note}` : "";
  const bits = [xp.join(", "), pb].filter(Boolean).join("; ");
  return bits ? `${c.cr} (${bits})` : c.cr;
};

// ─── Type line ─────────────────────────────────────────────────────

export const monsterTypes = (m) => {
  const t = m?.creature_type?.type;
  return Array.isArray(t) ? t : t ? [t] : [];
};

// "Huge Dragon (Chromatic), Chaotic Evil" · "Medium Swarm of Tiny Beasts, Unaligned"
export const monsterSubtitle = (m) => {
  const ct = m?.creature_type || {};
  const types = monsterTypes(m).map(titleCase).join(" or ");
  const what = ct.swarm_of ? `Swarm of ${titleCase(ct.swarm_of)} ${types}s` : types;
  const tags = ct.tags?.length ? ` (${ct.tags.map(titleCase).join(", ")})` : "";
  const note = ct.note ? ` ${ct.note}` : "";
  const align = (m?.alignment || []).map(titleCase).join(" or ");
  const head = `${[formatSize(m?.size), what].filter(Boolean).join(" ")}${tags}${note}`;
  return [head, [m?.alignment_prefix, align].filter(Boolean).join(" ")].filter(Boolean).join(", ");
};

// The short note on a list row: "CR 17 · Dragon".
export const monsterRowMeta = (m) => [formatCR(m), monsterTypes(m).map(titleCase).join("/")].filter(Boolean).join(" · ");

// ─── Statblock lines ───────────────────────────────────────────────

export const abilityMod = (score) => (Number.isFinite(Number(score)) && score !== null ? Math.floor((Number(score) - 10) / 2) : null);
export const signed = (v) => (typeof v === "number" ? `${v >= 0 ? "+" : ""}${v}` : formatValue(v));

// "19 (natural armor)", "10 in humanoid form, 11 (natural armor) in boar or hybrid form"
export const formatAC = (ac) =>
  (ac || [])
    .map((a) => {
      if (a.special && a.value == null) return a.special;
      let s = String(a.value ?? "");
      if (a.from?.length) s += ` (${a.from.join(", ")})`;
      if (a.condition) s += ` ${a.condition}`;
      if (a.special) s += ` (${a.special})`;
      return s;
    })
    .join(", ");

// "256 (19d12 + 133)"
export const formatHP = (hp) => {
  if (!hp) return "";
  if (hp.special && hp.average == null) return hp.special;
  const s = hp.formula ? `${hp.average} (${hp.formula})` : String(hp.average ?? "");
  return hp.temporary ? `${s} temporary` : s;
};

const SPEED_ORDER = ["walk", "burrow", "climb", "fly", "swim"];
export const SPEED_MODES = SPEED_ORDER;

// "40 ft., Climb 40 ft., Fly 80 ft. (hover)"
export const formatSpeed = (speed) => {
  if (!speed) return "";
  const notes = speed.notes || {};
  return SPEED_ORDER.filter((k) => speed[k] != null)
    .map((k) => {
      let s = k === "walk" ? `${speed[k]} ft.` : `${cap(k)} ${speed[k]} ft.`;
      if (k === "fly" && speed.hover) s += " (hover)";
      if (notes[k]) s += ` (${notes[k]})`;
      return s;
    })
    .join(", ");
};

export const formatInitiative = (init, m) => {
  if (!init) return "";
  const dex = abilityMod(m?.abilities?.dex);
  const score = typeof init.bonus === "number" ? ` (${10 + init.bonus})` : "";
  const shown = init.bonus ?? dex;
  if (shown == null) return "";
  return `${signed(shown)}${score}${init.advantage ? ", with advantage" : ""}`;
};

// "Perception +13, Stealth +6"
export const formatSkills = (skills) =>
  Object.entries(skills || {}).map(([k, v]) => `${labelFromId(k)} ${signed(v)}`).join(", ");

// "Dex +6, Wis +7"
export const formatSaves = (saves) =>
  ABILITIES.filter((a) => saves?.[a] != null).map((a) => `${ABILITY_SHORT[a]} ${signed(saves[a])}`).join(", ");

// "Darkvision 120 ft., Blindsight 60 ft.; Passive Perception 23"
export const formatSenses = (m) => {
  const s = m?.senses || {};
  const list = ["blindsight", "darkvision", "tremorsense", "truesight"].filter((k) => s[k] != null).map((k) => `${cap(k)} ${s[k]} ft.`);
  if (s.notes) list.push(s.notes);
  const passive = m?.passive_perception != null ? `Passive Perception ${m.passive_perception}` : "";
  return [list.join(", "), passive].filter(Boolean).join("; ");
};

// A defense block → "Fire, Cold; Bludgeoning, Piercing, Slashing from nonmagical attacks"
export const formatDefense = (block) => {
  if (!block) return "";
  const parts = [];
  if (block.types?.length) parts.push(block.types.map(cap).join(", "));
  for (const c of block.conditional || []) {
    const types = (c.types || []).map(cap).join(", ");
    if (!c.note) parts.push(types);
    else parts.push(/:\s*$/.test(c.note) ? `${c.note} ${types}` : `${types} ${c.note}`);
  }
  if (block.special) parts.push(block.special);
  return parts.filter(Boolean).join("; ");
};

const SUMMON_WORDS = (s, index) =>
  s.spell ? `${nameFromId(s.spell, index)}${s.spell_level ? ` (level ${s.spell_level})` : ""}` : s.class ? `the ${nameFromId(s.class, index)}` : "";

// The rows under the ability table, in the 2024 order.
export const statRows = (m, index) => {
  const rows = [];
  const add = (label, value) => value && rows.push({ label, value });
  const d = m.defenses || {};
  add("Skills", formatSkills(m.skills) + (m.skills_note ? ` (${m.skills_note})` : ""));
  add("Vulnerabilities", formatDefense(d.vulnerable));
  add("Resistances", formatDefense(d.resist));
  add("Immunities", [formatDefense(d.immune), formatDefense(d.condition_immune)].filter(Boolean).join("; "));
  add("Senses", formatSenses(m));
  add("Languages", (m.languages || []).join(", ") || (m.kind === "monster" ? "None" : ""));
  add("CR", formatChallenge(m));
  if (m.level != null) add("Level", `${m.level}${m.pb_note ? ` (PB ${m.pb_note})` : ""}`);
  add("Gear", (m.items || []).map((it) => `${it.qty > 1 ? `${it.qty} ` : ""}${nameFromId(it.item, index)}`).join(", "));
  if (m.summoned_by) add("Summoned by", SUMMON_WORDS(m.summoned_by, index));
  return rows;
};

// ─── Features ──────────────────────────────────────────────────────

export const SECTIONS = [
  "traits", "actions", "bonus_actions", "reactions", "legendary_actions", "mythic_actions", "lair_actions", "regional_effects",
];
export const SECTION_TITLES = {
  traits: "Traits", actions: "Actions", bonus_actions: "Bonus Actions", reactions: "Reactions",
  legendary_actions: "Legendary Actions", mythic_actions: "Mythic Actions", lair_actions: "Lair Actions",
  regional_effects: "Regional Effects",
};
export const CATEGORY_OPTIONS = SECTIONS.map((value) => ({ value, label: CATEGORY_LABELS[value] || titleCase(value) }));

// "(Recharge 5–6)" · "(3/Day, or 4/Day in Lair)" · "(Costs 2 Actions)"
export const featureUsesWords = (f) => {
  const bits = [];
  const u = f.uses;
  if (u?.reset === "recharge") bits.push(u.recharge && u.recharge < 6 ? `Recharge ${u.recharge}–6` : `Recharge ${u.recharge ?? 6}`);
  else if (u) {
    const per = { long: "Day", short: "Short Rest", turn: "Turn" }[u.reset] || titleCase(u.reset || "");
    bits.push(`${formatValue(u.max)}/${per}${u.max_in_lair != null ? `, or ${formatValue(u.max_in_lair)}/${per} in Lair` : ""}`);
  }
  if (f.cost > 1) bits.push(`Costs ${f.cost} Actions`);
  return bits.length ? `(${bits.join("; ")})` : "";
};

// What 5etools calls each spell group, for a block's `hidden` list.
const groupKind = (g) =>
  g.how === "at_will" ? "will"
  : g.how === "legendary" ? "legendary"
  : g.how === "recharge" ? "recharge"
  : g.per === "day" ? "daily"
  : g.per === "long" ? "restLong"
  : g.per === "short" ? "rest"
  : g.slots != null || g.level != null ? "spells"
  : g.how || "";

const PER_WORDS = { day: "Day", long: "Long Rest", short: "Short Rest", year: "Year" };

// "At will" · "2/Day each" · "Level 1 (4 slots)" · "Levels 1–3 (2 level 3 slots)" · "Cantrips"
export const spellGroupLabel = (g) => {
  if (g.how === "at_will") return g.level === 0 ? "Cantrips (at will)" : "At will";
  if (g.how === "legendary") return `Legendary action${g.uses ? ` (${g.uses})` : ""}`;
  if (g.how === "recharge") return `Recharge${g.uses ? ` ${g.uses}` : ""}`;
  if (g.how === "charges") return g.uses ? plural(g.uses, "charge") : "Charges";
  if (g.how === "ritual") return "Rituals";
  if (g.uses != null) return `${g.uses}/${PER_WORDS[g.per] || titleCase(g.per || "day")}${g.each ? " each" : ""}`;
  if (g.level === 0) return "Cantrips";
  if (g.level != null) {
    const range = g.lower && g.lower !== g.level;
    const slots = g.slots != null ? ` (${plural(g.slots, range ? `level ${g.level} slot` : "slot")})` : "";
    return range ? `Levels ${g.lower}–${g.level}${slots}` : `Level ${g.level}${slots}`;
  }
  return titleCase(g.how || "");
};

// The groups a card lists: the ones the book doesn't already spell out in the text.
export const shownSpellGroups = (block) => (block.groups || []).filter((g) => !(block.hidden || []).includes(groupKind(g)));

export const spellEntryWords = (s, index) =>
  s.spell ? `${nameFromId(s.spell, index)}${s.note ? ` ${s.note}` : ""}` : s.text || "";

/* The statblock's sections in order: { key, title, features, spellcasting }.
   Toggle-variant features are left out (they're in their variant's text),
   and so are options with a `parent` (the parent's text has them). */
export const monsterSections = (m) => {
  const out = [];
  for (const key of SECTIONS) {
    const features = (m.features || []).filter((f) => (f.category || "traits") === key && !f.variant && !f.parent);
    const spellcasting = (m.spellcasting || []).filter((b) => (b.display_as || "traits") === key);
    if (features.length || spellcasting.length) out.push({ key, title: SECTION_TITLES[key], features, spellcasting });
  }
  return out;
};

// "Legendary Action Uses: 3 (4 in Lair)."
export const legendaryUsesWords = (m) => {
  const l = m.legendary_actions;
  if (!l?.uses) return "";
  return `Legendary Action Uses: ${l.uses}${l.uses_in_lair ? ` (${l.uses_in_lair} in Lair)` : ""}.`;
};

// ─── Filters ───────────────────────────────────────────────────────
// Every filter value is read from the statblock itself as well as from
// 5etools' tag lists (`filters`), so a homebrew monster that has no tag
// lists is still found.

const union = (...lists) => [...new Set(lists.flat().filter(Boolean))];

const allDamage = (m) =>
  (m.features || []).flatMap((f) => {
    const a = f.action || {};
    return [...(a.attack?.damage || []), ...(a.save?.damage || []), ...(a.damage || [])];
  });

export const monsterDamageDealt = (m) =>
  union(m.filters?.damage_dealt, allDamage(m).map((d) => d.type).filter((t) => t && t !== "weapon" && t !== "chosen"));

export const monsterConditions = (m) =>
  union(m.filters?.conditions_inflicted, (m.features || []).flatMap((f) => f.action?.save?.conditions || []));

export const monsterSavesForced = (m) =>
  union(m.filters?.saves_forced, (m.features || []).map((f) => f.action?.save?.ability));

export const monsterSenses = (m) =>
  union(m.filters?.senses, Object.keys(m.senses || {}).filter((k) => k !== "notes"));

export const monsterMovement = (m) =>
  union(m.filters?.movement, ["fly", "swim", "climb", "burrow"].filter((k) => m.speed?.[k]), m.speed?.hover ? ["hover"] : []);

export const monsterDefenses = (m, kind) => {
  const b = m.defenses?.[kind];
  return union(b?.types, (b?.conditional || []).flatMap((c) => c.types || []));
};

export const HAS_LABELS = {
  legendary: "Legendary actions", lair: "Lair actions", mythic: "Mythic actions", spellcasting: "Spellcasting",
  reactions: "Reactions", variants: "Variants", version: "A version of another", summon: "A summon",
  npc: "NPC", named: "Named", familiar: "Familiar", swarm: "Swarm",
};

export const monsterHas = (m) => {
  const cats = new Set((m.features || []).map((f) => f.category));
  const out = [];
  if (m.legendary_actions || cats.has("legendary_actions")) out.push("legendary");
  if (cats.has("lair_actions") || m.cr?.xp_lair != null) out.push("lair");
  if (cats.has("mythic_actions") || m.mythic_encounter) out.push("mythic");
  if (m.spellcasting?.length) out.push("spellcasting");
  if (cats.has("reactions")) out.push("reactions");
  if (m.variants?.length) out.push("variants");
  if (m.version_of) out.push("version");
  if (m.summoned_by) out.push("summon");
  if (m.flags?.npc) out.push("npc");
  if (m.flags?.named) out.push("named");
  if (m.flags?.familiar) out.push("familiar");
  if (m.creature_type?.swarm_of) out.push("swarm");
  return out;
};

// ─── Form ──────────────────────────────────────────────────────────
// The form keeps the editable parts flat; anything it has no field for
// is carried through in `rest` (or a part's own *Rest), so a copy or an
// edit never loses data. Features, spellcasting blocks and gear are
// edited in their record shape.

const HANDLED = new Set([
  "id", "kind", "name", "source", "edition", "visibility", "text", "aliases", "tags", "created_by",
  "size", "creature_type", "alignment", "alignment_prefix", "ac", "hp", "speed", "abilities", "saves", "skills",
  "senses", "passive_perception", "defenses", "languages", "cr", "level", "initiative", "legendary_actions",
  "features", "spellcasting", "items", "flags", "filters",
]);

export const DEFENSE_KINDS = ["resist", "immune", "vulnerable", "condition_immune"];
export const DEFENSE_LABELS = { resist: "Resistances", immune: "Damage immunities", vulnerable: "Vulnerabilities", condition_immune: "Condition immunities" };

const omit = (obj, keys) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys.includes(k)));

const blankAbilities = () => Object.fromEntries(ABILITIES.map((a) => [a, 10]));

export const emptyMonsterForm = () => ({
  name: "", edition: "one", visibility: "private", text: "",
  size: ["medium"],
  types: ["humanoid"], typeTags: "", swarmOf: "", typeRest: {},
  alignment: "", alignmentPrefix: "",
  ac: [{ value: 10, from: "", condition: "", special: "" }],
  hp: { average: null, formula: "", special: "" }, hpRest: {},
  speed: { walk: 30 }, hover: false, speedNotes: {},
  abilities: blankAbilities(),
  saves: {},
  skills: [],
  senses: {}, sensesNotes: "", passive: null,
  defenses: Object.fromEntries(DEFENSE_KINDS.map((k) => [k, []])), defensesRest: {},
  languages: "",
  challenge: "cr", cr: "1", xp: 200, pb: 2, crRest: {}, level: null,
  initiative: null, initAdvantage: false,
  legendaryUses: null, legendaryLair: null,
  features: [],
  spellcasting: [],
  items: [],
  flags: { npc: false, named: false, familiar: false }, flagsRest: {},
  environment: [], filtersRest: {},
  rest: {},
});

export function monsterToForm(m, { copy = false } = {}) {
  const ct = m.creature_type || {};
  const defenses = m.defenses || {};
  return {
    ...headerToForm(m, { copy }),
    size: m.size || [],
    types: monsterTypes(m),
    typeTags: (ct.tags || []).join(", "),
    swarmOf: ct.swarm_of || "",
    typeRest: omit(ct, ["type", "tags", "swarm_of"]),
    typeIsList: Array.isArray(ct.type),
    alignment: (m.alignment || []).join(", "),
    alignmentPrefix: m.alignment_prefix || "",
    // `fromList` keeps the book's list, since one item can hold a comma ("breastplate, shield").
    ac: (m.ac || []).map((a) => ({
      value: a.value ?? null, from: (a.from || []).join(", "), fromList: a.from || [], condition: a.condition || "", special: a.special || "",
    })),
    hp: { average: m.hp?.average ?? null, formula: m.hp?.formula || "", special: m.hp?.special || "" },
    hpRest: omit(m.hp, ["average", "formula", "special"]),
    speed: omit(m.speed, ["hover", "notes"]),
    hover: !!m.speed?.hover,
    speedNotes: m.speed?.notes || {},
    abilities: m.abilities ? { ...m.abilities } : {},
    saves: Object.fromEntries(Object.entries(m.saves || {}).map(([k, v]) => [k, textFromValue(v)])),
    skills: Object.entries(m.skills || {}).map(([skill, v]) => ({ skill, value: textFromValue(v) })),
    senses: omit(m.senses, ["notes"]),
    sensesNotes: m.senses?.notes || "",
    passive: m.passive_perception ?? null,
    defenses: Object.fromEntries(DEFENSE_KINDS.map((k) => [k, defenses[k]?.types || []])),
    defensesRest: Object.fromEntries(DEFENSE_KINDS.filter((k) => defenses[k]).map((k) => [k, omit(defenses[k], ["types"])])),
    languages: (m.languages || []).join("\n"),
    challenge: m.cr ? "cr" : m.level != null ? "level" : "none",
    cr: m.cr?.cr || "",
    xp: m.cr?.xp ?? null,
    pb: m.cr?.pb ?? null,
    crRest: omit(m.cr, ["cr", "xp", "pb"]),
    level: m.level ?? null,
    initiative: m.initiative?.bonus ?? null,
    initAdvantage: !!m.initiative?.advantage,
    hasInitiative: !!m.initiative,
    legendaryUses: m.legendary_actions?.uses ?? null,
    legendaryLair: m.legendary_actions?.uses_in_lair ?? null,
    legendaryRest: omit(m.legendary_actions, ["uses", "uses_in_lair"]),
    features: (m.features || []).map((f) => ({ ...f })),
    spellcasting: (m.spellcasting || []).map((b) => ({ ...b, groups: (b.groups || []).map((g) => ({ ...g })) })),
    items: (m.items || []).map((it) => ({ ...it })),
    flags: { npc: !!m.flags?.npc, named: !!m.flags?.named, familiar: !!m.flags?.familiar },
    flagsRest: omit(m.flags, ["npc", "named", "familiar"]),
    environment: m.filters?.environment || [],
    filtersRest: omit(m.filters, ["environment"]),
    rest: Object.fromEntries(Object.entries(m).filter(([k]) => !HANDLED.has(k))),
  };
}

const slug = (s) => String(s || "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// New features get an id from their name, unique within the monster.
const withIds = (features) => {
  const used = new Set(features.map((f) => f.id).filter(Boolean));
  return features.map((f) => {
    if (f.id) return f;
    const base = slug(f.name) || "feature";
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return { ...f, id };
  });
};

const csv = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

export function formToMonster(form, original) {
  const f = form;
  const types = f.types.length > 1 || f.typeIsList ? f.types : f.types[0];
  const notesOrNothing = (o) => (Object.keys(o || {}).length ? o : undefined);
  const record = {
    ...formToHeader(f, "monster", original),
    ...f.rest,
    size: f.size,
    creature_type: { ...f.typeRest, type: types, tags: csv(f.typeTags), swarm_of: f.swarmOf || undefined },
    alignment: csv(f.alignment),
    alignment_prefix: f.alignmentPrefix.trim() || undefined,
    ac: f.ac.map((a) => ({
      value: a.value ?? undefined, from: a.fromList && a.from === a.fromList.join(", ") ? a.fromList : csv(a.from), condition: a.condition.trim() || undefined, special: a.special.trim() || undefined,
    })),
    hp: { ...f.hpRest, average: f.hp.average ?? undefined, formula: f.hp.formula.trim() || undefined, special: f.hp.special.trim() || undefined },
    speed: { ...f.speed, hover: f.hover || undefined, notes: notesOrNothing(f.speedNotes) },
    abilities: f.abilities,
    saves: Object.fromEntries(Object.entries(f.saves).map(([k, v]) => [k, valueFromText(v)])),
    skills: Object.fromEntries(f.skills.filter((s) => s.skill).map((s) => [s.skill, valueFromText(s.value)])),
    senses: { ...f.senses, notes: f.sensesNotes.trim() || undefined },
    passive_perception: f.passive ?? undefined,
    defenses: Object.fromEntries(DEFENSE_KINDS.map((k) => [k, { ...f.defensesRest[k], types: f.defenses[k] }])),
    languages: f.languages.split("\n").map((l) => l.trim()).filter(Boolean),
    cr: f.challenge === "cr" && f.cr ? { ...f.crRest, cr: f.cr, xp: f.xp ?? undefined, pb: f.pb ?? undefined } : undefined,
    level: f.challenge === "level" ? f.level ?? undefined : undefined,
    initiative: f.initiative != null || f.initAdvantage || f.hasInitiative
      ? { bonus: f.initiative ?? abilityMod(f.abilities?.dex) ?? 0, advantage: f.initAdvantage || undefined }
      : undefined,
    legendary_actions: { ...f.legendaryRest, uses: f.legendaryUses ?? undefined, uses_in_lair: f.legendaryLair ?? undefined },
    features: withIds(f.features),
    spellcasting: f.spellcasting,
    items: f.items,
    flags: { ...f.flagsRest, npc: f.flags.npc || undefined, named: f.flags.named || undefined, familiar: f.flags.familiar || undefined },
    filters: { ...f.filtersRest, environment: f.environment },
  };
  return pruneEmpty(record);
}

// ─── Form pieces' blanks ───────────────────────────────────────────

export const emptyFeature = (category = "actions") => ({ name: "", category, text: "" });
export const emptySpellBlock = () => ({
  name: "Spellcasting", ability: "int", text: "", display_as: "actions", groups: [{ how: "at_will", spells: [] }],
});

export const SIZE_OPTIONS = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
export const ABILITY_LABELS = ABILITY_NAMES;
