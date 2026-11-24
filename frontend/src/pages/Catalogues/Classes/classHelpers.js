import {
  ABILITY_NAMES, ABILITY_SHORT, FEAT_CATEGORIES, formatFeatureType, formatValue, labelFromId, nameFromId, plural,
  pruneEmpty, textFromValue, valueFromText, titleCase,
} from "../catalogueHelpers";
import { headerToForm, formToHeader, grantsToForm, formToGrants, bundleToForm, formToBundle } from "../catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   classHelpers — the Classes catalogue: classes and subclasses, which
   are two catalogues (creating a subclass never touches its class).

   A class record (data-model §4g): hit_die, hp, primary_ability, saves,
   grants + choices (proficiencies, skills, starting equipment),
   multiclass, subclass {title, level, text}, columns (the class table),
   resources, spellcasting, progression (what each level gives: feature
   ids, picks, "subclass feature here") and features.
   A subclass record: class_id, short_name, text, grants, choices,
   progression, features, and its own columns / resources /
   spellcasting when it has them (Eldritch Knight).
   ═══════════════════════════════════════════════════════════════════ */

export const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);
export const proficiencyBonus = (level) => Math.ceil(level / 4) + 1;

const ORD = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
export const ordinal = ORD;

// The value of a level table at a level: the last step at or below it.
// A plain value (a formula, a number) is the same at every level.
export const valueAt = (v, level) => {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return v;
  let out;
  for (const k of Object.keys(v).map(Number).sort((a, b) => a - b)) if (k <= level) out = v[k];
  return out;
};

const isTable = (v) => v && typeof v === "object" && !Array.isArray(v);

export const byId = (record) => Object.fromEntries((record?.features || []).map((f) => [f.id, f]));

// The features shown as cards: top-level ones (an option of another
// feature is shown inside it), in level order.
export const topFeatures = (record) =>
  (record?.features || []).filter((f) => !f.parent).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
export const childrenOf = (record) => {
  const out = {};
  for (const f of record?.features || []) if (f.parent) (out[f.parent] ||= []).push(f);
  return out;
};

export const progressionAt = (record, level) => (record?.progression || []).find((p) => p.level === level) || null;

// ─── Class table ───────────────────────────────────────────────────

const SLOT_HEADERS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

/* The columns a record adds to the class table: its own columns, then its
   spellcasting (cantrips, prepared when they're a table, spell
   slots, pact slots). Each: { key, header, group, cell(level) }.
   `tag` names a subclass's columns ("Eldritch Knight"). */
export const tableColumns = (record, tag = "") => {
  if (!record) return [];
  const out = [];
  const suffix = tag ? ` (${tag})` : "";
  for (const c of record.columns || []) {
    out.push({ key: `${tag}:${c.id}`, header: `${c.name}${suffix}`, cell: (l) => valueAt(c.values, l) });
  }
  const sc = record.spellcasting;
  if (sc) {
    if (isTable(sc.cantrips)) out.push({ key: `${tag}:cantrips`, header: `Cantrips${suffix}`, cell: (l) => valueAt(sc.cantrips, l) });
    if (isTable(sc.prepared)) out.push({ key: `${tag}:prepared`, header: `Prepared Spells${suffix}`, cell: (l) => valueAt(sc.prepared, l) });
    if (isTable(sc.slots)) {
      const width = Math.max(0, ...Object.values(sc.slots).map((a) => (Array.isArray(a) ? a.length : 0)));
      for (let i = 0; i < width; i += 1) {
        out.push({
          key: `${tag}:slot${i}`, header: SLOT_HEADERS[i], group: `Spell Slots per Spell Level${suffix}`,
          cell: (l) => valueAt(sc.slots, l)?.[i],
        });
      }
    }
    if (sc.pact) {
      out.push({ key: `${tag}:pact`, header: `Spell Slots${suffix}`, cell: (l) => valueAt(sc.pact.slots, l) });
      out.push({ key: `${tag}:pactlevel`, header: `Slot Level${suffix}`, cell: (l) => { const v = valueAt(sc.pact.level, l); return v ? ORD(v) : undefined; } });
    }
  }
  return out;
};

export const formatCell = (v) => (v == null || v === 0 ? "—" : typeof v === "number" ? String(v) : formatValue(v));

/* What a level gives, as words for the table: its features, upgrades,
   picks and "subclass feature". [{ name, kind }] */
export const levelWords = (record, level, features = byId(record)) => {
  const row = progressionAt(record, level);
  if (!row) return [];
  const out = [];
  for (const id of row.features || []) out.push({ name: features[id]?.name || nameFromId(id.split(":").pop()), kind: "feature", id });
  for (const id of row.upgrades || []) out.push({ name: features[id]?.name || nameFromId(id.split(":").pop()), kind: "upgrade", id });
  for (const c of row.choices || []) if (!(row.features || []).some((id) => features[id]?.name === c.label)) out.push({ name: c.label, kind: "choice" });
  if (row.subclass_features) out.push({ name: "Subclass feature", kind: "subclass" });
  return out;
};

// ─── Trait words ───────────────────────────────────────────────────

// [["str"], ["dex"]] → "Strength or Dexterity"; [["dex", "wis"]] → "Dexterity and Wisdom"
export const formatAbilityGroups = (groups) =>
  (groups || []).map((g) => g.map((a) => ABILITY_NAMES[a] || a).join(" and ")).join(" or ");

// [{str: 13}, {dex: 13}] → "Str 13 or Dex 13"; [{dex: 13, wis: 13}] → "Dex 13 and Wis 13"
export const formatRequires = (groups) =>
  (groups || []).map((g) => Object.entries(g).map(([a, n]) => `${ABILITY_SHORT[a] || a} ${n}`).join(" and ")).join(" or ");

export const PROGRESSIONS = {
  full: "Full caster", half: "Half caster (from level 2)", half_up: "Half caster", third: "Third caster", pact: "Pact Magic",
};

// The spellcasting rows of the traits panel.
export const spellcastingRows = (sc, index) => {
  if (!sc) return [];
  const rows = [];
  const add = (label, value) => value && rows.push({ label, value });
  add("Ability", ABILITY_NAMES[sc.ability]);
  add("Caster kind", PROGRESSIONS[sc.progression] || sc.progression);
  add("Spell list", sc.list ? `${nameFromId(sc.list, index)} spells` : "");
  if (!isTable(sc.prepared)) add("Prepared spells", sc.prepared != null ? formatValue(sc.prepared) : "");
  add("Prepares", sc.spellbook ? "from its spellbook" : "from its whole spell list");
  add("Changing spells", sc.change === "level" ? "one when you gain a level" : sc.change === "long_rest" ? "after a long rest" : "");
  if (sc.spellbook) add("Spellbook", `${sc.spellbook.first} spells, ${sc.spellbook.per_level} more each level`);
  if (sc.arcanum) add("Mystic Arcanum", Object.entries(sc.arcanum).map(([l, s]) => `level ${s} at ${l}`).join(", "));
  return rows;
};

const RESETS = { short: "short or long rest", long: "long rest" };
// "Superiority Dice: 4 d8 (level 3+)…, back on a short or long rest"
export const resourceWords = (r) => {
  const bits = [];
  if (r.max != null) bits.push(formatValue(r.max));
  if (r.die != null) bits.push(formatValue(r.die));
  // a level table: "back on a long rest; a short or long rest from level 5"
  const restWords = (x) => RESETS[x] || x;
  const reset =
    r.reset && typeof r.reset === "object"
      ? Object.entries(r.reset).sort((x, y) => Number(x[0]) - Number(y[0])).map(([lv, x], i) => (i === 0 ? restWords(x) : `a ${restWords(x)} from level ${lv}`)).join("; ")
      : r.reset ? restWords(r.reset) : "";
  if (reset) bits.push(`back on a ${reset}${r.short_rest != null && r.short_rest !== "all" ? `, ${r.short_rest} on a short rest` : ""}`);
  return bits.join(" · ");
};

// The class's choices that aren't starting equipment (skills, tools…).
export const isEquipment = (c) => c?.type === "bundle" && (/equipment/i.test(c.id || "") || /equipment/i.test(c.label || ""));

// ─── Standard spell slots ──────────────────────────────────────────
// The slot table by caster level; half / third casters use part of it.

const FULL = {
  1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1],
  10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};
const CASTER_LEVEL = {
  full: (l) => l,
  half: (l) => (l < 2 ? 0 : Math.ceil(l / 2)),
  half_up: (l) => Math.ceil(l / 2),
  third: (l) => (l < 3 ? 0 : Math.ceil(l / 3)),
};

// { "1": [2], "2": [3], … } with only the levels where the slots change.
export const standardSlots = (progression) => {
  const caster = CASTER_LEVEL[progression];
  if (!caster) return undefined;
  const out = {};
  let prev = "";
  for (const l of LEVELS) {
    const slots = FULL[caster(l)];
    const key = JSON.stringify(slots || []);
    if (slots && key !== prev) out[String(l)] = slots;
    prev = key;
  }
  return out;
};

/* The 2024 numbers for each caster kind, filled into the class table
   (and changed there): how many spells it prepares and how many cantrips
   it knows, and a pact caster's slots. Full: Cleric · half (from level 1):
   Paladin · half (from level 2): 2014 Ranger · third: Eldritch Knight ·
   pact: Warlock. */
export const STANDARD_PREPARED = {
  full: { 1: 4, 2: 5, 3: 6, 4: 7, 5: 9, 6: 10, 7: 11, 8: 12, 9: 14, 10: 15, 11: 16, 13: 17, 15: 18, 17: 19, 18: 20, 19: 21, 20: 22 },
  half_up: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 7: 7, 9: 9, 11: 10, 13: 11, 15: 12, 17: 14, 19: 15 },
  half: { 2: 2, 3: 3, 5: 4, 7: 5, 9: 6, 11: 7, 13: 8, 15: 9, 17: 10, 19: 11 },
  third: { 3: 3, 4: 4, 7: 5, 8: 6, 10: 7, 11: 8, 13: 9, 14: 10, 16: 11, 19: 12, 20: 13 },
  pact: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 11: 11, 13: 12, 15: 13, 17: 14, 19: 15 },
};
export const STANDARD_CANTRIPS = {
  full: { 1: 3, 4: 4, 10: 5 },
  half_up: {},
  half: {},
  third: { 3: 2, 10: 3 },
  pact: { 1: 2, 4: 3, 10: 4 },
};
export const STANDARD_PACT = { slots: { 1: 1, 2: 2, 11: 3, 17: 4 }, level: { 1: 1, 3: 2, 5: 3, 7: 4, 9: 5 } };

/* A level table moved from one standard to another: a level whose value
   was changed by hand (it differs from the old standard) keeps it, every
   other level takes the new standard. */
export const rebaseSteps = (cur, was, now) => {
  const out = {};
  for (const l of LEVELS) {
    const c = valueAt(cur, l);
    const v = JSON.stringify(c) !== JSON.stringify(valueAt(was, l)) ? c : valueAt(now, l);
    if (v !== undefined) out[l] = v;
  }
  return tidySteps(out) || {};
};

// A level table that begins at `start`: nothing before it, and at it the
// value it had there.
const fromLevel = (table, start) => {
  if (!table || start <= 1) return { ...(table || {}) };
  const out = {};
  const first = valueAt(table, start);
  if (first !== undefined) out[start] = first;
  for (const [k, v] of Object.entries(table)) if (Number(k) > start) out[k] = v;
  return out;
};

/* Every number the caster kind fills in, as the form keeps them.
   startsAt: a subclass casts from its first level. Its numbers are the
   kind's at that class level (as when multiclassing), and begin there:
   level up gives the difference from the level before, so a full-caster
   subclass at level 3 gets its 6 spells and 3 cantrips at once. */
export const standardNumbers = (progression, startsAt = 1) => ({
  slots: progression === "pact" ? {} : fromLevel(standardSlots(progression), startsAt),
  pactSlots: progression === "pact" ? fromLevel(STANDARD_PACT.slots, startsAt) : {},
  pactLevel: progression === "pact" ? fromLevel(STANDARD_PACT.level, startsAt) : {},
  prepared: fromLevel(STANDARD_PREPARED[progression], startsAt),
  cantrips: fromLevel(STANDARD_CANTRIPS[progression], startsAt),
});

// ─── Picks (the progression's choices) ─────────────────────────────

/* The common picks a level can add, as the pipeline writes them.
   kind: subclass · asi · epic_boon · fighting_style · optional_features ·
   weapon_mastery. */
export const PICK_KINDS = {
  asi: "Ability Score Improvement",
  fighting_style: "Fighting Style",
  epic_boon: "Epic Boon",
  optional_features: "Optional features (invocations, maneuvers…)",
  weapon_mastery: "Weapon Mastery",
};

export const makePick = (kind, { level, edition, classId, subclassTitle, featureType = "maneuver", count = 1 }) => {
  if (kind === "subclass") {
    const label = subclassTitle || "Subclass";
    return { type: "pool", id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${level}`, label, grant: "subclass", count: 1, from: classId };
  }
  if (kind === "asi" && edition === "classic") {
    return {
      type: "bundle", id: `ability_score_improvement_${level}`, label: "Ability Score Improvement",
      options: [
        { id: "ability", label: "+2 to one ability or +1 to two", choices: [{ type: "ability", id: `ability_${level}`, label: "Ability Scores", from: ["str", "dex", "con", "int", "wis", "cha"], bonus_sets: [[2], [1, 1]] }] },
        { id: "feat", label: "A feat", choices: [{ type: "pool", id: `feat_${level}`, label: "Feat", grant: "feats", count: 1, from: "all_feats" }] },
      ],
    };
  }
  if (kind === "asi" || kind === "epic_boon" || kind === "fighting_style") {
    const category = kind === "asi" ? "general" : kind;
    const label = kind === "asi" ? "Ability Score Improvement" : FEAT_CATEGORIES[kind];
    return { type: "pool", id: `${kind === "asi" ? "ability_score_improvement" : kind}_${level}`, label, grant: "feats", count: 1, from: { category: [category] } };
  }
  if (kind === "optional_features") {
    const label = `${formatFeatureType(featureType)}s`;
    return { type: "pool", id: `${featureType}s_${level}`, label, grant: "optional_features", count, from: { feature_type: [featureType] } };
  }
  if (kind === "weapon_mastery") {
    return { type: "pool", id: `weapon_mastery_${level}`, label: "Weapon Mastery", grant: "weapon_masteries", count, from: "proficient_weapons" };
  }
  return null;
};

// ─── Level tables (the class table's cells) ───────────────────────
/* A column, a pool's size or a spell count is a level table: { "1": 2,
   "4": 3 } — the value from that level on. In the table editor each cell
   is that level's own step; an empty cell shows the value above it. */

export const stepsOf = (v) => (isTable(v) ? { ...v } : v == null || v === "" ? {} : { 1: v });

// What's typed in a cell: "" → no step · "3" → 3 · "d8", "1d6" → as typed.
export const parseCell = (text) => {
  const t = String(text ?? "").trim();
  if (!t) return undefined;
  return /^-?\d+$/.test(t) ? Number(t) : t;
};

export const setStep = (table, level, value) => {
  const next = { ...(table || {}) };
  if (value === undefined) delete next[level];
  else next[level] = value;
  return next;
};

// Drops a step that repeats the value before it; nothing left → undefined.
export const tidySteps = (table) => {
  if (!isTable(table)) return table;
  const out = {};
  let prev;
  for (const k of Object.keys(table).map(Number).sort((a, b) => a - b)) {
    const key = JSON.stringify(table[k]);
    if (key !== prev) out[String(k)] = table[k];
    prev = key;
  }
  return Object.keys(out).length ? out : undefined;
};

// A spell-slot row with slot level i (0 = 1st) set to n; no trailing zeros.
export const withSlot = (row, i, n) => {
  const out = [...(row || [])];
  for (let j = 0; j < i; j += 1) out[j] ??= 0;
  out[i] = n || 0;
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
};

// How many slot levels a caster kind reaches.
export const SLOT_WIDTH = { full: 9, half: 5, half_up: 5, third: 4 };
export { SLOT_HEADERS };

// ─── Features in the form ──────────────────────────────────────────
/* A feature added in the form has no id until it's saved (it's made from
   its name), so it's known by `_new` meanwhile: its options point at it
   (`parent`) and a level's "improves" list names it. */

export const featureRef = (f) => f?.id || f?._new;
let newCount = 0;
export const newFeatureAt = (level, extra = {}) => ({
  _new: `new-${Date.now().toString(36)}-${(newCount += 1)}`, name: "", category: "traits", level, text: "", ...extra,
});

// The feature and everything inside it, out of the features and out of
// every level's "improves" list. form → { features, progression }
export const removeFeature = (form, ref) => {
  const gone = new Set([ref]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of form.features) {
      if (f.parent && gone.has(f.parent) && !gone.has(featureRef(f))) {
        gone.add(featureRef(f));
        grew = true;
      }
    }
  }
  return {
    features: form.features.filter((f) => !gone.has(featureRef(f))),
    progression: Object.fromEntries(
      Object.entries(form.progression).map(([l, r]) => [l, { ...r, upgrades: r.upgrades.filter((u) => !gone.has(u)) }])
    ),
  };
};

// The levels a class's subclasses give features: where the subclass is
// picked, and every level marked "subclass feature".
export const subclassLevels = (cls) => {
  const out = new Set();
  for (const p of cls?.progression || []) {
    if (p.subclass_features || (p.choices || []).some((c) => c.grant === "subclass")) out.add(p.level);
  }
  if (!out.size && cls?.subclass?.level) out.add(cls.subclass.level);
  return [...out].sort((a, b) => a - b);
};

// ─── Form: shared parts ────────────────────────────────────────────

const slug = (s) => String(s || "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const omit = (obj, keys) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys.includes(k)));
const idOf = (name, fallback) => slug(name).replace(/-/g, "_") || fallback;

const isSubclassPick = (c) => c?.grant === "subclass";

/* progression list → { level: row } (every level 1–20, empty ones too).
   The subclass pick is taken out (the form puts it back at the subclass
   level): → { rows, subclassPick } */
const progressionToForm = (progression) => {
  const rows = Object.fromEntries(LEVELS.map((l) => [l, { features: [], choices: [], subclass_features: false, upgrades: [], rest: {} }]));
  let subclassPick = null;
  for (const p of progression || []) {
    const choices = p.choices || [];
    subclassPick ||= choices.find(isSubclassPick) || null;
    rows[p.level] = {
      features: p.features || [],
      choices: choices.filter((c) => !isSubclassPick(c)),
      subclass_features: !!p.subclass_features,
      upgrades: p.upgrades || [],
      rest: omit(p, ["level", "features", "choices", "subclass_features", "upgrades"]),
      present: true,
    };
  }
  return { rows, subclassPick };
};

/* New features get an id ("<owner id>:<feature name>"); options and
   "improves" lists that named them by `_new` are pointed at it.
   → { features, renamed: { _new: id } } */
const withIds = (features, owner) => {
  const used = new Set(features.map((f) => f.id).filter(Boolean));
  const renamed = {};
  const out = features.map(({ _new, ...f }) => {
    if (f.id) return f;
    const base = `${owner}:${slug(f.name) || "feature"}`;
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    if (_new) renamed[_new] = id;
    return { ...f, id };
  });
  return { features: out.map((f) => (f.parent && renamed[f.parent] ? { ...f, parent: renamed[f.parent] } : f)), renamed };
};

/* { level: row } + the features → the progression list. Each level lists
   its top-level features: ids already listed keep their place, a
   feature moved to another level moves with it, a removed one goes, and
   a new one is added at its level. */
const formToProgression = (rows, features, originalIds, renamed = {}) => {
  const fmap = Object.fromEntries(features.map((f) => [f.id, f]));
  const listed = new Set();
  const out = [];
  for (const level of LEVELS) {
    const row = rows[level];
    const ids = row.features.filter((id) => {
      const f = fmap[id];
      if (!f) return !originalIds.has(id); // listed but not ours: kept as it is
      return !f.parent && (f.level ?? 1) === level;
    });
    ids.forEach((id) => listed.add(id));
    row._ids = ids;
  }
  for (const f of features) {
    const level = f.level ?? 1;
    if (!f.parent && !listed.has(f.id) && rows[level]) rows[level]._ids.push(f.id);
  }
  for (const level of LEVELS) {
    const row = rows[level];
    const entry = pruneEmpty({
      ...row.rest,
      features: row._ids,
      choices: row.choices,
      subclass_features: row.subclass_features || undefined,
      upgrades: row.upgrades.map((u) => renamed[u] || u),
    });
    delete row._ids;
    if (entry || row.present) out.push({ level, ...(entry || {}) });
  }
  return out;
};

/* Spellcasting in the form — four picks that don't depend on each other:
     ability · spell list · caster kind (the slots) · how it prepares:
       book   a spellbook: starts with N spells, writes M more each level;
              prepares from the book, changes them after a long rest
              (like the Wizard)
       daily  prepares from its whole list, changes them after a long
              rest (like the Cleric, Druid, Paladin, Ranger)
       level  picks from its whole list, replaces one when it gains a
              level (like the Bard, Sorcerer, Warlock)
   How many it prepares and its cantrips are columns of the class table,
   filled from the caster kind (standardNumbers). A book's formula count
   (2014 Cleric: "class_level + wis_mod") is kept as it is (prepFormula)
   and worked out from the character; the form doesn't offer formulas. */
export const PREP_STYLES = [
  { value: "book", label: "Spellbook", like: "the Wizard", words: "starts with a book of spells, writes more in each level, and prepares from the book; changes them after a long rest" },
  { value: "daily", label: "Whole list, daily", like: "the Cleric, Druid, Paladin, Ranger", words: "prepares from its whole spell list; changes them after a long rest" },
  { value: "level", label: "Whole list, on level up", like: "the Bard, Sorcerer, Warlock", words: "picks from its whole spell list; can replace one when it gains a level" },
];

const spellcastingToForm = (sc) => {
  const prepared = sc?.prepared;
  return {
    on: !!sc,
    ability: sc?.ability || "int",
    progression: sc?.progression || "",
    list: sc?.list || "",
    style: sc?.spellbook ? "book" : sc?.change === "level" ? "level" : "daily",
    cantrips: stepsOf(sc?.cantrips),
    prepared: typeof prepared === "string" ? {} : stepsOf(prepared),
    prepFormula: typeof prepared === "string" ? prepared : "",
    slots: stepsOf(sc?.slots),
    pactSlots: stepsOf(sc?.pact?.slots),
    pactLevel: stepsOf(sc?.pact?.level),
    pactRest: omit(sc?.pact, ["slots", "level"]),
    spellbookFirst: sc?.spellbook?.first ?? 6,
    spellbookPerLevel: sc?.spellbook?.per_level ?? 2,
    spellbookRest: omit(sc?.spellbook, ["first", "per_level"]),
    rest: omit(sc, ["ability", "progression", "list", "cantrips", "prepared", "change", "slots", "pact", "spellbook"]),
  };
};

const formToSpellcasting = (s) => {
  if (!s.on) return undefined;
  const pact = s.progression === "pact";
  return {
    ...s.rest,
    ability: s.ability,
    progression: s.progression || undefined,
    list: s.list || undefined,
    cantrips: tidySteps(s.cantrips),
    prepared: s.prepFormula || tidySteps(s.prepared),
    change: s.style === "level" ? "level" : "long_rest",
    slots: pact ? undefined : tidySteps(s.slots),
    pact: pact ? { ...s.pactRest, slots: tidySteps(s.pactSlots) ?? {}, level: tidySteps(s.pactLevel) ?? {} } : undefined,
    spellbook: s.style === "book" ? { ...s.spellbookRest, first: s.spellbookFirst ?? 0, per_level: s.spellbookPerLevel ?? 0 } : undefined,
  };
};

export const emptySpellcasting = () => spellcastingToForm(null);

// Pools that aren't a column of the table: their numbers typed as text.
const resourcesToForm = (rs) => (rs || []).map((r) => ({ ...omit(r, ["max", "die"]), max: textFromValue(r.max), die: textFromValue(r.die) }));
const formToResources = (rs) =>
  rs.map((r) => ({ ...r, id: r.id || idOf(r.name, "pool"), max: valueFromText(r.max), die: valueFromText(r.die) }));

/* The table's own columns; a column features spend from (Second Wind,
   Focus Points) carries its pool ({ reset, short_rest }) — the record
   keeps that pool under `resources` with the column's id and numbers.
   Other pools (a die, a formula, another id) stay a list of their own.
   → { columns: [{ id, name, values, pool }], resources } */
const columnsAndPools = (cols, rs) => {
  const columns = (cols || []).map((c) => ({ ...omit(c, ["values"]), values: stepsOf(c.values), pool: null }));
  const loose = [];
  for (const r of rs || []) {
    const col = columns.find((c) => c.id === r.id && !c.pool && r.die == null && JSON.stringify(stepsOf(r.max)) === JSON.stringify(c.values));
    if (col) col.pool = omit(r, ["id", "name", "max"]);
    else loose.push(r);
  }
  return { columns, resources: resourcesToForm(loose) };
};

const formToColumnsAndPools = (columns, resources) => {
  const cols = columns.map((c) => ({ ...omit(c, ["pool", "values"]), id: c.id || idOf(c.name, "column"), name: c.name.trim(), values: tidySteps(c.values) ?? {} }));
  const pools = columns.map((c, i) => c.pool && { ...c.pool, id: cols[i].id, name: cols[i].name, max: cols[i].values }).filter(Boolean);
  return { columns: cols, resources: [...pools, ...formToResources(resources)] };
};

// ─── Form: class ───────────────────────────────────────────────────

export const HIT_DICE = ["d6", "d8", "d10", "d12"];
// The hit points a hit die gives: "10 + con_mod" at level 1, "6 + con_mod" after.
export const hpFor = (die) => {
  const n = Number(String(die).replace("d", "")) || 8;
  return { first: `${n} + con_mod`, per_level: `${n / 2 + 1} + con_mod` };
};

export const ARMOR = ["light", "medium", "heavy", "shields"];
export const WEAPONS = ["simple_weapons", "martial_weapons"];

// srd / reprinted_as are the book's: a homebrew copy is neither.
const CLASS_HANDLED = new Set([
  "id", "kind", "name", "source", "edition", "visibility", "text", "aliases", "tags", "created_by", "srd", "reprinted_as",
  "hit_die", "hp", "primary_ability", "saves", "grants", "choices", "starting_gold", "multiclass", "subclass",
  "columns", "resources", "spellcasting", "progression", "features",
]);

export const emptyClassForm = () => ({
  name: "", edition: "one", visibility: "private", text: "",
  hitDie: "d8", hpRest: {},
  primary: [["str"]], saves: [],
  armor: [], weapons: ["simple_weapons"], grants: grantsToForm({}, []),
  equipment: [], startingGold: "",
  mcRequires: [{ str: 13 }], mcArmor: [], mcWeapons: [], mcRest: {},
  subclassTitle: "", subclassLevel: 3, subclassText: "", subclassRest: {}, subclassPick: null,
  columns: [], resources: [], spellcasting: emptySpellcasting(),
  progression: progressionToForm([]).rows,
  features: [], originalIds: [],
  rest: {},
});

export function classToForm(c, { copy = false } = {}) {
  const grants = c.grants || {};
  const choices = c.choices || [];
  const equipment = choices.filter(isEquipment);
  const mc = c.multiclass || {};
  const { rows, subclassPick } = progressionToForm(c.progression);
  const pickLevel = (c.progression || []).find((p) => (p.choices || []).some(isSubclassPick))?.level;
  return {
    ...headerToForm(c, { copy }),
    hitDie: c.hit_die || "d8",
    hpRest: omit(c.hp, ["first", "per_level"]),
    primary: c.primary_ability || [],
    saves: c.saves || [],
    armor: grants.armor || [],
    weapons: grants.weapons || [],
    grants: grantsToForm(omit(grants, ["armor", "weapons"]), choices.filter((x) => !isEquipment(x))),
    equipment: equipment.map((b) => ({ id: b.id, label: b.label, options: bundleToForm(b), rest: omit(b, ["type", "id", "label", "options"]) })),
    startingGold: c.starting_gold || "",
    hasMulticlass: !!c.multiclass,
    mcRequires: mc.requires || [],
    mcArmor: mc.grants?.armor || [],
    mcWeapons: mc.grants?.weapons || [],
    mcRest: { ...omit(mc, ["requires", "grants"]), grants: omit(mc.grants, ["armor", "weapons"]) },
    subclassTitle: c.subclass?.title || "",
    subclassLevel: c.subclass?.level ?? pickLevel ?? null,
    subclassText: c.subclass?.text || "",
    subclassRest: omit(c.subclass, ["title", "level", "text"]),
    subclassPick,
    ...columnsAndPools(c.columns, c.resources),
    spellcasting: spellcastingToForm(c.spellcasting),
    progression: rows,
    features: (c.features || []).map((f) => ({ ...f })),
    originalIds: (c.features || []).map((f) => f.id),
    rest: Object.fromEntries(Object.entries(c).filter(([k]) => !CLASS_HANDLED.has(k))),
  };
}

/* The subclass pick goes on the subclass level (none: no subclasses).
   Its title is "<Class> Subclass" unless the book named it. Its `from` is the class's
   own id; a new class gets its id when it's saved, so the server sets it
   then. */
const withSubclassPick = (progression, f, classId) => {
  if (!f.subclassLevel) return progression; // a class without subclasses
  const title = f.subclassTitle.trim() || `${f.name.trim()} Subclass`;
  const pick = {
    ...(f.subclassPick || {}),
    type: "pool", id: `${idOf(title, "subclass")}_${f.subclassLevel}`, label: title, grant: "subclass", count: 1, from: classId || "",
  };
  const at = progression.find((p) => p.level === f.subclassLevel);
  if (at) at.choices = [pick, ...(at.choices || [])];
  else progression.push({ level: f.subclassLevel, choices: [pick] });
  return progression.sort((a, b) => a.level - b.level);
};

export function formToClass(form, original) {
  const f = form;
  const owner = original?.id || slug(f.name);
  const { features, renamed } = withIds(f.features, owner);
  const { grants, choices } = formToGrants(f.grants);
  const equipment = f.equipment
    .map((b, i) => {
      const bundle = formToBundle(b.options, { id: b.id || (i ? `starting_equipment_${i + 1}` : "starting_equipment"), label: b.label || "Starting Equipment" });
      return bundle && { ...bundle, ...b.rest };
    })
    .filter(Boolean);
  const mcGrants = { ...f.mcRest.grants, armor: f.mcArmor, weapons: f.mcWeapons };
  const { columns, resources } = formToColumnsAndPools(f.columns, f.resources);
  const progression = withSubclassPick(formToProgression(structuredClone(f.progression), features, new Set(f.originalIds), renamed), f, original?.id);
  const record = {
    ...formToHeader(f, "class", original),
    ...f.rest,
    hit_die: f.hitDie,
    // Always the rule: the die's maximum at level 1, its average after.
    hp: { ...f.hpRest, ...hpFor(f.hitDie) },
    primary_ability: f.primary.filter((g) => g.length),
    saves: f.saves,
    grants: { ...grants, armor: f.armor, weapons: f.weapons },
    choices: [...choices, ...equipment],
    starting_gold: f.startingGold.trim() || undefined,
    multiclass: f.hasMulticlass || f.mcRequires.length || f.mcArmor.length || f.mcWeapons.length
      ? { ...omit(f.mcRest, ["grants"]), requires: f.mcRequires, grants: mcGrants }
      : undefined,
    subclass: f.subclassLevel
      ? { ...f.subclassRest, title: f.subclassTitle.trim() || `${f.name.trim()} Subclass`, level: f.subclassLevel, text: f.subclassText }
      : undefined,
    columns,
    resources,
    spellcasting: formToSpellcasting(f.spellcasting),
    progression,
    features,
  };
  const out = pruneEmpty(record);
  // grants / choices / progression / features stay even when empty: the
  // builder reads them without checking.
  for (const k of ["grants", "choices", "progression", "features"]) out[k] ??= k === "grants" ? {} : [];
  return out;
}

// ─── Form: subclass ────────────────────────────────────────────────

const SUBCLASS_HANDLED = new Set([
  "id", "kind", "name", "source", "edition", "visibility", "text", "aliases", "tags", "created_by", "srd", "reprinted_as",
  "class_id", "short_name", "grants", "choices", "progression", "features", "columns", "resources", "spellcasting",
]);

export const emptySubclassForm = (classId = "") => ({
  name: "", edition: "one", visibility: "private", text: "",
  classId,
  grants: grantsToForm({}, []),
  columns: [], resources: [], spellcasting: emptySpellcasting(),
  progression: progressionToForm([]).rows,
  features: [], originalIds: [],
  rest: {},
});

export function subclassToForm(sc, { copy = false } = {}) {
  return {
    ...headerToForm(sc, { copy }),
    classId: sc.class_id || "",
    grants: grantsToForm(sc.grants, sc.choices),
    ...columnsAndPools(sc.columns, sc.resources),
    spellcasting: spellcastingToForm(sc.spellcasting),
    progression: progressionToForm(sc.progression).rows,
    features: (sc.features || []).map((f) => ({ ...f })),
    originalIds: (sc.features || []).map((f) => f.id),
    rest: Object.fromEntries(Object.entries(sc).filter(([k]) => !SUBCLASS_HANDLED.has(k))),
  };
}

export function formToSubclass(form, original) {
  const f = form;
  const owner = original?.id || `${f.classId}:${slug(f.name)}`;
  const { features, renamed } = withIds(f.features, owner);
  const { grants, choices } = formToGrants(f.grants);
  const { columns, resources } = formToColumnsAndPools(f.columns, f.resources);
  const out = pruneEmpty({
    ...formToHeader(f, "subclass", original),
    ...f.rest,
    class_id: f.classId,
    short_name: f.name.trim(), // one name
    grants,
    choices,
    columns,
    resources,
    spellcasting: formToSpellcasting(f.spellcasting),
    progression: formToProgression(structuredClone(f.progression), features, new Set(f.originalIds), renamed),
    features,
  });
  out.text ??= "";
  for (const k of ["progression", "features"]) out[k] ??= [];
  return out;
}

// ─── Words for a pick ──────────────────────────────────────────────

export const pickWords = (c) => {
  if (!c) return "";
  const n = c.count && c.count > 1 ? `${c.count} ` : "";
  if (c.grant === "optional_features") return `${n}${(c.from?.feature_type || []).map(formatFeatureType).join(" / ")}`;
  if (c.grant === "feats" && c.from?.category) return `${c.from.category.map((k) => FEAT_CATEGORIES[k] || titleCase(k)).join(" / ")} feat`;
  if (c.grant === "weapon_masteries") return `${n}weapon mastery`;
  if (c.grant === "subclass") return "subclass";
  if (c.type === "bundle") return (c.options || []).map((o) => o.label).join(" or ");
  return c.grant ? `${n}${labelFromId(c.grant)}` : "";
};
