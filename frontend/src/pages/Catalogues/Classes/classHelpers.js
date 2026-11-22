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
   spellcasting (cantrips, prepared / known when they're a table, spell
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
    if (isTable(sc.known)) out.push({ key: `${tag}:known`, header: `Spells Known${suffix}`, cell: (l) => valueAt(sc.known, l) });
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
  full: "Full caster", half: "Half caster (from level 2)", half_up: "Half caster (from level 1)", third: "Third caster", pact: "Pact Magic",
};

// The spellcasting rows of the traits panel.
export const spellcastingRows = (sc, index) => {
  if (!sc) return [];
  const rows = [];
  const add = (label, value) => value && rows.push({ label, value });
  add("Ability", ABILITY_NAMES[sc.ability]);
  add("Progression", PROGRESSIONS[sc.progression] || sc.progression);
  add("Spell list", sc.list ? `${nameFromId(sc.list, index)} spells` : "");
  if (!isTable(sc.prepared)) add("Prepared spells", sc.prepared != null ? formatValue(sc.prepared) : "");
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
  if (r.reset) bits.push(`back on a ${RESETS[r.reset] || r.reset}${r.short_rest != null && r.short_rest !== "all" ? `, ${r.short_rest} on a short rest` : ""}`);
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

// ─── Picks (the progression's choices) ─────────────────────────────

/* The common picks a level can add, as the pipeline writes them.
   kind: subclass · asi · epic_boon · fighting_style · optional_features ·
   weapon_mastery. */
export const PICK_KINDS = {
  asi: "Ability Score Improvement",
  subclass: "Subclass",
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

// ─── Form: shared parts ────────────────────────────────────────────

const slug = (s) => String(s || "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const omit = (obj, keys) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys.includes(k)));

// progression list → { level: row } (every level 1–20, empty ones too)
const progressionToForm = (progression) => {
  const out = Object.fromEntries(LEVELS.map((l) => [l, { features: [], choices: [], subclass_features: false, upgrades: [], rest: {} }]));
  for (const p of progression || []) {
    out[p.level] = {
      features: p.features || [],
      choices: p.choices || [],
      subclass_features: !!p.subclass_features,
      upgrades: p.upgrades || [],
      rest: omit(p, ["level", "features", "choices", "subclass_features", "upgrades"]),
      present: true,
    };
  }
  return out;
};

// New features get an id: "<owner id>:<feature name>".
const withIds = (features, owner) => {
  const used = new Set(features.map((f) => f.id).filter(Boolean));
  return features.map((f) => {
    if (f.id) return f;
    const base = `${owner}:${slug(f.name) || "feature"}`;
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return { ...f, id };
  });
};

/* { level: row } + the features → the progression list. Each level lists
   its top-level features: ids already listed keep their place, a
   feature moved to another level moves with it, a removed one goes, and
   a new one is added at its level. */
const formToProgression = (rows, features, originalIds) => {
  const fmap = Object.fromEntries(features.map((f) => [f.id, f]));
  const listed = new Set();
  const out = [];
  for (const level of LEVELS) {
    const row = rows[level];
    const ids = row.features.filter((id) => {
      const f = fmap[id];
      if (!f) return !originalIds.has(id); // listed but not ours: kept as it is
      return !f.parent && f.level === level;
    });
    ids.forEach((id) => listed.add(id));
    row._ids = ids;
  }
  for (const f of features) {
    if (!f.parent && !listed.has(f.id) && rows[f.level]) rows[f.level]._ids.push(f.id);
  }
  for (const level of LEVELS) {
    const row = rows[level];
    const entry = pruneEmpty({
      ...row.rest,
      features: row._ids,
      choices: row.choices,
      subclass_features: row.subclass_features || undefined,
      upgrades: row.upgrades,
    });
    delete row._ids;
    if (entry || row.present) out.push({ level, ...(entry || {}) });
  }
  return out;
};

// level table / formula ↔ the text blanks of columns and resources
const tableText = (v) => textFromValue(v);
const tableValue = (t) => valueFromText(t);

const spellcastingToForm = (sc) => ({
  on: !!sc,
  ability: sc?.ability || "int",
  progression: sc?.progression || "",
  list: sc?.list || "",
  cantrips: tableText(sc?.cantrips),
  prepared: tableText(sc?.prepared),
  known: tableText(sc?.known),
  change: sc?.change || "",
  slots: sc?.slots,
  pactSlots: tableText(sc?.pact?.slots),
  pactLevel: tableText(sc?.pact?.level),
  pactRest: omit(sc?.pact, ["slots", "level"]),
  spellbookFirst: sc?.spellbook?.first ?? null,
  spellbookPerLevel: sc?.spellbook?.per_level ?? null,
  spellbookRest: omit(sc?.spellbook, ["first", "per_level"]),
  rest: omit(sc, ["ability", "progression", "list", "cantrips", "prepared", "known", "change", "slots", "pact", "spellbook"]),
});

const formToSpellcasting = (s) =>
  s.on
    ? {
        ...s.rest,
        ability: s.ability,
        progression: s.progression || undefined,
        list: s.list || undefined,
        cantrips: tableValue(s.cantrips),
        prepared: tableValue(s.prepared),
        known: tableValue(s.known),
        change: s.change || undefined,
        slots: s.progression === "pact" ? undefined : s.slots,
        pact: s.progression === "pact" || s.pactSlots ? { ...s.pactRest, slots: tableValue(s.pactSlots), level: tableValue(s.pactLevel) } : undefined,
        spellbook: s.spellbookFirst != null ? { ...s.spellbookRest, first: s.spellbookFirst, per_level: s.spellbookPerLevel ?? 0 } : undefined,
      }
    : undefined;

export const emptySpellcasting = () => spellcastingToForm(null);

const columnsToForm = (cols) => (cols || []).map((c) => ({ ...omit(c, ["values"]), values: tableText(c.values) }));
const formToColumns = (cols) =>
  cols.map((c) => ({ ...c, id: c.id || slug(c.name).replace(/-/g, "_"), values: tableValue(c.values) }));

const resourcesToForm = (rs) => (rs || []).map((r) => ({ ...omit(r, ["max", "die"]), max: tableText(r.max), die: tableText(r.die) }));
const formToResources = (rs) =>
  rs.map((r) => ({ ...r, id: r.id || slug(r.name).replace(/-/g, "_"), max: tableValue(r.max), die: tableValue(r.die) }));

// ─── Form: class ───────────────────────────────────────────────────

export const HIT_DICE = ["d6", "d8", "d10", "d12"];
// The hit points a hit die gives: "10 + con_mod" at level 1, "6 + con_mod" after.
export const hpFor = (die) => {
  const n = Number(String(die).replace("d", "")) || 8;
  return { first: `${n} + con_mod`, per_level: `${n / 2 + 1} + con_mod` };
};

export const ARMOR = ["light", "medium", "heavy", "shields"];
export const WEAPONS = ["simple_weapons", "martial_weapons"];

const CLASS_HANDLED = new Set([
  "id", "kind", "name", "source", "edition", "visibility", "text", "aliases", "tags", "created_by",
  "hit_die", "hp", "primary_ability", "saves", "grants", "choices", "starting_gold", "multiclass", "subclass",
  "columns", "resources", "spellcasting", "progression", "features",
]);

export const emptyClassForm = () => ({
  name: "", edition: "one", visibility: "private", text: "",
  hitDie: "d8", hpFirst: "8 + con_mod", hpPerLevel: "5 + con_mod", hpRest: {},
  primary: [["str"]], saves: [],
  armor: [], weapons: ["simple_weapons"], grants: grantsToForm({}, []),
  equipment: [], startingGold: "",
  mcRequires: [{ str: 13 }], mcArmor: [], mcWeapons: [], mcRest: {},
  subclassTitle: "", subclassLevel: 3, subclassText: "", subclassRest: {},
  columns: [], resources: [], spellcasting: emptySpellcasting(),
  progression: progressionToForm([]),
  features: [], originalIds: [],
  rest: {},
});

export function classToForm(c, { copy = false } = {}) {
  const grants = c.grants || {};
  const choices = c.choices || [];
  const equipment = choices.filter(isEquipment);
  const mc = c.multiclass || {};
  return {
    ...headerToForm(c, { copy }),
    hitDie: c.hit_die || "d8",
    hpFirst: c.hp?.first || "",
    hpPerLevel: c.hp?.per_level || "",
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
    subclassLevel: c.subclass?.level ?? 3,
    subclassText: c.subclass?.text || "",
    subclassRest: omit(c.subclass, ["title", "level", "text"]),
    columns: columnsToForm(c.columns),
    resources: resourcesToForm(c.resources),
    spellcasting: spellcastingToForm(c.spellcasting),
    progression: progressionToForm(c.progression),
    features: (c.features || []).map((f) => ({ ...f })),
    originalIds: (c.features || []).map((f) => f.id),
    rest: Object.fromEntries(Object.entries(c).filter(([k]) => !CLASS_HANDLED.has(k))),
  };
}

export function formToClass(form, original) {
  const f = form;
  const owner = original?.id || slug(f.name);
  const features = withIds(f.features, owner);
  const { grants, choices } = formToGrants(f.grants);
  const equipment = f.equipment
    .map((b, i) => {
      const bundle = formToBundle(b.options, { id: b.id || (i ? `starting_equipment_${i + 1}` : "starting_equipment"), label: b.label || "Starting Equipment" });
      return bundle && { ...bundle, ...b.rest };
    })
    .filter(Boolean);
  const mcGrants = { ...f.mcRest.grants, armor: f.mcArmor, weapons: f.mcWeapons };
  const record = {
    ...formToHeader(f, "class", original),
    ...f.rest,
    hit_die: f.hitDie,
    hp: { ...f.hpRest, first: f.hpFirst.trim(), per_level: f.hpPerLevel.trim() },
    primary_ability: f.primary.filter((g) => g.length),
    saves: f.saves,
    grants: { ...grants, armor: f.armor, weapons: f.weapons },
    choices: [...choices, ...equipment],
    starting_gold: f.startingGold.trim() || undefined,
    multiclass: f.hasMulticlass || f.mcRequires.length || f.mcArmor.length || f.mcWeapons.length
      ? { ...omit(f.mcRest, ["grants"]), requires: f.mcRequires, grants: mcGrants }
      : undefined,
    subclass: { ...f.subclassRest, title: f.subclassTitle.trim() || `${f.name.trim()} Subclass`, level: f.subclassLevel, text: f.subclassText },
    columns: formToColumns(f.columns),
    resources: formToResources(f.resources),
    spellcasting: formToSpellcasting(f.spellcasting),
    progression: formToProgression(structuredClone(f.progression), features, new Set(f.originalIds)),
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
  "id", "kind", "name", "source", "edition", "visibility", "text", "aliases", "tags", "created_by",
  "class_id", "short_name", "grants", "choices", "progression", "features", "columns", "resources", "spellcasting",
]);

export const emptySubclassForm = (classId = "") => ({
  name: "", edition: "one", visibility: "private", text: "",
  classId, shortName: "",
  grants: grantsToForm({}, []),
  columns: [], resources: [], spellcasting: emptySpellcasting(),
  progression: progressionToForm([]),
  features: [], originalIds: [],
  rest: {},
});

export function subclassToForm(sc, { copy = false } = {}) {
  return {
    ...headerToForm(sc, { copy }),
    classId: sc.class_id || "",
    shortName: copy ? "" : sc.short_name || "",
    grants: grantsToForm(sc.grants, sc.choices),
    columns: columnsToForm(sc.columns),
    resources: resourcesToForm(sc.resources),
    spellcasting: spellcastingToForm(sc.spellcasting),
    progression: progressionToForm(sc.progression),
    features: (sc.features || []).map((f) => ({ ...f })),
    originalIds: (sc.features || []).map((f) => f.id),
    rest: Object.fromEntries(Object.entries(sc).filter(([k]) => !SUBCLASS_HANDLED.has(k))),
  };
}

export function formToSubclass(form, original) {
  const f = form;
  const owner = original?.id || `${f.classId}:${slug(f.shortName || f.name)}`;
  const features = withIds(f.features, owner);
  const { grants, choices } = formToGrants(f.grants);
  const out = pruneEmpty({
    ...formToHeader(f, "subclass", original),
    ...f.rest,
    class_id: f.classId,
    short_name: f.shortName.trim() || f.name.trim(),
    grants,
    choices,
    columns: formToColumns(f.columns),
    resources: formToResources(f.resources),
    spellcasting: formToSpellcasting(f.spellcasting),
    progression: formToProgression(structuredClone(f.progression), features, new Set(f.originalIds)),
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
