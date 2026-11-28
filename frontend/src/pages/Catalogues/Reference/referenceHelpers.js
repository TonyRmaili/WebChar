import { HOMEBREW, pruneEmpty, titleCase } from "../catalogueHelpers";
import { emptyHeaderForm, formToHeader, headerToForm } from "../catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   referenceHelpers — the three text-only catalogues (2026-11-25):

     rules     actions, conditions, diseases, statuses, senses, skills,
               rules (the glossary, optional and variant rules)
     lore      deities, languages, cults, demonic boons
     toolkit   traps, hazards, objects, vehicles and upgrades, rewards,
               bastion facilities, character options

   Every entry: the usual header (id, name, source, edition, text,
   aliases), its `kind`, and a few fields of its kind (KINDS below). The
   data comes from data_cleaning/cleaners/reference_cleaner.py; homebrew
   is made with ReferenceCardForm. One page (ReferencePage), one popup
   ("reference", ReferencePopup) and one form serve all three.
   ═══════════════════════════════════════════════════════════════════ */

/* A field: { key, label, type, options?, filter? }
     text    a short line ("Faerûnian")
     list    several words, a comma between them in the form
     number  a number
     choice  one of `options` (the form offers them; the data may hold others)
   filter: the catalogue's filter window offers it. */
const ABILITY_OPTIONS = ["str", "dex", "con", "int", "wis", "cha"];
const TRAP_FIELDS = [
  { key: "trap_type", label: "Type", type: "text", filter: true },
  { key: "tiers", label: "Tier", type: "list", filter: true },
  { key: "threat", label: "Threat", type: "choice", options: ["nuisance", "setback", "moderate", "dangerous", "deadly"], filter: true },
];

export const KINDS = {
  // rules
  action: { catalogue: "rules", label: "Action", fields: [{ key: "time", label: "Time", type: "text" }] },
  condition: { catalogue: "rules", label: "Condition", fields: [] },
  status: { catalogue: "rules", label: "Status", fields: [] },
  disease: { catalogue: "rules", label: "Disease", fields: [{ key: "disease_type", label: "Type", type: "text" }] },
  sense: { catalogue: "rules", label: "Sense", fields: [] },
  skill: { catalogue: "rules", label: "Skill", fields: [{ key: "ability", label: "Ability", type: "choice", options: ABILITY_OPTIONS, filter: true }] },
  rule: {
    catalogue: "rules", label: "Rule",
    fields: [{ key: "rule_type", label: "Rule type", type: "choice", options: ["core", "optional", "variant", "variant optional", "other"], filter: true }],
  },
  // lore
  deity: {
    catalogue: "lore", label: "Deity",
    fields: [
      { key: "pantheon", label: "Pantheon", type: "text", filter: true },
      { key: "title", label: "Title", type: "text" },
      { key: "alignment", label: "Alignment", type: "text", filter: true },
      { key: "domains", label: "Domains", type: "list", filter: true },
      { key: "symbol", label: "Symbol", type: "text" },
      { key: "province", label: "Province", type: "text" },
      { key: "deity_category", label: "Group", type: "text" },
      { key: "plane", label: "Plane", type: "text" },
      { key: "worshipers", label: "Worshipers", type: "text" },
    ],
  },
  language: {
    catalogue: "lore", label: "Language",
    fields: [
      { key: "language_type", label: "Type", type: "choice", options: ["standard", "rare", "exotic", "secret"], filter: true },
      { key: "script", label: "Script", type: "text", filter: true },
      { key: "typical_speakers", label: "Typical speakers", type: "text" },
      { key: "origin", label: "Origin", type: "text" },
    ],
  },
  cult: { catalogue: "lore", label: "Cult", fields: [{ key: "cult_type", label: "Type", type: "text", filter: true }] },
  boon: { catalogue: "lore", label: "Boon", fields: [{ key: "boon_type", label: "Type", type: "text", filter: true }] },
  // toolkit
  trap: { catalogue: "toolkit", label: "Trap", fields: TRAP_FIELDS },
  hazard: { catalogue: "toolkit", label: "Hazard", fields: TRAP_FIELDS },
  object: {
    catalogue: "toolkit", label: "Object",
    fields: [
      { key: "object_type", label: "Type", type: "text", filter: true },
      { key: "size", label: "Size", type: "text" },
    ],
  },
  vehicle: {
    catalogue: "toolkit", label: "Vehicle",
    fields: [
      { key: "vehicle_type", label: "Type", type: "text", filter: true },
      { key: "terrain", label: "Terrain", type: "list", filter: true },
    ],
  },
  vehicle_upgrade: { catalogue: "toolkit", label: "Vehicle upgrade", fields: [{ key: "upgrade_type", label: "Type", type: "text", filter: true }] },
  reward: {
    catalogue: "toolkit", label: "Reward",
    fields: [
      { key: "reward_type", label: "Type", type: "text", filter: true },
      { key: "rarity", label: "Rarity", type: "choice", options: ["common", "uncommon", "rare", "very rare", "legendary"] },
    ],
  },
  facility: {
    catalogue: "toolkit", label: "Bastion facility",
    fields: [
      { key: "facility_type", label: "Type", type: "choice", options: ["basic", "special"], filter: true },
      { key: "level", label: "Level", type: "number", filter: true },
      { key: "space", label: "Space", type: "list" },
      { key: "hirelings", label: "Hirelings", type: "text" },
      { key: "orders", label: "Orders", type: "list", filter: true },
    ],
  },
  character_option: { catalogue: "toolkit", label: "Character option", fields: [{ key: "option_type", label: "Type", type: "text", filter: true }] },
};

export const REFERENCE_CATALOGUES = {
  rules: { label: "Rules", one: "rule", store: "Rules", search: "search rules, actions, conditions…" },
  lore: { label: "Lore", one: "lore entry", store: "Lore", search: "search deities, languages, cults…" },
  toolkit: { label: "Toolkit", one: "toolkit entry", store: "Toolkit", search: "search traps, objects, vehicles, rewards…" },
};

export const kindsOf = (catalogue) => Object.keys(KINDS).filter((k) => KINDS[k].catalogue === catalogue);
export const kindLabel = (kind) => KINDS[kind]?.label || titleCase(String(kind || "entry").replace(/_/g, " "));
// Which catalogue an entry belongs to (its kind says; the deck and the store need it).
export const catalogueOf = (entry) => KINDS[entry?.kind]?.catalogue || "rules";

// A field's value as words: lists joined, tiers as "tier 1, 2", ability ids in full.
const ABILITY_WORDS = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
export const fieldWords = (field, value) => {
  if (value == null || value === "" || (Array.isArray(value) && !value.length)) return "";
  if (field.key === "ability") return ABILITY_WORDS[value] || String(value);
  if (Array.isArray(value)) return value.map(String).join(", ");
  return String(value);
};

// Values an entry gives a filter (lists one by one, as strings).
export const filterValues = (entry, key) => {
  const v = entry?.[key];
  if (v == null || v === "") return [];
  return (Array.isArray(v) ? v : [v]).map(String);
};

// The field said under the card's name: its first filter field that has a value.
const subtitleField = (entry) => (KINDS[entry?.kind]?.fields || []).find((f) => f.filter && fieldWords(f, entry[f.key]));

// Under the card's name: "Deity · Faerûnian", "Trap · Simple trap".
export const subtitleOf = (entry) => {
  const first = subtitleField(entry);
  return [kindLabel(entry?.kind), first ? fieldWords(first, entry[first.key]) : ""].filter(Boolean).join(" · ");
};

// The card's lines: [{ label, value }] for the fields this entry has (not the one under its name).
export const factsOf = (entry) => {
  const skip = subtitleField(entry)?.key;
  return (KINDS[entry?.kind]?.fields || [])
    .filter((f) => f.key !== skip)
    .map((f) => ({ label: f.label, value: fieldWords(f, entry[f.key]) }))
    .filter((r) => r.value);
};

// The list row's small words.
export const rowMeta = (entry) => subtitleOf(entry);

// ─── the form ───────────────────────────────────────────────────────

const HEADER_KEYS = ["id", "kind", "name", "source", "edition", "visibility", "text", "aliases", "tags", "campaigns", "created_by", "srd", "reprinted_as"];

export const emptyReferenceForm = (kind) => ({ ...emptyHeaderForm(), kind, fields: {}, rest: {} });

// Lists are typed as "a, b, c" in the form.
const toFieldForm = (field, value) => (value == null ? "" : field.type === "list" ? [].concat(value).join(", ") : String(value));
const fromFieldForm = (field, text) => {
  const s = String(text ?? "").trim();
  if (!s) return undefined;
  if (field.type === "number") return Number.isFinite(Number(s)) ? Number(s) : s;
  if (field.type === "list") {
    const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
    return field.key === "tiers" ? parts.map((x) => (Number.isFinite(Number(x)) ? Number(x) : x)) : parts;
  }
  return s;
};

export function referenceToForm(entry, { copy = false } = {}) {
  const fields = KINDS[entry.kind]?.fields || [];
  const own = new Set([...HEADER_KEYS, ...fields.map((f) => f.key)]);
  return {
    ...headerToForm(entry, { copy }),
    kind: entry.kind,
    fields: Object.fromEntries(fields.map((f) => [f.key, toFieldForm(f, entry[f.key])])),
    // whatever the form has no field for (a field of another kind) is kept
    rest: Object.fromEntries(Object.entries(entry).filter(([k]) => !own.has(k))),
  };
}

export function formToReference(form, original) {
  const fields = KINDS[form.kind]?.fields || [];
  return pruneEmpty({
    ...formToHeader(form, form.kind, original),
    ...Object.fromEntries(fields.map((f) => [f.key, fromFieldForm(f, form.fields[f.key])])),
    ...form.rest,
  });
}

export const isHomebrewEntry = (e) => e?.source === HOMEBREW;
