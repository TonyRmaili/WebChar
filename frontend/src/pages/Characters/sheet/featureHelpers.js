import { evaluate } from "../../../utils/formulas";
import { layersOf, wordsFor } from "../../../utils/derive";
import { asList, manualOf, stateOf, withManual } from "./sheetHelpers";
import { riderOf } from "../../Catalogues/catalogueHelpers";

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
  // extra damage added to an attack or a save: no card in Play, attached to the cards it fits
  { value: "riders", label: "Rider", title: "Riders" },
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
    // a rider ("any": Hex, Frost Brand) adds to an attack that already has the +damage
    const dmg = a.attack.kind === "any" ? 0 : (spell ? bonuses.spell_damage : bonuses.damage) || 0;
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
  if (a.barrier != null) out.barrier = work(a.barrier, w);
  return out;
}

/* ─── weapon attacks in Custom (exported from the Inventory) ─────────
   A feature with `link: { item: <inventory row id> }` is an attack made
   with that item: to hit and damage come from the item as it is now
   (weaponAttack: its dice, +1, the ability, proficiency), plus the item's
   own extra damage (a feature of it that rides on its attacks: Frost
   Brand's cold, Sun Blade's radiant while it's on), plus what the
   feature adds itself (`action.attack.bonus` extra to hit, its own
   `action.attack.damage` parts: Booming Blade, a Smite). Change the item
   and every attack linked to it follows; remove it and they go
   (inventoryHelpers.removeItem). Shown in Play only while it's equipped. */

// The damage parts an item's own riders add to its attacks (a switched one only while it's on).
export const itemRiders = (item, w) =>
  asList(item?.features)
    .filter((f) => isObj(f) && !f.removed && (!f.toggle || f.on))
    .map(riderOf)
    .filter((r) => r && r.on !== "saves")
    .flatMap((r) => asList(r.damage).map((p) => workPart(p, w)));

/* Is a feature only a rider (no attack, save, heal… of its own, no uses
   or pool of its own)? Then it has no card in Play: it's attached to the
   attack and save cards it fits (a switched one: attaching switches it on). */
export const isRiderOnly = (f) => {
  if (!isObj(f) || !riderOf(f)) return false;
  if (f.category === "riders") return true;
  const a = f.action || {};
  const other = (a.attack && a.attack.kind !== "any") || a.save || a.range || a.area || a.heal || a.temp_hp || asList(a.damage).length;
  return !other && !f.uses && !(f.consumes && f.consumes.resource !== "charges");
};
// Kept for older callers: an item's feature that only adds damage to the item's attacks.
export const isItemRider = isRiderOnly;

function linkedAction(ch, d, f, w) {
  const item = asList(ch.inventory?.items).find((i) => i?.id === f.link.item);
  if (!item) return { item: null, attack: null, action: null };
  const atk = weaponAttack(item, d);
  if (!atk) return { item, attack: null, action: null };
  const own = workAction(f.action, w, {});
  const extraHit = own?.attack?.bonus;
  return {
    item,
    attack: atk,
    action: {
      range: atk.range,
      attack: {
        kind: item.weapon?.kind || "melee",
        bonus: atk.hit + (typeof extraHit === "number" ? extraHit : 0),
        damage: [...atk.damage, ...itemRiders(item, w), ...asList(own?.attack?.damage)],
      },
    },
  };
}

// Export an item to Custom: a new attack linked to it (several can be).
export const exportItemAttack = (ch, item) =>
  addOwnFeature(ch, newOwnFeature("actions", { name: item.name || "Attack", link: { item: item.id }, action: { attack: { kind: item.weapon?.kind || "melee", damage: [] } } }));

/* ─── rows ───────────────────────────────────────────────────────── */

function row(ch, d, from, owner, f, w, pools) {
  const key = usesKey(from, f.id);
  const max = f.uses && f.uses !== "at_will" ? work(f.uses.max ?? (f.uses.reset === "recharge" ? 1 : null), w) : null;
  const used = Math.max(0, Math.trunc(Number(stateOf(ch).uses_used?.[key]) || 0));
  // an item's feature spending the item's own charges (shown, not spent: the player clicks the item's dots)
  const item = String(from).startsWith("item:") ? asList(ch.inventory?.items).find((i) => `item:${i?.id}` === from) : null;
  const onCharges = !!item && f.consumes?.resource === "charges";
  const chargeCost = f.consumes?.amount ?? 1;
  const res = f.consumes?.resource && !onCharges ? pools.find((r) => r.id === f.consumes.resource) : null;
  const linked = f.link?.item ? linkedAction(ch, d, f, w) : null;
  const rd = riderOf(f);
  return {
    key,
    from,
    owner,
    kind: sourceKind(from),
    feature: f,
    category: categoryOf(f),
    action: linked ? linked.action : workAction(f.action, w, d.bonuses),
    // an attack exported from the Inventory: { item, attack } (weaponAttack's numbers)
    linked: linked ? { item: linked.item, attack: linked.attack } : null,
    uses: isN(max) && max > 0 ? { max, cur: clamp(max - used, 0, max), used, reset: f.uses.reset } : null,
    // the pool it spends from, with what's left (shared with every feature spending it)
    consumes: onCharges
      ? { id: `charges:${item.id}`, name: chargeCost === 1 ? "charge" : "charges", itemCharges: true, amount: chargeCost, max: 0, cur: 0, used: 0 }
      : res ? { ...res, amount: f.consumes.amount ?? f.consumes.min ?? 1 }
      // a pool not on the sheet, or none picked yet (a create form leaves the pick to the sheet)
      : f.consumes ? { id: f.consumes.resource || "", name: f.consumes.resource || "a pool", missing: true, unpicked: !f.consumes.resource, max: 0, cur: 0, used: 0, amount: f.consumes.amount ?? 1 } : null,
    // on an item with charges: its features can spend them (the editor offers "item's charges")
    itemCharges: !!item?.charges,
    isToggle: !!f.toggle,
    on: !!f.on,
    // a rider (extra damage on an attack or a save): worked out; riderOnly = no card of its own in Play
    rider: rd ? { damage: asList(rd.damage).map((p) => workPart(p, w)), conditions: asList(rd.conditions), on: rd.on } : null,
    riderOnly: isRiderOnly(f),
    // the riders attached to this card in Play (their keys)
    riders: asList(f.riders),
    // a linked attack is in Play only while its item is equipped
    active: f.active !== false && (!linked || !!linked.item?.equipped),
    words: w,
  };
}

// Every feature the character has, layer by layer, then equipped items'.
export function featureRows(ch, d) {
  if (!ch || !d) return [];
  const scores = scoresOf(d);
  const pools = resourceRows(ch, d);
  const out = [];
  // spell_mod outside a class (your own features, a race's, an item's): your
  // own spellcasting ability, else the first casting class's.
  const ownSpell = manualOf(ch).spell_ability || d.spellcasting?.[0]?.ability || null;
  for (const layer of layersOf(ch)) {
    if (!layer || !asList(layer.features).length) continue;
    const w = wordsFor(ch, layer.from, scores, String(layer.from || "").startsWith("class:") ? null : ownSpell);
    for (const f of asList(layer.features)) if (isObj(f) && f.id && !f.removed) out.push(row(ch, d, layer.from, layer.from === "manual" ? "" : layer.label || layer.from, f, w, pools)); // your own: no owner shown
  }
  const iw = wordsFor(ch, null, scores, ownSpell);
  for (const item of asList(ch.inventory?.items)) {
    if (!item?.equipped || (item.attunement?.required && !item.attuned)) continue;
    for (const f of asList(item.features)) if (isObj(f) && f.id) out.push(row(ch, d, `item:${item.id}`, item.name, f, iw, pools));
  }
  return out;
}

/* Every rider the character can attach to an attack or a save card in
   Play: the riders among their features (Custom, class, feats, equipped
   items) and their ready spells that ride on an attack (Hex, Hunter's
   Mark). `rows`: featureRows; `spells`: spellbookHelpers.spellRows. */
export function riderOptions(rows, spells = []) {
  const out = [];
  for (const r of rows) {
    if (!r.rider || !r.active) continue;
    out.push({
      key: r.key, name: r.feature.name || "Rider", owner: r.owner, from: r.from, featureId: r.feature.id,
      damage: r.rider.damage, conditions: r.rider.conditions, on: r.rider.on,
      toggle: r.isToggle, isOn: r.on, item: String(r.from).startsWith("item:") ? String(r.from).slice(5) : null,
    });
  }
  for (const s of spells) {
    if (!s.reached || !s.prepared) continue;
    for (const x of asList(s.riders)) {
      out.push({
        key: `${s.key}~${x.id}`, name: x.name && x.name !== s.spell.name ? `${s.spell.name}: ${x.name}` : s.spell.name, owner: s.owner,
        damage: asList(x.damage), conditions: asList(x.conditions), on: x.on, spell: true,
      });
    }
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
export const newOwnFeature = (category = "actions", extra = {}) => ({
  id: newId(), name: "", category, text: "", uses: null, action: null,
  // a rider starts with its extra damage
  ...(category === "riders" ? { rider: { damage: [{ dice: "1d6", type: "" }], on: "attacks" } } : {}),
  ...extra,
});

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
   bonuses. One damage only: a versatile weapon held in two hands (the
   inventory row's `two_handed`, set in the Inventory) uses its two-handed
   dice. */
export function weaponAttack(item, d) {
  const w = item?.weapon;
  if (!w?.damage) return null;
  const props = asList(w.properties);
  const str = d.abilities.str.mod;
  const dex = d.abilities.dex.mod;
  const ranged = w.kind === "ranged";
  // an effect can let these attacks use another ability when it's better (Bladework: Int while it's on)
  const usual = props.includes("finesse") ? Math.max(str, dex) : ranged ? dex : str;
  const other = d.attack_ability?.[ranged ? "ranged" : "melee"];
  const use = other && d.abilities[other] && d.abilities[other].mod > usual ? other : null;
  const mod = use ? d.abilities[use].mod : usual;
  const prof = proficientWith(item, d);
  const plus = { hit: Number(w.bonus?.attack) || 0, dmg: Number(w.bonus?.damage) || 0 };
  const hit = mod + (prof ? d.pb : 0) + plus.hit + (d.bonuses?.attack || 0);
  const dmgBonus = mod + plus.dmg + (d.bonuses?.damage || 0);
  const far = w.range ? `${w.range.normal ?? w.range}${w.range.long ? `/${w.range.long}` : ""} ft.` : "";
  const reach = props.includes("reach") ? "reach 10 ft." : "5 ft.";
  // a melee weapon's range is only its thrown range
  const range = ranged ? far : far && props.includes("thrown") ? `${reach} or thrown ${far}` : reach;
  const versatile = w.versatile ? (typeof w.versatile === "string" ? w.versatile : w.versatile.dice) : null;
  const twoHanded = !!versatile && !!item.two_handed;
  // the weapon's extra damage on every hit (no modifier: it's the weapon's own)
  const extra = asList(w.extra_damage).filter((p) => isObj(p) && p.dice).map((p) => ({ dice: p.dice, type: p.type || null }));
  return {
    name: item.name,
    hit,
    ability: use || null,
    proficient: prof,
    damage: [{ dice: twoHanded ? versatile : w.damage.dice, bonus: dmgBonus || null, type: w.damage.type }, ...extra],
    extra,
    // a versatile weapon: held in one hand or two (one damage shown, the row says which)
    canTwoHand: !!versatile,
    twoHanded,
    range,
    mastery: asList(w.mastery),
  };
}
