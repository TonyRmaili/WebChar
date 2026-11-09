import { ABILITY, ABILITY_ORDER, CR_OPTIONS, titleCase } from "../../Catalogues/Monsters/monsterHelpers";
import { CONDITION_OPTIONS, DAMAGE_TYPES, LANGUAGE_OPTIONS, SKILL_OPTIONS } from "../../../utils/Constants";
import { MONSTER_EDITS, SIZES, equipmentOf, sectionsOf, spellcastingOf } from "../statblock/monsterStatblock";

/* ═══════════════════════════════════════════════════════════════════
   templateStatblock.js — a template on the statblock card.

   A template is "a statblock without a creature". Its grants are kept in
   the same layout as a monster's (effects, spellcasting, gear,
   resistances…), so the monster actions and row editor work on it as
   they are. On top of that:

     adjust  { ac, hp, hp_percent, initiative, to_hit, damage, save_dc,
               spell_dc, spell_attack,
               abilities: { str: 2 }, speed: { walk: 10 }, skills: { perception: 2 } }
     saves   ["wis"]                       save proficiencies it gives
     speed   { fly: 30, hover: true }      speeds it gives (higher wins)
     senses  { darkvision: 60 }            senses it gives (higher wins)
     extra_damage { dice_count, dice_size, damage_type } on every attack
     set     { type, size, alignment, cr } what the creature becomes
     affix   { prefix, suffix }            "Ghostly Goblin"

   Same exports as the other adapters: view, EDITS (ACTIONS are the
   monster ones). How it is laid on creatures: templateLogic.js.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};
const sgn = (n) => (n ? `${n > 0 ? "+" : "−"}${Math.abs(n)}` : "—");

export const newTemplate = (name = "New template") => ({ name, notes: "", adjust: {}, effects: {}, spellcasting: [], gear: [] });

/* ─── reading nested numbers: "abilities.str", "speed.walk", "ac" ── */

const readPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
function writePath(obj, path, v) {
  const [head, ...rest] = path.split(".");
  if (!rest.length) {
    const out = { ...(obj || {}) };
    if (v == null || v === 0) delete out[head];
    else out[head] = v;
    return out;
  }
  return { ...(obj || {}), [head]: writePath(obj?.[head], rest.join("."), v) };
}

const adj = (t, path) => toInt(readPath(t?.adjust, path), 0);

/* ─── the view ───────────────────────────────────────────────────── */

const NUMBER = (key, label, path, opts = {}) => ({
  key,
  label,
  value: opts.value ?? `${sgn(adj(opts.t, path))}${opts.unit && adj(opts.t, path) ? ` ${opts.unit}` : ""}`,
  inputs: [{ edit: "adjust", arg: path, label, min: -99, max: 99, fallback: null, size: "md" }, ...(opts.unit ? [{ text: opts.unit }] : [])],
  editSub: opts.editSub ?? null,
  sub: opts.sub ?? null,
});

export function templateView(t, { editing = false } = {}) {
  const a = t?.adjust || {};
  const pct = toInt(a.hp_percent, 0);
  const extra = t?.extra_damage;
  const hasExtra = extra && toInt(extra.dice_count, 0) > 0 && extra.dice_size;
  const set = t?.set || {};
  const affix = t?.affix || {};
  const fields = (list) => ({ type: "fields", fields: list });

  const skillAdj = Object.entries(a.skills || {}).filter(([, v]) => toInt(v, 0));
  const grantedSpeeds = Object.entries(t?.speed || {}).filter(([k, v]) => k !== "hover" && toInt(v, 0) > 0).map(([k, v]) => `${k} ${v} ft`);
  if (t?.speed?.hover) grantedSpeeds.push("hover");

  const lines = [
    {
      label: "Name",
      text: affix.prefix || affix.suffix ? [affix.prefix, "…", affix.suffix].filter(Boolean).join(" ") : "",
      editor: fields([
        { kind: "text", edit: "affix", arg: "prefix", label: "before the name", placeholder: "Ghostly" },
        { kind: "text", edit: "affix", arg: "suffix", label: "after", placeholder: "Champion" },
      ]),
    },
    {
      label: "Becomes",
      text: [SIZES.find((s) => s.value === set.size)?.label, set.type && titleCase(set.type), set.alignment, set.cr && `CR ${set.cr}`].filter(Boolean).join(" · "),
      editor: fields([
        { kind: "select", edit: "setField", arg: "size", label: "size", options: [{ value: "", label: "as it is" }, ...SIZES] },
        { kind: "text", edit: "setField", arg: "type", label: "type", placeholder: "undead" },
        { kind: "text", edit: "setField", arg: "alignment", label: "alignment", placeholder: "Neutral Evil", wide: true },
        { kind: "select", edit: "setField", arg: "cr", label: "challenge", options: [{ value: "", label: "as it is" }, ...CR_OPTIONS.map((c) => ({ value: c, label: c }))] },
      ]),
    },
    {
      label: "Save proficiencies",
      text: asList(t?.saves).map((s) => ABILITY[s] || s).join(", "),
      editor: { type: "chips", edit: "list", arg: "saves", options: ABILITY_ORDER },
    },
    { label: "Skill adjustments", text: editing ? null : skillAdj.map(([k, v]) => `${SKILL_OPTIONS[k]?.label || titleCase(k)} ${sgn(toInt(v, 0))}`).join(", ") },
    { label: "Resistances", text: asList(t?.resistances?.types).join(", "), editor: { type: "chips", edit: "list", arg: "resistances", options: DAMAGE_TYPES } },
    { label: "Immunities", text: asList(t?.immunities?.types).join(", "), editor: { type: "chips", edit: "list", arg: "immunities", options: DAMAGE_TYPES } },
    { label: "Vulnerabilities", text: asList(t?.vulnerabilities?.types).join(", "), editor: { type: "chips", edit: "list", arg: "vulnerabilities", options: DAMAGE_TYPES } },
    {
      label: "Condition Immunities",
      text: asList(t?.condition_immunities?.types).join(", "),
      editor: { type: "chips", edit: "list", arg: "condition_immunities", options: CONDITION_OPTIONS.map((c) => c.toLowerCase()) },
    },
    {
      label: "Senses",
      text: Object.entries(t?.senses || {}).filter(([, v]) => toInt(v, 0) > 0).map(([k, v]) => `${titleCase(k)} ${v} ft`).join(", "),
      editor: fields(["darkvision", "blindsight", "tremorsense", "truesight"].map((k) => ({ kind: "number", edit: "sense", arg: k, label: k, suffix: "ft" }))),
    },
    {
      label: "Gains speeds",
      text: grantedSpeeds.join(", "),
      editor: fields([...["fly", "swim", "climb", "burrow"].map((k) => ({ kind: "number", edit: "speedMode", arg: k, label: k, suffix: "ft", step: 5 })), { kind: "mark", edit: "hover", label: "hover" }]),
    },
    { label: "Languages", text: asList(t?.languages).join(", "), editor: { type: "chips", edit: "list", arg: "languages", options: LANGUAGE_OPTIONS, keepCase: true } },
    {
      label: "Extra damage on attacks",
      text: hasExtra ? `+${extra.dice_count}${extra.dice_size} ${extra.damage_type || ""}`.trim() : "",
      editor: fields([
        { kind: "number", edit: "extra", arg: "dice_count", label: "dice", min: 0, max: 20 },
        { kind: "select", edit: "extra", arg: "dice_size", label: "die", options: [{ value: "", label: "—" }, ...["d4", "d6", "d8", "d10", "d12"].map((d) => ({ value: d, label: d }))] },
        { kind: "select", edit: "extra", arg: "damage_type", label: "type", options: [{ value: "", label: "—" }, ...DAMAGE_TYPES.map((d) => ({ value: d, label: d }))] },
      ]),
    },
  ].filter((l) => (editing ? l.editor : l.text));

  // A template has no uses of its own: show what a row does, not dots.
  const sections = sectionsOf(t, editing).map((s) => ({ ...s, entries: s.entries.map((e) => ({ ...e, uses: null })) }));

  return {
    kind: "template",
    name: t?.name || "Unnamed template",
    subtitle: `Template · ${t?.scope === "all" ? "for all your campaigns" : "this campaign only"}`,
    foldTitles: { base: "Adjustments", lines: "Grants & changes" },
    vitals: [
      NUMBER("ac", "Armor Class", "ac", { t }),
      {
        key: "hp",
        label: "Hit Points",
        value: [adj(t, "hp") ? sgn(adj(t, "hp")) : "", pct ? `${sgn(pct)}%` : ""].filter(Boolean).join(" · ") || "—",
        inputs: [
          { edit: "adjust", arg: "hp", label: "Hit points", min: -999, max: 999, fallback: null, size: "md" },
          { text: "and" },
          { edit: "adjust", arg: "hp_percent", label: "Hit points percent", min: -90, max: 500, fallback: null, size: "md" },
          { text: "%" },
        ],
      },
      NUMBER("initiative", "Initiative", "initiative", { t }),
      NUMBER("speed", "Speed", "speed.walk", { t, unit: "ft", editSub: "walking; other speeds below" }),
      NUMBER("to_hit", "To hit", "to_hit", { t, editSub: "on all attacks" }),
      NUMBER("damage", "Damage", "damage", { t, editSub: "on all attacks" }),
      NUMBER("save_dc", "Save DCs", "save_dc", { t, editSub: "of its abilities" }),
      NUMBER("spell_dc", "Spell save DC", "spell_dc", { t }),
      NUMBER("spell_attack", "Spell attack", "spell_attack", { t }),
      ...ABILITY_ORDER.map((ab) => NUMBER(ab, ABILITY[ab], `abilities.${ab}`, { t })),
    ],
    abilities: [],
    skillMode: "bonus",
    skills: editing
      ? Object.entries(SKILL_OPTIONS).map(([key, s]) => {
          const v = toInt(a.skills?.[key], 0);
          return { key, label: s.label, ability: ABILITY[s.ability] || "", bonus: v || null, total: v ? sgn(v) : "" };
        })
      : [],
    skillsHint: "Skills — how much to add or take off (blank = no change)",
    lines,
    sections,
    spellcasting: spellcastingOf(t),
    equipment: equipmentOf(t),
    about: [],
    notes: String(t?.notes || ""),
    notesPlaceholder: "What it is and when to use it…",
    editingNote: "Editing the template — every creature that has it changes too.",
  };
}

/* ─── single values ──────────────────────────────────────────────── */

export const TEMPLATE_EDITS = {
  name: { get: (t) => t?.name ?? "", set: (t, v) => ({ ...t, name: v }) },
  adjust: {
    get: (t, path) => {
      const v = toInt(readPath(t?.adjust, path), 0);
      return v || null;
    },
    set: (t, path, v) => ({ ...t, adjust: writePath(t?.adjust, path, v) }),
  },
  skillBonus: {
    get: (t, key) => toInt(t?.adjust?.skills?.[key], 0) || null,
    set: (t, key, v) => ({ ...t, adjust: writePath(t?.adjust, `skills.${key}`, v) }),
  },
  setField: {
    get: (t, key) => t?.set?.[key] ?? "",
    set: (t, key, v) => {
      const next = { ...(t?.set || {}) };
      if (v) next[key] = v;
      else delete next[key];
      return { ...t, set: next };
    },
  },
  affix: {
    get: (t, key) => t?.affix?.[key] ?? "",
    set: (t, key, v) => ({ ...t, affix: { ...(t?.affix || {}), [key]: v } }),
  },
  extra: {
    get: (t, key) => (key === "dice_count" ? toInt(t?.extra_damage?.dice_count, 0) || null : t?.extra_damage?.[key] ?? ""),
    set: (t, key, v) => ({ ...t, extra_damage: { ...(t?.extra_damage || {}), [key]: v } }),
  },
  list: {
    get: (t, key) => (key === "saves" || key === "languages" ? asList(t?.[key]) : asList(t?.[key]?.types)),
    set: (t, key, values) => (key === "saves" || key === "languages" ? { ...t, [key]: values } : { ...t, [key]: { ...(t?.[key] || {}), types: values } }),
  },
  sense: MONSTER_EDITS.sense,
  speedMode: MONSTER_EDITS.speedMode,
  hover: MONSTER_EDITS.hover,
  notes: { get: (t) => t?.notes ?? "", set: (t, v) => ({ ...t, notes: v }) },
};