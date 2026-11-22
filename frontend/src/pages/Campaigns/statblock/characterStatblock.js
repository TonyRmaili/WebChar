import { actionWords, regainWords } from "../../../utils/featureRuntime";
import { currentHp, derivedOf } from "../../../utils/derive";
import {
  LEVEL_WORD,
  asList,
  labelOf,
  manualOf,
  nextLevel,
  setDistance,
  setHas,
  setManualAdd,
  setManualSet,
  setSkillLevel,
  signed,
  stateOf,
  withManual,
  manualAdd,
} from "../../Characters/sheet/sheetHelpers";
import { featureRows, newOwnFeature, resourceRows, usesKey } from "../../Characters/sheet/featureHelpers";
import { ORDINAL, addSpell, pactRows, slotRows, spellRows } from "../../Characters/sheet/spellbookHelpers";
import { addFromCatalogue, chargesOf, inventoryOf, isMagic, regainText } from "../../Characters/sheet/define/inventoryHelpers";

/* ═══════════════════════════════════════════════════════════════════
   characterStatblock.js — a saved character (version-2 file), as the
   statblock card sees it.

   The card (Statblock.jsx) never reads character JSON directly. It gets:

     characterView(raw)   what to draw. Rows that can be used, edited or
                          removed carry a `ref` = { list, id } saying
                          where they live:
                            features  id = "<from>#<feature id>"
                            spells    id = "<from>#<spell id>"
                            slots     id = the spell level   (pact: the pact slot level)
                            pool      id = the resource id (Rage, Focus Points…)
                            items     id = the inventory row id
     CHARACTER_EDITS      get/set pairs for the single numbers (AC, HP,
                          scores, notes…).
     CHARACTER_ACTIONS    whole-row changes by `ref`: replace, remove,
                          spend/regain uses, and add from a catalogue.

   Every function returns a new raw object; nothing is changed in place.
   The numbers are the character sheet's own (utils/derive.js and the
   sheet's helpers), so the card and the sheet never disagree. Changes
   go where the sheet puts them: the manual layer, `state`, the copies.
   monsterStatblock.js has the same exports for monsters, so both draw
   with the same card.
   ═══════════════════════════════════════════════════════════════════ */

const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};
const ABILITY_ROWS = [
  ["str", "Str"],
  ["dex", "Dex"],
  ["con", "Con"],
  ["int", "Int"],
  ["wis", "Wis"],
  ["cha", "Cha"],
];
const list = (ids) => asList(ids).map(labelOf).join(", ");

// "<from>#<id>" → [from, id]
const splitKey = (key) => {
  const i = String(key).lastIndexOf("#");
  return [key.slice(0, i), key.slice(i + 1)];
};

/* ─── header ─────────────────────────────────────────────────────── */

const originLabel = (c, prefix) => asList(c?.layers).find((l) => String(l?.from || "").startsWith(prefix))?.label || "";
const raceLine = (c) => originLabel(c, "race:") && (asList(c.layers).find((l) => /\/subrace:/.test(l?.from || ""))?.label || originLabel(c, "race:"));
const classLine = (d) => d.classes.map((k) => `${k.name} ${k.level}${k.subclass_name ? ` (${k.subclass_name})` : ""}`).join(" / ");
const alignmentLine = (c) => {
  const a = c?.profile?.alignment || {};
  const parts = [a.prefix, a.suffix].map((p) => String(p || "").trim()).filter(Boolean);
  if (parts.length === 2 && parts.every((p) => p.toLowerCase() === "neutral")) return "True Neutral";
  return parts.map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
};

/* ─── what it can do ─────────────────────────────────────────────── */

const SECTIONS = [
  { key: "traits", title: "Traits" },
  { key: "actions", title: "Actions" },
  { key: "bonus_actions", title: "Bonus Actions" },
  { key: "reactions", title: "Reactions" },
];

function sectionsOf(c, d, editing) {
  const rows = featureRows(c, d).filter((r) => editing || r.active);
  const pools = resourceRows(c, d);
  return SECTIONS.map((s) => ({
    key: s.key,
    title: s.title,
    entries: rows
      .filter((r) => r.category === s.key)
      .map((r) => ({
        ref: { list: "features", id: r.key },
        name: r.feature.name || "Unnamed",
        tag: r.kind === "feat" || r.feature.feat ? "feat" : r.isToggle ? (r.on ? "on" : "toggle") : null,
        catalogue: null,
        roll: [actionWords(r.action), r.consumes ? `${r.consumes.amount} ${r.consumes.name}` : ""].filter(Boolean).join(" · "),
        uses: r.uses ? { cur: r.uses.cur, max: r.uses.max } : null,
        regain: r.uses ? regainWords(r.feature.uses) : r.consumes ? `${r.consumes.name}: ${r.consumes.cur}/${r.consumes.max}` : "",
        text: typeof r.feature.text === "string" ? r.feature.text.replace(/^#+\s*/gm, "").trim() : "",
        inactive: !r.active,
        featureRow: r, // for the row editor (the sheet's own FeatureEditor)
        pools,
      })),
  })).filter((s) => s.entries.length > 0);
}

function spellcastingOf(c, d) {
  const slots = [
    ...slotRows(c, d).map((s) => ({ ref: { list: "slots", id: String(s.level) }, label: ORDINAL[s.level], level: s.level, max: s.max, cur: s.cur })),
    ...pactRows(c, d).map((p) => ({ ref: { list: "pact", id: String(p.level) }, label: `pact ${ORDINAL[p.level]}`, level: p.level, max: p.max, cur: p.cur })),
    ...resourceRows(c, d)
      .filter((p) => p.max > 0)
      .map((p) => ({ ref: { list: "pool", id: p.id }, label: `${p.name}${p.die ? ` (${p.die})` : ""}`, level: 99, max: p.max, cur: p.cur })),
  ];
  const spells = spellRows(c, d).filter((r) => r.reached);
  const byLevel = new Map();
  for (const r of spells) {
    if (!byLevel.has(r.level)) byLevel.set(r.level, []);
    byLevel.get(r.level).push({
      ref: { list: "spells", id: r.key },
      name: r.spell.name,
      catalogue: { type: "spell", id: r.spell.id, name: r.spell.name, source: r.spell.source },
      innate: !!r.uses,
      uses: r.uses ? { cur: r.uses.cur, max: r.uses.max } : null,
    });
  }
  const lists = [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lvl, rows]) => ({ label: lvl === 0 ? "Cantrips" : `${ORDINAL[lvl]} level`, spells: rows.sort((a, b) => a.name.localeCompare(b.name)) }));
  return {
    empty: !spells.length && !slots.length,
    line: d.spellcasting.map((s) => `${s.name}: ${s.ability.toUpperCase()} · spell save DC ${s.dc} · ${signed(s.attack)} to hit`).join(" / ") || "No spellcasting class",
    slots,
    sorcery: null,
    lists,
  };
}

const COIN_KEYS = ["pp", "gp", "ep", "sp", "cp"];

function equipmentOf(c) {
  const inv = inventoryOf(c);
  const catalogue = (it) => (it.item ? { type: "item", id: it.item, name: it.name, source: it.source } : null);
  const magic = inv.items
    .filter((it) => it?.name && isMagic(it))
    .map((it) => {
      const ch = chargesOf(it);
      return { ref: { list: "items", id: it.id }, name: it.name, catalogue: catalogue(it), attuned: !!it.attuned, uses: ch ? { cur: ch.cur, max: ch.max } : null, regain: regainText(ch) };
    });
  const gear = inv.items
    .filter((it) => it?.name && !isMagic(it))
    .map((it) => ({ ref: { list: "items", id: it.id }, name: it.name, catalogue: catalogue(it), amount: toInt(it.qty, 1) }));
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
  const d = derivedOf(c);
  if (!d) return null;
  const st = stateOf(c);
  const cur = currentHp(c, d.hp_max);
  const temp = toInt(st.hp_temp, 0);
  const others = Object.entries(d.speed)
    .filter(([k, v]) => k !== "walk" && typeof v === "number" && v > 0)
    .map(([k, v]) => `${labelOf(k)} ${v} ft${k === "fly" && d.speed.hover ? " (hover)" : ""}`);

  const saves = ABILITY_ROWS.filter(([a]) => d.abilities[a].save_prof).map(([a, short]) => `${short} ${signed(d.abilities[a].save)}`);
  const skills = Object.entries(d.skills).sort(([, a], [, b]) => a.label.localeCompare(b.label));
  const skillList = skills.filter(([, s]) => s.prof).map(([, s]) => `${s.label} ${signed(s.total)}${s.prof === 2 ? "†" : ""}`);
  const senses = Object.entries(d.senses)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k, v]) => `${labelOf(k)} ${v} ft`);
  senses.push(`passive Perception ${d.skills.perception?.passive ?? 10}`);

  const lines = [
    { label: "Saving Throws", text: saves.join(", ") },
    { label: "Skills", text: skillList.join(", ") + (skillList.some((s) => s.endsWith("†")) ? "  († expertise)" : "") },
    { label: "Resistances", text: list(d.defenses.resist) },
    { label: "Immunities", text: list(d.defenses.immune) },
    { label: "Vulnerabilities", text: list(d.defenses.vulnerable) },
    { label: "Condition Immunities", text: list(d.defenses.condition_immune) },
    { label: "Senses", text: senses.join(", ") },
    { label: "Languages", text: list(d.proficiencies.languages) },
    { label: "Armor", text: list(d.proficiencies.armor) },
    { label: "Weapons", text: list(d.proficiencies.weapons) },
    { label: "Tools", text: list(d.proficiencies.tools) },
  ].filter((l) => l.text);

  const profile = c?.profile || {};

  return {
    kind: "character",
    name: c?.name || "Unnamed",
    subtitle: [raceLine(c), classLine(d), alignmentLine(c)].filter(Boolean).join(" · "),
    // `inputs` / `extra` are what the card shows for a vital while editing
    // (names from CHARACTER_EDITS); `editSub` is its small line then.
    vitals: [
      { key: "ac", label: "Armor Class", value: String(d.ac), inputs: [{ edit: "ac", label: "Armor class", min: 0, max: 40 }], editSub: "your own number replaces the worked-out one" },
      {
        key: "hp",
        label: "Hit Points",
        value: String(cur),
        sub: `of ${d.hp_max}${temp > 0 ? ` · ${temp} temp` : ""}`,
        inputs: [{ edit: "hpCurrent", label: "Current hit points", min: 0 }, { text: "of" }, { edit: "hpMax", label: "Maximum hit points", min: 0, size: "md" }],
        extra: [{ text: "temp" }, { edit: "hpTemp", label: "Temporary hit points", min: 0, size: "sm" }],
      },
      {
        key: "speed",
        label: "Speed",
        value: `${typeof d.speed.walk === "number" ? d.speed.walk : 0} ft`,
        sub: others.join(", ") || null,
        inputs: [{ edit: "speed", label: "Walking speed", min: 0, step: 5 }, { text: "ft" }],
        editSub: others.join(", ") || null,
      },
      {
        key: "initiative",
        label: "Initiative",
        value: signed(d.initiative),
        inputs: [{ text: "DEX +" }, { edit: "initiativeBonus", label: "Initiative bonus", size: "md" }],
        editSub: `total ${signed(d.initiative)}`,
      },
      { key: "pb", label: "Proficiency", value: signed(d.pb), editSub: "from level" },
      { key: "level", label: "Level", value: String(d.level || "—"), editSub: "from the classes" },
    ],
    abilities: ABILITY_ROWS.map(([a, short]) => ({
      key: a,
      short: short.toUpperCase(),
      score: d.abilities[a].score,
      mod: signed(d.abilities[a].mod),
      save: signed(d.abilities[a].save),
      saveProf: d.abilities[a].save_prof,
    })),
    skillMode: "proficiency",
    skills: skills.map(([key, s]) => ({ key, label: s.label, ability: s.ability.toUpperCase(), total: signed(s.total), level: LEVEL_WORD[s.prof] })),
    lines,
    sections: sectionsOf(c, d, editing),
    spellcasting: spellcastingOf(c, d),
    equipment: equipmentOf(c),
    about: ABOUT_FIELDS.map(([k, label]) => ({ label, text: String(profile[k] || "").trim() })).filter((a) => a.text),
    notes: String(c?.dm_notes || ""),
    notesPlaceholder: "Who they are to the party, what they want, how they act at the table…",
    editingNote: "Editing this copy only — the player's own character is not touched.",
  };
}

/* ─── single numbers ─────────────────────────────────────────────── */

const withState = (c, patch) => ({ ...c, state: { ...stateOf(c), ...patch } });
const merge = (c, patch) => ({ ...c, ...patch });

export const CHARACTER_EDITS = {
  name: { get: (c) => c?.name ?? "", set: (c, v) => ({ ...c, name: v }) },
  ac: { get: (c) => derivedOf(c)?.ac ?? null, set: (c, v) => merge(c, setManualSet(c, "ac", v ?? null)) },
  hpCurrent: {
    get: (c) => currentHp(c, derivedOf(c)?.hp_max ?? 0),
    set: (c, v) => {
      const max = derivedOf(c)?.hp_max ?? 0;
      return withState(c, { hp_current: v == null || v >= max ? null : Math.max(0, v) });
    },
  },
  hpMax: { get: (c) => derivedOf(c)?.hp_max ?? 0, set: (c, v) => merge(c, setManualSet(c, "hp_max", v ?? null)) },
  hpTemp: { get: (c) => toInt(stateOf(c).hp_temp, 0), set: (c, v) => withState(c, { hp_temp: Math.max(0, v ?? 0) }) },
  speed: { get: (c) => toInt(derivedOf(c)?.speed?.walk, 0), set: (c, v) => merge(c, setDistance(c, "speed", "walk", v ?? 0)) },
  initiativeBonus: { get: (c) => manualAdd(c, "initiative"), set: (c, v) => merge(c, setManualAdd(c, "initiative", v ?? 0)) },
  score: {
    get: (c, key) => derivedOf(c)?.abilities?.[key]?.score ?? null,
    set: (c, key, v) => {
      if (v == null) return c;
      const d = derivedOf(c);
      const base = toInt(c?.abilities?.base?.[key], 10);
      const bonus = (d?.abilities?.[key]?.score ?? base) - base;
      return { ...c, abilities: { ...(c.abilities || {}), base: { ...(c.abilities?.base || {}), [key]: Math.max(1, Math.min(30, v - bonus)) } } };
    },
  },
  saveProf: {
    get: (c, key) => !!derivedOf(c)?.abilities?.[key]?.save_prof,
    set: (c, key, v) => merge(c, setHas(c, "saves", key, v)),
  },
  // none → proficient → expertise → none, like the Abilities tab.
  skillProf: {
    cycle: (c, key) => merge(c, setSkillLevel(c, key, nextLevel(derivedOf(c)?.skills?.[key]?.prof ?? 0))),
  },
  coin: {
    get: (c, key) => toInt(inventoryOf(c).currency?.[key], 0),
    set: (c, key, v) => ({ ...c, inventory: { ...(c?.inventory || {}), currency: { ...inventoryOf(c).currency, [key]: Math.max(0, v ?? 0) } } }),
  },
  notes: { get: (c) => c?.dm_notes ?? "", set: (c, v) => ({ ...c, dm_notes: v }) },
};

/* ─── whole rows ─────────────────────────────────────────────────── */

// Change a copy in its home: a layer's features or spells, or an item's features.
function mapCopy(c, from, field, id, fn) {
  if (String(from).startsWith("item:")) {
    const rowId = String(from).slice(5);
    const inv = inventoryOf(c);
    return { ...c, inventory: { ...(c.inventory || {}), items: inv.items.map((it) => (it?.id === rowId ? { ...it, [field]: fn(asList(it[field])) } : it)) } };
  }
  return { ...c, layers: asList(c.layers).map((l) => (l?.from === from ? { ...l, [field]: fn(asList(l[field])) } : l)) };
}

const findCopy = (c, from, field, id) => {
  if (String(from).startsWith("item:")) {
    const it = inventoryOf(c).items.find((x) => x?.id === String(from).slice(5));
    return asList(it?.[field]).find((x) => x?.id === id) || null;
  }
  return asList(asList(c?.layers).find((l) => l?.from === from)?.[field]).find((x) => x?.id === id) || null;
};

const withItems = (c, fn) => ({ ...c, inventory: { ...(c?.inventory || {}), items: fn(inventoryOf(c).items) } });

// What is used of something with `max` when `cur` are left.
const usedFor = (max, cur) => Math.max(0, Math.min(max, max - Math.max(0, cur ?? 0)));
const setCount = (obj, key, used) => {
  const next = { ...(obj || {}) };
  if (used > 0) next[key] = used;
  else delete next[key];
  return next;
};

// A catalogue optional feature (fighting style, invocation, maneuver…):
// its features join the character's own, or one passive with its text.
const optionalFeatureRows = (f) => {
  const own = asList(f.features).map((x) => ({ ...JSON.parse(JSON.stringify(x)), id: `${f.id}:${x.id || x.name}`, source_id: f.id }));
  return own.length ? own : [{ ...newOwnFeature("traits"), name: f.name, text: typeof f.text === "string" ? f.text : "", source_id: f.id }];
};

export const CHARACTER_ACTIONS = {
  row: (c, ref) => {
    if (ref.list === "features" || ref.list === "spells") {
      const [from, id] = splitKey(ref.id);
      return findCopy(c, from, ref.list, id);
    }
    if (ref.list === "items") return inventoryOf(c).items.find((i) => i?.id === ref.id) || null;
    return null;
  },

  replace: (c, ref, next) => {
    if (ref.list === "features" || ref.list === "spells") {
      const [from, id] = splitKey(ref.id);
      return mapCopy(c, from, ref.list, id, (rows) => rows.map((r) => (r?.id === id ? { ...next, ...(from === "manual" || ref.list === "spells" ? {} : { edited: true }) } : r)));
    }
    if (ref.list === "items") return withItems(c, (items) => items.map((i) => (i?.id === ref.id ? next : i)));
    return c;
  },

  // The player's own rows go away; a copy from a layer is hidden instead
  // (a level up or swap brings the book's back anyway).
  remove: (c, ref) => {
    if (ref.list === "features") {
      const [from, id] = splitKey(ref.id);
      if (from === "manual") return mapCopy(c, from, "features", id, (rows) => rows.filter((r) => r?.id !== id));
      return mapCopy(c, from, "features", id, (rows) => rows.map((r) => (r?.id === id ? { ...r, active: false } : r)));
    }
    if (ref.list === "spells") {
      const [from, id] = splitKey(ref.id);
      return mapCopy(c, from, "spells", id, (rows) => rows.filter((r) => r?.id !== id));
    }
    if (ref.list === "items") return withItems(c, (items) => items.filter((i) => i?.id !== ref.id));
    return c;
  },

  setAmount: (c, ref, amount) => (ref.list === "items" ? withItems(c, (items) => items.map((i) => (i?.id === ref.id ? { ...i, qty: Math.max(0, amount ?? 0) } : i))) : c),

  // Spend or regain: `cur` is the new number left.
  setUses: (c, ref, cur) => {
    // Rows a template gives keep their uses on the character's template_uses.
    if (ref.template) return { ...c, template_uses: { ...(c?.template_uses || {}), [ref.id]: cur } };
    const d = derivedOf(c);
    const st = stateOf(c);
    if (ref.list === "features") {
      const r = featureRows(c, d).find((x) => x.key === ref.id);
      return r?.uses ? withState(c, { uses_used: setCount(st.uses_used, ref.id, usedFor(r.uses.max, cur)) }) : c;
    }
    if (ref.list === "spells") {
      const r = spellRows(c, d).find((x) => x.key === ref.id);
      return r?.uses ? withState(c, { uses_used: setCount(st.uses_used, ref.id, usedFor(r.uses.max, cur)) }) : c;
    }
    if (ref.list === "slots") {
      const s = slotRows(c, d).find((x) => String(x.level) === ref.id);
      return s ? withState(c, { slots_used: setCount(st.slots_used, ref.id, usedFor(s.max, cur)) }) : c;
    }
    if (ref.list === "pact") {
      const p = pactRows(c, d).find((x) => String(x.level) === ref.id);
      const prev = st.pact_slots_used && typeof st.pact_slots_used === "object" ? st.pact_slots_used : {};
      return p ? withState(c, { pact_slots_used: setCount(prev, ref.id, usedFor(p.max, cur)) }) : c;
    }
    if (ref.list === "pool") {
      const p = resourceRows(c, d).find((x) => x.id === ref.id);
      return p ? withState(c, { resources_used: setCount(st.resources_used, ref.id, usedFor(p.max, cur)) }) : c;
    }
    if (ref.list === "items") {
      const it = inventoryOf(c).items.find((i) => i?.id === ref.id);
      const ch = chargesOf(it);
      return ch ? withItems(c, (items) => items.map((i) => (i?.id === ref.id ? { ...i, charges_used: usedFor(ch.max, cur) } : i))) : c;
    }
    return c;
  },

  // Adding. Each returns { raw, ref } so the card can open what was added.
  add: (c, kind, entry) => {
    if (kind === "own") {
      const f = newOwnFeature("actions");
      return { raw: merge(c, withManual(c, (m) => ({ ...m, features: [...asList(m.features), f] }))), ref: { list: "features", id: usesKey("manual", f.id) }, open: true };
    }
    if (kind === "optionalFeature") {
      const rows = optionalFeatureRows(entry);
      return { raw: merge(c, withManual(c, (m) => ({ ...m, features: [...asList(m.features), ...rows] }))), ref: { list: "features", id: usesKey("manual", rows[0].id) }, open: true };
    }
    if (kind === "spell") return { raw: merge(c, addSpell(c, entry)), ref: { list: "spells", id: usesKey("manual", entry.id) } };
    if (kind === "item") {
      const { patch, id } = addFromCatalogue(c, entry);
      return { raw: merge(c, patch), ref: { list: "items", id } };
    }
    return { raw: c, ref: null };
  },

  // Already on the statblock? (spells and optional features; items stack instead)
  has: (c, kind, entry) => {
    if (kind === "spell") return asList(c?.layers).some((l) => asList(l?.spells).some((s) => s?.id === entry?.id));
    if (kind === "optionalFeature") return asList(manualOf(c).features).some((f) => f?.source_id === entry?.id);
    return false;
  },
};

// What "Add from the catalogue" offers on a character's card. Feats come
// with the builder on the sheet (they bring grants and choices).
export const CHARACTER_ADD_KINDS = [
  { kind: "optionalFeature", label: "optional feature" },
  { kind: "item", label: "item" },
  { kind: "spell", label: "spell" },
];
