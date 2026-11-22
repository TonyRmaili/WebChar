/* Pure logic for the Class tab.

   A class's features are the copies on its level layers
   ("class:fighter-xphb@3"). A copy is the subclass's when it says so
   (`subclass: true`, the player's own) or when its id starts with the
   subclass's id ("fighter-xphb:battle-master-xphb:combat-superiority");
   otherwise it's the class's core. The player's own class features live
   on the level layer they belong to, with `own: true`, so they go when
   that level goes (level down) and stay through everything else. */

import { asList, stateOf } from "../sheetHelpers";
import { isOptionFeature, usesKey } from "../featureHelpers";

const LEVEL_FROM = /^class:([^@]+)@(\d+)$/;

export const levelFrom = (classId, level) => `class:${classId}@${level}`;

export const isSubclassFeature = (f, subclassId) =>
  f?.subclass === true || (f?.subclass !== false && !!subclassId && String(f?.id || "").startsWith(`${subclassId}:`));

/* rows: featureHelpers.featureRows(ch, d). For one class row of derive's
   `classes`: { core: [{level, rows}], subclass: [{level, rows}] }, by level. */
export function classFeatureGroups(rows, cls) {
  const core = new Map();
  const sub = new Map();
  for (const r of rows) {
    const m = LEVEL_FROM.exec(r.from);
    if (!m || m[1] !== cls.id) continue;
    if (isOptionFeature(r.feature)) continue; // picked options: the Spellbook's and Feats & Options' tabs
    const level = Number(m[2]);
    const into = isSubclassFeature(r.feature, cls.subclass) ? sub : core;
    if (!into.has(level)) into.set(level, []);
    into.get(level).push({ ...r, level });
  }
  const list = (map) => [...map.entries()].sort((a, b) => a[0] - b[0]).map(([level, rs]) => ({ level, rows: rs }));
  return { core: list(core), subclass: list(sub) };
}

/* Move one of the player's own features to another level layer of the
   same class (and/or between core and subclass). Its spent uses move
   with it. Returns a patch. */
export function moveOwnClassFeature(ch, fromLayer, toLayer, id, patch = {}) {
  let moved = null;
  const without = asList(ch.layers).map((l) => {
    if (l?.from !== fromLayer) return l;
    moved = asList(l.features).find((f) => f?.id === id) || null;
    return { ...l, features: asList(l.features).filter((f) => f?.id !== id) };
  });
  if (!moved) return {};
  const layers = without.map((l) => (l?.from === toLayer ? { ...l, features: [...asList(l.features), { ...moved, ...patch }] } : l));
  const st = stateOf(ch);
  const uses = { ...(st.uses_used || {}) };
  const oldKey = usesKey(fromLayer, id);
  if (uses[oldKey] != null && fromLayer !== toLayer) {
    uses[usesKey(toLayer, id)] = uses[oldKey];
    delete uses[oldKey];
  }
  return { layers, state: { ...st, uses_used: uses } };
}
