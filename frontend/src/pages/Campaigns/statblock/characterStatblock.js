import {
  ABILITIES,
  abilitiesOf,
  modOf,
  nextProf,
  pbOf,
  profLevel,
  saveTotal,
  scoreToMod,
  signed,
  skillAbilityShort,
  skillTotal,
  skillsOf,
  sortedSkills,
} from "../../Characters/sheet/define/abilityHelpers";
import {
  asList,
  attackTotals,
  effectChips,
  effectDamage,
  effectiveMaxHp,
  healthOf,
  initiativeTotal,
  ordinal,
  passivePerception,
  regainLabel,
  slotUses,
  sorceryUses,
  speedSummary,
  usesFromCharges,
  withChargesCurrent,
} from "../../Characters/sheet/play/playHelpers";
import { idGen, newEffect } from "../../Characters/sheet/define/effectEditor";
import { featFromCatalogue } from "../../Characters/sheet/define/featHelpers";
import { spellFromCatalogue } from "../../Characters/sheet/define/SpellCards";
import { addFromCatalogue } from "../../Characters/sheet/define/inventoryHelpers";

/* ═══════════════════════════════════════════════════════════════════
   characterStatblock.js — a saved character, as the statblock card sees it.

   The card (Statblock.jsx) never reads character JSON directly. It gets:

     characterView(raw)   what to draw. Rows that can be used, edited or
                          removed carry a `ref` = { list, id } saying
                          where they live in the JSON.
     CHARACTER_EDITS      get/set pairs for the single numbers (AC, HP,
                          scores, notes…).
     CHARACTER_ACTIONS    whole-row changes by `ref`: replace, remove,
                          spend/regain uses, and add from a catalogue.

   Every function returns a new raw object; nothing is changed in place.
   monsterStatblock.js has the same exports for monsters, so both draw
   with the same card.

   Numbers are worked out with the character sheet's own helpers, so the
   card and the sheet never disagree.
   ═══════════════════════════════════════════════════════════════════ */

const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};
const titleCase = (s) =>
  String(s ?? "")
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
const words = (list) => asList(list).map((v) => (typeof v === "string" ? titleCase(v) : v?.name || v?.type || "")).filter(Boolean);
const textOf = (entries) => (typeof entries === "string" ? entries : asList(entries).filter((e) => typeof e === "string").join("\n\n"));

/* ─── where each kind of row lives ───────────────────────────────── */

// list name → the object path that holds it ([] = top level).
const LIST_HOME = {
  effects: [],
  feats: [],
  spells: ["spellbook"],
  spellslots: ["spellbook"],
  pactslots: ["spellbook"],
  magic: ["inventory"],
  mundane: ["inventory"],
};

const containerOf = (raw, list) => (LIST_HOME[list].length ? raw?.[LIST_HOME[list][0]] || {} : raw || {});
const listOf = (raw, list) => asList(containerOf(raw, list)[list]);
const withList = (raw, list, rows) => {
  const [home] = LIST_HOME[list];
  return home ? { ...raw, [home]: { ...(raw?.[home] || {}), [list]: rows } } : { ...raw, [list]: rows };
};

/* ─── header ─────────────────────────────────────────────────────── */

const raceLine = (c) => c?.race?.subrace || c?.race?.name || "";

const classLine = (c) =>
  asList(c?.classes)
    .filter((k) => k?.class_name)
    .map((k) => `${titleCase(k.class_name)} ${toInt(k.level, 0)}${k.subclass ? ` (${k.subclass})` : ""}`)
    .join(" / ");

const alignmentLine = (c) => {
  const a = c?.character_profile?.alignment || {};
  const parts = [a.prefix, a.suffix].map((p) => String(p || "").trim()).filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === "neutral" && parts[1].toLowerCase() === "neutral") return "True Neutral";
  return titleCase(parts.join(" "));
};

/* ─── what it can do ─────────────────────────────────────────────── */

// Traits are the effect and feat rows set to "Passive"; the rest go by
// what they're used as.
const SECTIONS = [
  { key: "passive", title: "Traits" },
  { key: "action", title: "Actions" },
  { key: "bonus_action", title: "Bonus Actions" },
  { key: "reaction", title: "Reactions" },
];
const sectionKey = (row) => (SECTIONS.some((s) => s.key === row.action_type) ? row.action_type : "action");

function entryFrom(c, list, row) {
  const uses = usesFromCharges(row.charges);
  const parts = effectChips(c, row).map((chip) => chip.text);
  const damage = effectDamage(c, row);
  if (damage) parts.push(damage);
  return {
    ref: { list, id: row.id },
    name: row.name || "Unnamed",
    tag: list === "feats" ? "feat" : null,
    catalogue: list === "feats" && row.source ? { type: "feat", name: row.name, source: row.source } : null,
    roll: parts.join(" · "),
    uses,
    regain: uses ? regainLabel(row.charges?.reset_amount, uses.max) : "",
    text: String(row.notes || "").replace(/^#+\s*/gm, "").trim(),
  };
}

function sectionsOf(c, editing) {
  const rows = [
    ...asList(c?.effects).map((r) => ["effects", r]),
    ...asList(c?.feats).map((r) => ["feats", r]),
  ].filter(([, r]) => r && (editing || r.active === true));
  return SECTIONS.map((s) => ({
    key: s.key,
    title: s.title,
    entries: rows.filter(([, r]) => sectionKey(r) === s.key).map(([list, r]) => ({ ...entryFrom(c, list, r), inactive: r.active !== true })),
  })).filter((s) => s.entries.length > 0);
}

function spellcastingOf(c) {
  const book = c?.spellbook || {};
  const slotRow = (list, label) => (r) => ({ ref: { list, id: r.id }, label, level: toInt(r.level, 0), max: toInt(r.slots_max, 0), cur: slotUses(r)?.cur ?? 0 });
  const slots = [
    ...listOf(c, "spellslots").filter((r) => r?.id).map((r) => slotRow("spellslots", ordinal(r.level))(r)),
    ...listOf(c, "pactslots").filter((r) => r?.id).map((r) => slotRow("pactslots", `pact ${ordinal(r.level)}`)(r)),
  ].sort((a, b) => (a.ref.list === b.ref.list ? a.level - b.level : a.ref.list === "pactslots" ? 1 : -1));

  const spells = listOf(c, "spells").filter((s) => s?.name);
  const byLevel = new Map();
  for (const s of spells) {
    const lvl = toInt(s.level, 0);
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    const max = toInt(s.uses?.max, 0);
    byLevel.get(lvl).push({
      ref: { list: "spells", id: s.id },
      name: s.name,
      catalogue: s.source ? { type: "spell", name: s.name, source: s.source } : null,
      innate: !!s.innate,
      uses: s.innate && max > 0 ? { max, cur: Math.min(max, Math.max(0, toInt(s.uses.current, max))) } : null,
    });
  }
  const lists = [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lvl, rows]) => ({ label: lvl === 0 ? "Cantrips" : `${ordinal(lvl)} level`, spells: rows.sort((a, b) => a.name.localeCompare(b.name)) }));

  const spell = attackTotals(c).find((a) => a.type === "spell");
  const ability = spell?.base || "cha";
  const dc = 8 + pbOf(c) + (scoreToMod(c?.ability_scores?.[ability]?.score) ?? 0) + toInt(c?.offense?.spell?.mod, 0);

  return {
    empty: !spells.length && !slots.some((s) => s.max > 0),
    line: `${ability.toUpperCase()} · spell save DC ${dc} · ${signed(spell?.total ?? 0)} to hit`,
    slots,
    sorcery: sorceryUses(book.sorcery_points),
    lists,
  };
}

const COIN_KEYS = ["pp", "gp", "ep", "sp", "cp"];

function equipmentOf(c) {
  const inv = c?.inventory || {};
  const magic = listOf(c, "magic")
    .filter((m) => m?.name)
    .map((m) => ({
      ref: { list: "magic", id: m.id },
      name: m.name,
      catalogue: m.source ? { type: "item", name: m.name, source: m.source } : null,
      attuned: !!m.attuned,
      uses: usesFromCharges(m.charges),
      regain: usesFromCharges(m.charges) ? regainLabel(m.charges?.reset_amount, usesFromCharges(m.charges).max) : "",
    }));
  const gear = listOf(c, "mundane")
    .filter((m) => m?.name)
    .map((m) => ({
      ref: { list: "mundane", id: m.id },
      name: m.name,
      catalogue: m.source ? { type: "item", name: m.name, source: m.source } : null,
      amount: toInt(m.amount, 1),
    }));
  const coins = COIN_KEYS.map((k) => ({ key: k, amount: toInt(inv.currency?.[k], 0) }));
  return { empty: !magic.length && !gear.length && !coins.some((x) => x.amount > 0), magic, gear, coins };
}

const ABOUT_FIELDS = [
  ["appearance", "Appearance"],
  ["personality_traits", "Personality"],
  ["ideals", "Ideals"],
  ["bonds", "Bonds"],
  ["flaws", "Flaws"],
  ["backstory", "Backstory"],
];

/* ─── the view ───────────────────────────────────────────────────── */

export function characterView(c, { editing = false } = {}) {
  const abilities = abilitiesOf(c);
  const skills = skillsOf(c);
  const pb = pbOf(c);
  const health = healthOf(c);
  const speed = speedSummary(c);
  const level = asList(c?.classes).reduce((sum, k) => sum + toInt(k?.level, 0), 0) || toInt(c?.total_level, 0);

  const saves = ABILITIES.filter((a) => abilities[a.key]?.proficient).map((a) => `${a.short} ${signed(saveTotal(abilities[a.key], pb))}`);
  const skillList = sortedSkills(skills)
    .filter(([, row]) => row.proficient || row.expertise)
    .map(([, row]) => `${row.label} ${signed(skillTotal(row, abilities, pb))}${row.expertise ? "†" : ""}`);
  const senses = Object.entries(c?.senses || {})
    .filter(([k, v]) => k !== "devilsight" && toInt(v, 0) > 0)
    .map(([k, v]) => `${titleCase(k)} ${toInt(v, 0)} ft`);
  senses.push(`passive Perception ${passivePerception(c)}`);
  const defenses = c?.defenses || {};

  const lines = [
    { label: "Saving Throws", text: saves.join(", ") },
    { label: "Skills", text: skillList.join(", ") + (skillList.some((s) => s.endsWith("†")) ? "  († expertise)" : "") },
    { label: "Resistances", text: words(defenses.resistances).join(", ") },
    { label: "Immunities", text: words(defenses.immunities).join(", ") },
    { label: "Vulnerabilities", text: words(defenses.vulnerabilities).join(", ") },
    { label: "Senses", text: senses.join(", ") },
    { label: "Languages", text: words(c?.language_proficiencies).join(", ") },
    { label: "Armor", text: words(c?.armor_proficiencies).join(", ") },
    { label: "Weapons", text: words(c?.weapon_proficiencies).join(", ") },
    { label: "Tools", text: words(c?.tool_proficiencies).join(", ") },
  ].filter((l) => l.text);

  const profile = c?.character_profile || {};

  return {
    kind: "character",
    name: c?.name || "Unnamed",
    subtitle: [raceLine(c), classLine(c), alignmentLine(c)].filter(Boolean).join(" · "),
    // `inputs` / `extra` are what the card shows for a vital while editing
    // (names from CHARACTER_EDITS); `editSub` is its small line then.
    vitals: [
      {
        key: "ac",
        label: "Armor Class",
        value: c?.ac !== "" && Number.isFinite(Number(c?.ac)) ? String(toInt(c.ac)) : "—",
        inputs: [{ edit: "ac", label: "Armor class", min: 0, max: 40 }],
      },
      {
        key: "hp",
        label: "Hit Points",
        value: String(toInt(health.current_hp, 0)),
        sub: `of ${effectiveMaxHp(health)}${toInt(health.temp_hp, 0) > 0 ? ` · ${toInt(health.temp_hp, 0)} temp` : ""}`,
        inputs: [{ edit: "hpCurrent", label: "Current hit points", min: 0 }, { text: "of" }, { edit: "hpMax", label: "Maximum hit points", min: 0, size: "md" }],
        extra: [{ text: "temp" }, { edit: "hpTemp", label: "Temporary hit points", min: 0, size: "sm" }],
      },
      {
        key: "speed",
        label: "Speed",
        value: `${speed.walk} ft`,
        sub: speed.others.join(", ") || null,
        inputs: [{ edit: "speed", label: "Walking speed", min: 0, step: 5 }, { text: "ft" }],
        editSub: speed.others.join(", ") || null,
      },
      {
        key: "initiative",
        label: "Initiative",
        value: signed(initiativeTotal(c)),
        inputs: [{ text: "DEX +" }, { edit: "initiativeBonus", label: "Initiative bonus", size: "md" }],
        editSub: `total ${signed(initiativeTotal(c))}`,
      },
      { key: "pb", label: "Proficiency", value: signed(pb), editSub: "from level" },
      { key: "level", label: "Level", value: String(level || "—"), editSub: "from the classes" },
    ],
    abilities: ABILITIES.map((a) => ({
      key: a.key,
      short: a.short.toUpperCase(),
      score: abilities[a.key]?.score ?? null,
      mod: signed(modOf(abilities[a.key])),
      save: signed(saveTotal(abilities[a.key], pb)),
      saveProf: !!abilities[a.key]?.proficient,
    })),
    skillMode: "proficiency",
    skills: sortedSkills(skills).map(([key, row]) => ({
      key,
      label: row.label,
      ability: skillAbilityShort(row),
      total: signed(skillTotal(row, abilities, pb)),
      level: profLevel(row),
    })),
    lines,
    sections: sectionsOf(c, editing),
    spellcasting: spellcastingOf(c),
    equipment: equipmentOf(c),
    about: ABOUT_FIELDS.map(([k, label]) => ({ label, text: String(profile[k] || "").trim() })).filter((a) => a.text),
    notes: String(c?.dm_notes || ""),
    notesPlaceholder: "Who they are to the party, what they want, how they act at the table…",
    editingNote: "Editing this copy only — the player's own character is not touched.",
  };
}

/* ─── single numbers ─────────────────────────────────────────────── */

const withHealth = (c, patch) => ({ ...c, health: { ...healthOf(c), ...patch } });
const withAbility = (c, key, patch) => {
  const abilities = abilitiesOf(c);
  const row = { ...abilities[key], ...patch };
  return { ...c, ability_scores: { ...abilities, [key]: { ...row, mod: scoreToMod(row.score) } } };
};

export const CHARACTER_EDITS = {
  name: { get: (c) => c?.name ?? "", set: (c, v) => ({ ...c, name: v }) },
  ac: { get: (c) => toInt(c?.ac, null), set: (c, v) => ({ ...c, ac: v ?? 0 }) },
  hpCurrent: { get: (c) => toInt(healthOf(c).current_hp, 0), set: (c, v) => withHealth(c, { current_hp: v ?? 0 }) },
  hpMax: { get: (c) => toInt(healthOf(c).max_hp, 0), set: (c, v) => withHealth(c, { max_hp: v ?? 0 }) },
  hpTemp: { get: (c) => toInt(healthOf(c).temp_hp, 0), set: (c, v) => withHealth(c, { temp_hp: v ?? 0 }) },
  speed: { get: (c) => toInt(c?.speed?.walk, 0), set: (c, v) => ({ ...c, speed: { ...(c?.speed || {}), walk: v ?? 0 } }) },
  initiativeBonus: {
    get: (c) => toInt(c?.initiative?.mod, 0),
    set: (c, v) => ({ ...c, initiative: { ...(c?.initiative || {}), mod: v ?? 0 } }),
  },
  score: {
    get: (c, key) => abilitiesOf(c)[key]?.score ?? null,
    set: (c, key, v) => withAbility(c, key, { score: v }),
  },
  saveProf: {
    get: (c, key) => !!abilitiesOf(c)[key]?.proficient,
    set: (c, key, v) => withAbility(c, key, { proficient: v }),
  },
  // none → proficient → expertise → none, like the Abilities tab.
  skillProf: {
    cycle: (c, key) => {
      const skills = skillsOf(c);
      return { ...c, skills: { ...skills, [key]: { ...skills[key], ...nextProf(skills[key]) } } };
    },
  },
  coin: {
    get: (c, key) => toInt(c?.inventory?.currency?.[key], 0),
    set: (c, key, v) => ({ ...c, inventory: { ...(c?.inventory || {}), currency: { ...(c?.inventory?.currency || {}), [key]: Math.max(0, v ?? 0) } } }),
  },
  notes: { get: (c) => c?.dm_notes ?? "", set: (c, v) => ({ ...c, dm_notes: v }) },
};

/* ─── whole rows ─────────────────────────────────────────────────── */

const newEffectRow = () => ({ ...newEffect("action"), trait: "standard" });

// A catalogue optional feature (fighting style, invocation, maneuver…)
// becomes an effect row with its text as notes; how it's used is set by hand.
const optionalFeatureRow = (f) => ({
  ...newEffect("passive"),
  name: f.name,
  trait: "class",
  source: f.source ?? null,
  notes: textOf(f.entries),
});

const nextSlotLevel = (rows) => Math.min(9, rows.reduce((m, r) => Math.max(m, toInt(r.level, 0)), 0) + 1);

export const CHARACTER_ACTIONS = {
  row: (c, ref) => listOf(c, ref.list).find((r) => r?.id === ref.id) || null,

  replace: (c, ref, next) => withList(c, ref.list, listOf(c, ref.list).map((r) => (r?.id === ref.id ? next : r))),

  remove: (c, ref) => withList(c, ref.list, listOf(c, ref.list).filter((r) => r?.id !== ref.id)),

  setAmount: (c, ref, amount) => {
    const row = CHARACTER_ACTIONS.row(c, ref);
    return row ? CHARACTER_ACTIONS.replace(c, ref, { ...row, amount: Math.max(0, amount ?? 0) }) : c;
  },

  // Spend or regain: `cur` is the new number left.
  setUses: (c, ref, cur) => {
    if (ref.list === "sorcery") {
      const sp = c?.spellbook?.sorcery_points || {};
      return { ...c, spellbook: { ...(c?.spellbook || {}), sorcery_points: { ...sp, current_charges: cur } } };
    }
    const row = CHARACTER_ACTIONS.row(c, ref);
    if (!row) return c;
    let next;
    if (ref.list === "spellslots" || ref.list === "pactslots") next = { ...row, slots_current: cur };
    else if (ref.list === "spells") next = { ...row, uses: { ...(row.uses || {}), current: cur } };
    else next = withChargesCurrent(row, cur);
    return CHARACTER_ACTIONS.replace(c, ref, next);
  },

  // Slots: change how many a level has (current follows when it was full or above).
  setSlotMax: (c, ref, max) => {
    const row = CHARACTER_ACTIONS.row(c, ref);
    if (!row) return c;
    const m = Math.max(0, max ?? 0);
    const cur = toInt(row.slots_current, toInt(row.slots_max, 0));
    return CHARACTER_ACTIONS.replace(c, ref, { ...row, slots_max: m, slots_current: Math.min(cur, m) });
  },

  addSlotLevel: (c, list = "spellslots") => {
    const rows = listOf(c, list);
    const row = { id: idGen(), level: nextSlotLevel(rows), slots_max: 1, slots_current: 1 };
    return { raw: withList(c, list, [...rows, row]), ref: { list, id: row.id } };
  },

  // Adding. Each returns { raw, ref } so the card can open what was added.
  add: (c, kind, entry) => {
    if (kind === "own") {
      const row = newEffectRow();
      return { raw: withList(c, "effects", [...listOf(c, "effects"), row]), ref: { list: "effects", id: row.id }, open: true };
    }
    if (kind === "feat") {
      const row = featFromCatalogue(entry);
      return { raw: withList(c, "feats", [...listOf(c, "feats"), row]), ref: { list: "feats", id: row.id }, open: true };
    }
    if (kind === "optionalFeature") {
      const row = optionalFeatureRow(entry);
      return { raw: withList(c, "effects", [...listOf(c, "effects"), row]), ref: { list: "effects", id: row.id }, open: true };
    }
    if (kind === "spell") {
      const row = spellFromCatalogue(entry);
      return { raw: withList(c, "spells", [...listOf(c, "spells"), row]), ref: { list: "spells", id: row.id } };
    }
    if (kind === "item") {
      const res = addFromCatalogue(c?.inventory || {}, entry);
      return { raw: { ...c, inventory: res.inv }, ref: { list: res.list, id: res.id } };
    }
    return { raw: c, ref: null };
  },

  // Already on the statblock? (feats and spells; items stack instead)
  has: (c, kind, entry) => {
    const same = (r) => String(r?.name || "").toLowerCase() === String(entry?.name || "").toLowerCase() && (r?.source || null) === (entry?.source || null);
    if (kind === "feat") return listOf(c, "feats").some(same);
    if (kind === "spell") return listOf(c, "spells").some(same);
    if (kind === "optionalFeature") return listOf(c, "effects").some(same);
    return false;
  },
};

// What "Add from the catalogue" offers on a character's card.
export const CHARACTER_ADD_KINDS = [
  { kind: "feat", label: "feat" },
  { kind: "optionalFeature", label: "optional feature" },
  { kind: "item", label: "item" },
  { kind: "spell", label: "spell" },
];