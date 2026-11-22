import { useMemo } from "react";
import useCharStore from "../../../store/CharStore";
import { LIST_KINDS, derivedOf, granted } from "../../../utils/derive";

/* ═══════════════════════════════════════════════════════════════════
   sheetHelpers — reading and changing a version-2 character on the sheet.

   Reading: useSheet() gives the open character and its derived numbers
   (utils/derive.js), worked out again only when the character changes.

   Changing: every helper here returns a PATCH for CharStore.patchChar,
   i.e. { <top-level key>: <new value> }. Where things go:

     profile, lore, exp, name    plain fields
     state                       live values (counts what is used)
     abilities.base              the base scores
     the manual layer            what the player adds or changes by hand:
         grants     { skills: ["stealth"], speed: { fly: 30 }, … }   added
         removes    { skills: ["perception"], senses: ["darkvision"] } taken away
         modifiers  [{ target: "check.stealth", add: 2 }, { target: "ac", set: 18 }]
         custom_skills { cooking: { label: "Cooking", ability: "wis" } }

   The manual layer is the one with from: "manual". Rebuilding the other
   layers (level up, swapping a background) never touches it.
   ═══════════════════════════════════════════════════════════════════ */

export const asList = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export const signed = (n) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n}`);
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
export const labelOf = (id) => cap(String(id ?? "").replace(/_/g, " "));

export const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

/* ─── reading ────────────────────────────────────────────────────── */

// The open character, its derived numbers and patchChar, for a tab.
export function useSheet() {
  const ch = useCharStore((s) => s.charData);
  const patchChar = useCharStore((s) => s.patchChar);
  const d = useMemo(() => derivedOf(ch), [ch]);
  return { ch, d, patchChar };
}

export const stateOf = (ch) => (isObj(ch?.state) ? ch.state : {});

/* ─── the manual layer ───────────────────────────────────────────── */

const EMPTY_MANUAL = { from: "manual", label: "Your changes", grants: {}, removes: {}, modifiers: [], custom_skills: {}, features: [], spells: [] };

export const manualOf = (ch) => ({ ...EMPTY_MANUAL, ...(asList(ch?.layers).find((l) => l?.from === "manual") || {}) });

// { layers } with the manual layer changed by fn(manual) → new manual.
export function withManual(ch, fn) {
  const layers = asList(ch?.layers);
  const next = fn(manualOf(ch));
  const has = layers.some((l) => l?.from === "manual");
  return { layers: has ? layers.map((l) => (l?.from === "manual" ? next : l)) : [...layers, next] };
}

// Labels of the layers (not the manual one) that grant `id` as `kind`,
// e.g. sourcesOf(ch, "skills", "stealth") → ["Rogue 1"].
export function sourcesOf(ch, kind, id) {
  const out = [];
  for (const l of asList(ch?.layers)) {
    if (!l || l.from === "manual") continue;
    const g = l.grants?.[kind];
    const has = Array.isArray(g) ? g.includes(id) : isObj(g) && id in g;
    if (has) out.push(l.label || l.from);
  }
  return out;
}

// What the other layers give, before the player's own changes.
export const grantedByLayers = (ch) => granted({ ...ch, layers: asList(ch?.layers).filter((l) => l?.from !== "manual") })[0];

const without = (list, id) => asList(list).filter((x) => x !== id);
const withIt = (list, id) => (asList(list).includes(id) ? asList(list) : [...asList(list), id]);

/* Make the character have `id` in a list kind (skills, saves, tools,
   languages, armor, weapons, expertise…) or not. Something another layer
   gives is taken away with `removes`; anything else is added to the
   manual layer's grants. */
export function setHas(ch, kind, id, want) {
  const base = grantedByLayers(ch);
  const fromLayers = asList(base[kind]).includes(id);
  return withManual(ch, (m) => {
    const grants = { ...m.grants };
    const removes = { ...m.removes };
    if (want) {
      removes[kind] = without(removes[kind], id);
      grants[kind] = fromLayers ? without(grants[kind], id) : withIt(grants[kind], id);
    } else {
      grants[kind] = without(grants[kind], id);
      removes[kind] = fromLayers ? withIt(removes[kind], id) : without(removes[kind], id);
    }
    return { ...m, grants: tidy(grants), removes: tidy(removes) };
  });
}

// none (0) → proficient (1) → expertise (2): a skill's proficiency level.
export function setSkillLevel(ch, skill, level) {
  const step1 = { ...ch, ...setHas(ch, "skills", skill, level >= 1) };
  return setHas(step1, "expertise", skill, level >= 2);
}

export const nextLevel = (level) => (level + 1) % 3;
export const LEVEL_WORD = ["none", "proficient", "expertise"];

// Speed or senses: set a value of the player's own (number or flag), or
// take it away (value null). A value from another layer is removed with `removes`.
export function setMovement(ch, kind, key, value) {
  const base = grantedByLayers(ch);
  const fromLayers = key in (base[kind] || {});
  return withManual(ch, (m) => {
    const grants = { ...m.grants, [kind]: { ...(m.grants?.[kind] || {}) } };
    const removes = { ...m.removes };
    if (value == null) {
      delete grants[kind][key];
      removes[kind] = fromLayers ? withIt(removes[kind], key) : without(removes[kind], key);
    } else {
      grants[kind][key] = value;
      removes[kind] = without(removes[kind], key);
    }
    return { ...m, grants: tidy(grants), removes: tidy(removes) };
  });
}

// A speed or sense distance. One another layer gives is overridden with
// a `set` modifier (speed.fly, senses.darkvision), so the layer's own value
// comes back when the override is cleared; one of the player's own is
// written in the manual grants. null takes it away.
export function setDistance(ch, kind, type, value) {
  const target = `${kind}.${type}`;
  const cleared = { ...ch, ...setManualSet(ch, target, null) };
  if (value == null) return setMovement(cleared, kind, type, null);
  const layerValue = grantedByLayers(ch)[kind]?.[type];
  if (layerValue === undefined) return setMovement(cleared, kind, type, value);
  return layerValue === value ? withManual(cleared, (m) => m) : setManualSet(ch, target, value);
}

// An on/off flag that rides with a speed or sense (hover, devils_sight).
export const setFlag = (ch, kind, key, on) => setMovement(ch, kind, key, on ? true : null);

// A resistance, immunity, vulnerability or condition immunity.
export function setDefense(ch, kind, id, want) {
  const fromLayers = asList(grantedByLayers(ch).defenses?.[kind]).includes(id);
  return withManual(ch, (m) => {
    const grants = { ...m.grants, defenses: { ...(m.grants?.defenses || {}) } };
    const removes = { ...m.removes, defenses: { ...(m.removes?.defenses || {}) } };
    if (want) {
      removes.defenses[kind] = without(removes.defenses[kind], id);
      grants.defenses[kind] = fromLayers ? without(grants.defenses[kind], id) : withIt(grants.defenses[kind], id);
    } else {
      grants.defenses[kind] = without(grants.defenses[kind], id);
      removes.defenses[kind] = fromLayers ? withIt(removes.defenses[kind], id) : without(removes.defenses[kind], id);
    }
    grants.defenses = tidy(grants.defenses);
    removes.defenses = tidy(removes.defenses);
    return { ...m, grants: tidy(grants), removes: tidy(removes) };
  });
}

// Drop empty lists and objects, so the file stays readable.
function tidy(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : v != null) out[k] = v;
  }
  return out;
}

/* ─── the player's own numbers (manual modifiers) ────────────────── */

const isAdd = (m) => m?.add != null && m.set == null && m.min == null && !asList(m.requires).length;

// The player's "+n" on a target (0 when none).
export const manualAdd = (ch, target) => toInt(asList(manualOf(ch).modifiers).find((m) => m?.target === target && isAdd(m))?.add, 0);

// Write the player's "+n" on a target (0 removes it).
export const setManualAdd = (ch, target, n) =>
  withManual(ch, (m) => {
    const rest = asList(m.modifiers).filter((x) => !(x?.target === target && isAdd(x)));
    return { ...m, modifiers: n ? [...rest, { target, add: n }] : rest };
  });

// The player's own final value for a target ("AC is 18"), or null.
export const manualSet = (ch, target) => {
  const hit = asList(manualOf(ch).modifiers).find((m) => m?.target === target && m.set != null);
  return hit ? toInt(hit.set, null) : null;
};

export const setManualSet = (ch, target, value) =>
  withManual(ch, (m) => {
    const rest = asList(m.modifiers).filter((x) => !(x?.target === target && x.set != null));
    return { ...m, modifiers: value == null ? rest : [...rest, { target, set: value }] };
  });

/* ─── custom skills ──────────────────────────────────────────────── */

const toKey = (name) =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "skill";

export function addCustomSkill(ch, name, ability, existing) {
  let key = toKey(name);
  for (let i = 2; existing[key]; i += 1) key = `${toKey(name)}_${i}`;
  return withManual(ch, (m) => ({ ...m, custom_skills: { ...(m.custom_skills || {}), [key]: { label: name.trim(), ability } } }));
}

export function removeCustomSkill(ch, key) {
  const cleared = { ...ch, ...setSkillLevel(ch, key, 0) };
  return withManual(cleared, (m) => {
    const custom = { ...(m.custom_skills || {}) };
    delete custom[key];
    return { ...m, custom_skills: custom, modifiers: asList(m.modifiers).filter((x) => x?.target !== `check.${key}`) };
  });
}

/* ─── state ──────────────────────────────────────────────────────── */

export const patchState = (ch, patch) => ({ state: { ...stateOf(ch), ...patch } });

export { LIST_KINDS };
