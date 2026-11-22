import { evaluate } from "../../../utils/formulas";
import { wordsFor } from "../../../utils/derive";
import { asList, stateOf, withManual } from "./sheetHelpers";

/* ═══════════════════════════════════════════════════════════════════
   featureHelpers — the character's features, as the Features and Feats
   tabs and Play's Actions & Charges see them (version-2 file).

   A feature is a copy in the shared feature shape (data-model §2):
     { id, name, level, text, category, uses { max, reset }, action {…},
       toggle {grants, modifiers} | true, modifiers [], consumes {resource, amount} }
   plus what the sheet adds on the copy:
     on       a toggle that is switched on
     active   false = hidden in Play
     edited   true once the player changed it
     book     the copy as the book gave it, kept at the first change
              ("back to the book's" puts it back)
     feat     true on a feat the player wrote themselves (manual layer)
     own      true on one the player added to a race/background layer

   They live in three places:
     a layer's `features`          from: "race:…", "class:…@3", "feat:…"
     the manual layer's `features` the player's own
     an equipped item's `features` from: "item:<row id>"

   Numbers stay formulas on the copy ("dex_mod + pb", a level table); the
   rows here carry them worked out for this character (`action`), with the
   player's own bonuses on top (derive's `bonuses`). Spent uses sit in
   state.uses_used under `<from>#<feature id>`; pools in state.resources_used.
   ═══════════════════════════════════════════════════════════════════ */

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isN = (v) => typeof v === "number" && Number.isInteger(v);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const scoresOf = (d) => Object.fromEntries(Object.entries(d?.abilities || {}).map(([a, v]) => [a, v.score]));

export const usesKey = (from, id) => `${from}#${id}`;

// Where a feature comes from, for grouping.
export const sourceKind = (from) => {
  const f = String(from || "");
  if (f === "manual") return "manual";
  if (f.startsWith("item:")) return "item";
  return f.split(":")[0]; // race, background, class, feat
};

export const SOURCE_GROUPS = [
  { key: "race", title: "Race" },
  { key: "background", title: "Background" },
  { key: "class", title: "Class" },
  { key: "feat", title: "Feats" },
  { key: "item", title: "Items" },
  { key: "manual", title: "Your own" },
];

export const CATEGORIES = [
  { value: "actions", label: "Action", title: "Actions" },
  { value: "bonus_actions", label: "Bonus", title: "Bonus Actions" },
  { value: "reactions", label: "Reaction", title: "Reactions" },
  { value: "traits", label: "Passive", title: "Passives" },
];

// A feature with no category: an action if it has one, else a passive.
export const categoryOf = (f) => (CATEGORIES.some((c) => c.value === f?.category) ? f.category : f?.action ? "actions" : "traits");

/* ─── numbers ────────────────────────────────────────────────────── */

// A value worked out: a number or dice when it can be, else left as it is (words).
const work = (v, w) => {
  if (v == null) return v;
  const got = evaluate(v, w, w.class_level || w.level);
  return got == null ? v : got;
};

const workPart = (p, w, extra = 0) => {
  if (!isObj(p)) return p;
  let bonus = p.bonus != null ? work(p.bonus, w) : p.bonus;
  if (extra) bonus = isN(bonus) ? bonus + extra : bonus == null ? extra : bonus;
  return { ...p, dice: p.dice != null ? work(p.dice, w) : p.dice, bonus };
};

const usesSpellMod = (v) => typeof v === "string" && /spell_mod/.test(v);

/* The action with its numbers worked out. `bonuses` are derive's: the
   player's +attack / +spell attack / +spell DC / +damage on top. */
export function workAction(a, w, bonuses = {}) {
  if (!isObj(a)) return a;
  const out = { ...a };
  if (isObj(a.attack)) {
    const spell = a.attack.kind === "spell" || usesSpellMod(a.attack.bonus);
    let hit = a.attack.bonus != null ? work(a.attack.bonus, w) : null;
    const extra = (spell ? bonuses.spell_attack : bonuses.attack) || 0;
    if (isN(hit)) hit += extra;
    const dmg = (spell ? bonuses.spell_damage : bonuses.damage) || 0;
    out.attack = { ...a.attack, bonus: hit, damage: asList(a.attack.damage).map((p, i) => workPart(p, w, i === 0 ? dmg : 0)) };
  }
  if (isObj(a.save)) {
    let dc = a.save.dc != null ? work(a.save.dc, w) : null;
    if (isN(dc) && usesSpellMod(a.save.dc)) dc += bonuses.spell_dc || 0;
    out.save = { ...a.save, dc, damage: asList(a.save.damage).map((p) => workPart(p, w)) };
  }
  if (Array.isArray(a.damage)) out.damage = a.damage.map((p) => workPart(p, w));
  if (a.heal != null) out.heal = work(a.heal, w);
  if (a.temp_hp != null) out.temp_hp = work(a.temp_hp, w);
  return out;
}

/* ─── rows ───────────────────────────────────────────────────────── */

function row(ch, d, from, owner, f, w, pools) {
  const key = usesKey(from, f.id);
  const max = f.uses && f.uses !== "at_will" ? work(f.uses.max ?? (f.uses.reset === "recharge" ? 1 : null), w) : null;
  const used = Math.max(0, Math.trunc(Number(stateOf(ch).uses_used?.[key]) || 0));
  const res = f.consumes?.resource ? pools.find((r) => r.id === f.consumes.resource) : null;
  return {
    key,
    from,
    owner,
    kind: sourceKind(from),
    feature: f,
    category: categoryOf(f),
    action: workAction(f.action, w, d.bonuses),
    uses: isN(max) && max > 0 ? { max, cur: clamp(max - used, 0, max), used, reset: f.uses.reset } : null,
    // the pool it spends from, with what's left (shared with every feature spending it)
    consumes: res ? { ...res, amount: f.consumes.amount ?? f.consumes.min ?? 1 } : f.consumes?.resource ? { id: f.consumes.resource, name: f.consumes.resource, missing: true, max: 0, cur: 0, used: 0, amount: f.consumes.amount ?? 1 } : null,
    isToggle: !!f.toggle,
    on: !!f.on,
    active: f.active !== false,
    words: w,
  };
}

// Every feature the character has, layer by layer, then equipped items'.
export function featureRows(ch, d) {
  if (!ch || !d) return [];
  const scores = scoresOf(d);
  const pools = resourceRows(ch, d);
  const out = [];
  for (const layer of asList(ch.layers)) {
    if (!layer || !asList(layer.features).length) continue;
    const w = wordsFor(ch, layer.from, scores);
    for (const f of asList(layer.features)) if (isObj(f) && f.id && !f.removed) out.push(row(ch, d, layer.from, layer.label || layer.from, f, w, pools));
  }
  const iw = wordsFor(ch, null, scores);
  for (const item of asList(ch.inventory?.items)) {
    if (!item?.equipped || (item.attunement?.required && !item.attuned)) continue;
    for (const f of asList(item.features)) if (isObj(f) && f.id) out.push(row(ch, d, `item:${item.id}`, item.name, f, iw, pools));
  }
  return out;
}

// Pools (Rage, Focus Points…) with what's left: derive's resources + state.
export const resourceRows = (ch, d) =>
  asList(d?.resources).map((r) => {
    const used = Math.max(0, Math.trunc(Number(stateOf(ch).resources_used?.[r.id]) || 0));
    return { ...r, used, cur: clamp(r.max - used, 0, r.max) };
  });

/* ─── writers (each returns a patch for CharStore.patchChar) ─────── */

// The copy as the book gave it, kept the first time the player changes it
// ("back to the book's"). Switches (shown in Play, on) aren't part of it.
const bookOf = (f) => {
  const { edited, edited_text, book, active, on, removed, ...rest } = f;
  return rest;
};

// Change a feature copy wherever it lives. The player's change marks it
// `edited` and keeps the book's version in `book` (once).
export function patchFeature(ch, from, id, patch) {
  const apply = (list) =>
    asList(list).map((f) => (f?.id === id ? { ...f, ...patch, ...(from === "manual" || f.own ? {} : { edited: true, book: f.book || bookOf(f) }) } : f));
  if (String(from).startsWith("item:")) {
    const rowId = String(from).slice(5);
    const inv = ch.inventory || {};
    return { inventory: { ...inv, items: asList(inv.items).map((it) => (it?.id === rowId ? { ...it, features: apply(it.features) } : it)) } };
  }
  return { layers: asList(ch.layers).map((l) => (l?.from === from ? { ...l, features: apply(l.features) } : l)) };
}

/* A feature a layer gave can't be deleted (a rebuild would bring it
   back); it's taken off the sheet instead (`removed`: no line, no card,
   no effect) and listed under "taken off" to bring back. */
export const setFeatureRemoved = (ch, from, id, removed) => {
  const apply = (list) => asList(list).map((f) => (f?.id === id ? { ...f, removed: removed || undefined } : f));
  return { layers: asList(ch.layers).map((l) => (l?.from === from ? { ...l, features: apply(l.features) } : l)) };
};

// The features taken off the sheet, of the layers `test(from)` picks.
export const takenOffFeatures = (ch, test) =>
  asList(ch?.layers).flatMap((l) => (l ? asList(l.features).filter((f) => isObj(f) && f.removed && test(l.from, f)).map((f) => ({ from: l.from, owner: l.label || l.from, feature: f })) : []));

// Back to the book's version (what it was before the first change).
export function restoreFeature(ch, from, id) {
  const apply = (list) => asList(list).map((f) => (f?.id === id && f.book ? { ...f.book, active: f.active, on: f.on } : f));
  if (String(from).startsWith("item:")) {
    const rowId = String(from).slice(5);
    const inv = ch.inventory || {};
    return { inventory: { ...inv, items: asList(inv.items).map((it) => (it?.id === rowId ? { ...it, features: apply(it.features) } : it)) } };
  }
  return { layers: asList(ch.layers).map((l) => (l?.from === from ? { ...l, features: apply(l.features) } : l)) };
}

// On/off switches don't count as an edit of the book's feature.
export function setFeatureFlag(ch, from, id, flag, value) {
  const apply = (list) => asList(list).map((f) => (f?.id === id ? { ...f, [flag]: value } : f));
  if (String(from).startsWith("item:")) {
    const rowId = String(from).slice(5);
    const inv = ch.inventory || {};
    return { inventory: { ...inv, items: asList(inv.items).map((it) => (it?.id === rowId ? { ...it, features: apply(it.features) } : it)) } };
  }
  return { layers: asList(ch.layers).map((l) => (l?.from === from ? { ...l, features: apply(l.features) } : l)) };
}

// Uses: `used` spent of a feature (0 removes the entry).
export function setUsesUsed(ch, key, used) {
  const st = stateOf(ch);
  const next = { ...(st.uses_used || {}) };
  if (used > 0) next[key] = used;
  else delete next[key];
  return { state: { ...st, uses_used: next } };
}

export function setResourceUsed(ch, id, used) {
  const st = stateOf(ch);
  const next = { ...(st.resources_used || {}) };
  if (used > 0) next[id] = used;
  else delete next[id];
  return { state: { ...st, resources_used: next } };
}

const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

// A feature (or feat, with `feat: true`) the player writes themselves.
export const newOwnFeature = (category = "actions", extra = {}) => ({ id: newId(), name: "", category, text: "", uses: null, action: null, ...extra });

export const addOwnFeature = (ch, feature) => withManual(ch, (m) => ({ ...m, features: [...asList(m.features), feature] }));

/* ─── optional features (invocations, metamagic, maneuvers…) ─── */

// The kinds the Spellbook shows; the rest (maneuvers, runes…) stay with their class.
export const SPELL_OPTION_TYPES = ["eldritch_invocation", "metamagic", "pact_boon"];
// A picked optional feature (an invocation, a maneuver…): a copy with its kinds.
// (A class's own optional features, Tasha's, have `optional` but no kinds.)
export const isOptionFeature = (f) => asList(f?.feature_types).length > 0;
export const isSpellOption = (f) => !!f?.optional && asList(f.feature_types).some((t) => SPELL_OPTION_TYPES.includes(t));

// A catalogue optional feature as a feature copy (like the builder's
// build._optional_copy), for the manual layer.
export const optionalFeatureCopy = (rec) => {
  const copy = { id: rec.id, name: rec.name, text: rec.text || "", level: 1, category: "traits", optional: true, feature_types: asList(rec.feature_types), source: rec.source };
  if (rec.consumes && typeof rec.consumes === "object") copy.consumes = JSON.parse(JSON.stringify(rec.consumes));
  for (const k of ["uses", "action", "toggle", "modifiers"]) if (rec[k] != null) copy[k] = JSON.parse(JSON.stringify(rec[k]));
  return copy;
};

/* A feature the player adds to a layer (a racial trait, a background
   feature): it lives in that layer's `features` with `own: true`, so it
   goes when the layer goes (a race swap) and stays through level ups. */
export const addLayerFeature = (ch, from, feature) => ({
  layers: asList(ch.layers).map((l) => (l?.from === from ? { ...l, features: [...asList(l.features), { ...feature, own: true }] } : l)),
});

export const removeLayerFeature = (ch, from, id) => {
  const st = stateOf(ch);
  const uses = { ...(st.uses_used || {}) };
  delete uses[usesKey(from, id)];
  return {
    layers: asList(ch.layers).map((l) => (l?.from === from ? { ...l, features: asList(l.features).filter((f) => f?.id !== id) } : l)),
    state: { ...st, uses_used: uses },
  };
};

// The player's own: the manual layer's, or one they added to a layer.
export const isOwnRow = (r) => r?.kind === "manual" || !!r?.feature?.own;

export const removeOwnFeature = (ch, id) => {
  const cleared = withManual(ch, (m) => ({ ...m, features: asList(m.features).filter((f) => f?.id !== id) }));
  const st = stateOf(ch);
  const uses = { ...(st.uses_used || {}) };
  delete uses[usesKey("manual", id)];
  return { ...cleared, state: { ...st, uses_used: uses } };
};

/* ─── weapons ────────────────────────────────────────────────────── */

const baseId = (id) => String(id || "").replace(/-[a-z0-9]+$/, "").replace(/-/g, "_");

// Is the character proficient with this weapon (its group or the weapon itself)?
export const proficientWith = (item, d) => {
  const have = asList(d?.proficiencies?.weapons);
  const w = item?.weapon || {};
  const ids = [baseId(item?.item), baseId(item?.base_item), `${w.category}_weapons`];
  return ids.some((x) => x && have.includes(x));
};

/* An equipped weapon's attack, worked out: to hit (proficiency only when
   proficient; finesse takes the better of Str and Dex, ranged uses Dex),
   damage with the ability modifier, the weapon's own +1 and the player's
   bonuses. */
export function weaponAttack(item, d) {
  const w = item?.weapon;
  if (!w?.damage) return null;
  const props = asList(w.properties);
  const str = d.abilities.str.mod;
  const dex = d.abilities.dex.mod;
  const ranged = w.kind === "ranged";
  const mod = props.includes("finesse") ? Math.max(str, dex) : ranged ? dex : str;
  const prof = proficientWith(item, d);
  const plus = { hit: Number(w.bonus?.attack) || 0, dmg: Number(w.bonus?.damage) || 0 };
  const hit = mod + (prof ? d.pb : 0) + plus.hit + (d.bonuses?.attack || 0);
  const dmgBonus = mod + plus.dmg + (d.bonuses?.damage || 0);
  const far = w.range ? `${w.range.normal ?? w.range}${w.range.long ? `/${w.range.long}` : ""} ft.` : "";
  const reach = props.includes("reach") ? "reach 10 ft." : "5 ft.";
  const range = ranged ? far : far ? `${reach} or thrown ${far}` : reach;
  return {
    name: item.name,
    hit,
    proficient: prof,
    damage: [{ dice: w.damage.dice, bonus: dmgBonus || null, type: w.damage.type }],
    versatile: w.versatile ? { dice: typeof w.versatile === "string" ? w.versatile : w.versatile.dice, bonus: dmgBonus || null, type: w.damage.type } : null,
    range,
    mastery: asList(w.mastery),
  };
}
