import { asList, manualOf, withManual } from "./sheetHelpers";
import { patchFeature, resourceRows } from "./featureHelpers";

/* ═══════════════════════════════════════════════════════════════════
   resourceHelpers — what the Resources tab changes (version-2 file).
   Every writer returns a patch for CharStore.patchChar.

   Everything here is the player's to decide; the numbers the class
   levels give are only the starting point (utils/derive.js):

     spell slots   manual.slot_overrides { "<level>": count }
     pact slots    manual.pact_overrides { "<level>": count }  (any level, up to 9)
     pools         manual.resources [{ id, name, max, reset, short_rest, die }]
                     a new id   = a pool of the player's own
                     a class id = only the fields written replace the book's
                     removed: true hides a class pool

   A count lives in one place: a feature has its own `uses`, or spends
   from a pool (`consumes: { resource, amount }`). Several features can
   spend the same pool (Second Wind and Tactical Mind both spend the
   Second Wind pool), and Play shows that pool's dots on each of them.
   ═══════════════════════════════════════════════════════════════════ */

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/* ─── slots ──────────────────────────────────────────────────────── */

const OVERRIDE_KEY = { slots: "slot_overrides", pact: "pact_overrides" };

// The player's own count for a slot level, or null (= the book's).
export const slotOverride = (ch, kind, level) => {
  const v = manualOf(ch)[OVERRIDE_KEY[kind]]?.[String(level)];
  return Number.isInteger(v) ? v : null;
};

// Write the player's count for a level (null = back to the book's).
export const setSlotOverride = (ch, kind, level, count) =>
  withManual(ch, (m) => {
    const key = OVERRIDE_KEY[kind];
    const next = { ...(isObj(m[key]) ? m[key] : {}) };
    if (count == null) delete next[String(level)];
    else next[String(level)] = Math.max(0, Math.min(9, Math.trunc(count)));
    return { ...m, [key]: next };
  });

// [{ level, count, book, own }] for levels 1–9 of one kind, from derive.
export function slotTable(ch, d, kind) {
  const book = kind === "slots" ? asList(d?.spell_slots?.book?.slots) : [];
  const bookPact = kind === "pact" ? Object.fromEntries(asList(d?.spell_slots?.book?.pact).map((p) => [p.level, p.count])) : {};
  const now = kind === "slots" ? asList(d?.spell_slots?.slots) : [];
  const nowPact = kind === "pact" ? Object.fromEntries(asList(d?.spell_slots?.pact).map((p) => [p.level, p.count])) : {};
  return Array.from({ length: 9 }, (_, i) => {
    const level = i + 1;
    const own = slotOverride(ch, kind, level);
    return {
      level,
      count: kind === "slots" ? now[i] || 0 : nowPact[level] || 0,
      book: kind === "slots" ? book[i] || 0 : bookPact[level] || 0,
      own,
    };
  });
}

/* ─── pools ──────────────────────────────────────────────────────── */

// The player's entry for a pool (their changes, or their own pool).
export const poolEntry = (ch, id) => asList(manualOf(ch).resources).find((r) => r?.id === id) || null;

// Pools with what's left and which features spend them.
export function poolRows(ch, d, features) {
  return resourceRows(ch, d).map((p) => ({
    ...p,
    entry: poolEntry(ch, p.id),
    spentBy: asList(features).filter((r) => r.feature?.consumes?.resource === p.id),
  }));
}

// Pools the player hid (class pools with removed: true), to bring back.
export const hiddenPools = (ch) => asList(manualOf(ch).resources).filter((r) => r?.removed);

// Change a pool: the fields given replace what it has (a class pool keeps the rest from the book).
export const patchPool = (ch, id, patch) =>
  withManual(ch, (m) => {
    const list = asList(m.resources);
    const has = list.some((r) => r?.id === id);
    return { ...m, resources: has ? list.map((r) => (r?.id === id ? { ...r, ...patch } : r)) : [...list, { id, ...patch }] };
  });

const slug = (name) =>
  String(name || "pool")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "pool";

// A free id for a new pool, from its name.
export const newPoolId = (d, name) => {
  const taken = new Set(asList(d?.resources).map((r) => r.id));
  let id = slug(name);
  for (let i = 2; taken.has(id); i += 1) id = `${slug(name)}_${i}`;
  return id;
};

export const addOwnPool = (ch, d, name = "New pool") => {
  const id = newPoolId(d, name);
  return { patch: patchPool(ch, id, { name, max: 1, reset: "long" }), id };
};

// The player's own pool goes; a class pool is hidden (the book's comes back with "restore").
export const removePool = (ch, pool) =>
  withManual(ch, (m) => {
    const rest = asList(m.resources).filter((r) => r?.id !== pool.id);
    return { ...m, resources: pool.own ? rest : [...rest, { id: pool.id, removed: true }] };
  });

// Back to the book's numbers (drops the player's changes, or un-hides it).
export const restorePool = (ch, id) => withManual(ch, (m) => ({ ...m, resources: asList(m.resources).filter((r) => r?.id !== id) }));

/* ─── a feature's uses ───────────────────────────────────────────── */

// A feature's own uses become a pool other features can spend too.
export function turnIntoPool(ch, d, row) {
  const f = row.feature;
  const id = newPoolId(d, f.name || "pool");
  const withPool = { ...ch, ...patchPool(ch, id, { name: f.name || "Pool", max: f.uses?.max ?? 1, reset: f.uses?.reset || "long" }) };
  const p = patchFeature(withPool, row.from, f.id, { uses: null, consumes: { resource: id, amount: 1 } });
  // Both changes live in `layers`, unless the feature sits on an item.
  return p.inventory ? { layers: withPool.layers, inventory: p.inventory } : { layers: p.layers };
}
