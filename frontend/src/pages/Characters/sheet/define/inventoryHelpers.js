import { asList, stateOf } from "../sheetHelpers";

/* Pure logic for the Inventory Define tab (version-2 file).

     inventory: {
       items: [ row ],
       currency: { pp, gp, ep, sp, cp },
       max_attunement: 3,
     }

   A row is a copy of the catalogue item (weapon, armor, charges, grants,
   modifiers, features…) plus what the character does with it:
     id            the row's own id
     item          the catalogue id (null for the player's own item)
     from          the layer that gave it ("class:fighter-xphb@1"), or "manual"
     qty, equipped, attuned, notes
     charges_used  charges spent (the max is the item's charges.max)
     consumable    true / false to override the guess from its type
     shown         false = no card in Play (◆ off); Play only has cards
                   for weapons, charges, consumables and item features
     edited        true once the player changed the item itself
     book          the item as it was before the first change ("back to
                   the book's": the catalogue's original, or the player's
                   own homebrew entry once saved there)

   Equipped (and attuned, when it needs it) items count on the sheet:
   armour and shield for AC, their modifiers, grants and features
   (utils/derive.js). */

export const num = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const newId = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/* ─── Coins ──────────────────────────────────────────────────────── */

// Highest to lowest, the order players read them on a sheet.
export const COINS = [
  { key: "pp", label: "Platinum", gp: 10 },
  { key: "gp", label: "Gold", gp: 1 },
  { key: "ep", label: "Electrum", gp: 0.5 },
  { key: "sp", label: "Silver", gp: 0.1 },
  { key: "cp", label: "Copper", gp: 0.01 },
];

// Total worth in gold, rounded to copper.
export const totalInGp = (currency) => {
  const cp = COINS.reduce((sum, c) => sum + num(currency?.[c.key]) * Math.round(c.gp * 100), 0);
  return cp / 100;
};

export const formatGp = (gp) => `${gp.toLocaleString(undefined, { maximumFractionDigits: 2 })} gp`;

/* ─── Reading ────────────────────────────────────────────────────── */

export const inventoryOf = (ch) => {
  const inv = ch?.inventory && typeof ch.inventory === "object" ? ch.inventory : {};
  return {
    ...inv,
    items: asList(inv.items),
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...(inv.currency || {}) },
    max_attunement: inv.max_attunement == null ? 3 : num(inv.max_attunement, 3),
  };
};

const NOT_MAGIC = new Set(["", "none", "unknown"]);
export const isMagic = (it) => !NOT_MAGIC.has(String(it?.rarity || "").toLowerCase()) || !!it?.attunement?.required || !!it?.charges;
export const needsAttunement = (it) => !!it?.attunement?.required;

// Things that get used up: shown in Play with a −1 button.
const CONSUMABLE_TYPES = new Set(["potion", "scroll", "ammunition", "poison", "explosive", "food_and_drink"]);
export const isConsumable = (it) => (typeof it?.consumable === "boolean" ? it.consumable : asList(it?.item_types).some((t) => CONSUMABLE_TYPES.has(t)));

// { max, cur, reset, regain } for an item with charges, or null.
export const chargesOf = (it) => {
  const max = num(it?.charges?.max, 0);
  if (max <= 0) return null;
  const used = Math.max(0, num(it.charges_used, 0));
  return { max, cur: Math.max(0, max - used), reset: it.charges.reset || "", regain: it.charges.regain || "" };
};

export const RESET_WORDS = { dawn: "at dawn", dusk: "at dusk", long: "on a long rest", short: "on a short rest", never: "never" };
export const regainText = (c) => (c ? [c.regain ? `regains ${c.regain}` : "regains all", RESET_WORDS[c.reset] || c.reset].filter(Boolean).join(" ") : "");

export const attunedCount = (items) => items.filter((i) => i?.attuned).length;

export const weightOf = (items) => items.reduce((sum, i) => sum + num(i?.weight) * Math.max(0, num(i?.qty, 1)), 0);

// The spells an item lets you cast: [{ id, cost }].
export const itemSpells = (it) =>
  asList(it?.grants?.spells).map((g) => ({ id: g.spell, cost: g.uses?.cost ?? null, atWill: g.uses === "at_will" })).filter((s) => s.id);

/* ─── Writers (each returns a patch for CharStore.patchChar) ─────── */

const withItems = (ch, fn) => {
  const inv = inventoryOf(ch);
  return { inventory: { ...(ch?.inventory || {}), items: fn(inv.items), currency: inv.currency } };
};

export const patchItem = (ch, id, patch) => withItems(ch, (items) => items.map((i) => (i?.id === id ? { ...i, ...patch } : i)));

/* ─── The item itself: edit, back to the book's, save to the catalogue ─── */

// What the character does with an item, kept through any edit of it.
export const SHEET_KEYS = ["id", "item", "from", "qty", "equipped", "attuned", "shown", "charges_used", "notes", "consumable", "edited", "book", "two_handed", "riders"];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const drop = (o, keys) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !keys.includes(k)));

// The item without the character's use of it (a catalogue record).
export const itemRecord = (it) => drop(it, [...SHEET_KEYS, "visibility", "created_by", "_sheet"]);

// The copy after the form saved `record` to this sheet only.
export function editedCopy(it, record) {
  return {
    ...drop(record, [...SHEET_KEYS, "visibility", "created_by", "_sheet"]),
    source: it.source ?? record.source, // still the book's (or your homebrew's) item, changed
    ...pick(it, SHEET_KEYS),
    edited: true,
    book: it.book || itemRecord(it),
  };
}

// The copy after it was saved to the catalogue as `saved` (the entry the
// server returned): it now points at that entry and matches it.
export const savedCopy = (it, saved) => ({ ...itemRecord(saved), ...pick(it, SHEET_KEYS), item: saved.id, edited: undefined, book: undefined });

// Back to the version it was before the first change.
export const restoredCopy = (it) => (it.book ? { ...it.book, ...pick(it, SHEET_KEYS), edited: undefined, book: undefined } : it);

export const replaceItem = (ch, row) => withItems(ch, (items) => items.map((i) => (i?.id === row.id ? row : i)));

// An item goes with the attacks exported from it to Custom (`link.item`).
export const removeItem = (ch, id) => {
  const patch = withItems(ch, (items) => items.filter((i) => i?.id !== id));
  const linked = (l) => l?.from === "manual" && asList(l.features).some((f) => f?.link?.item === id);
  if (!asList(ch?.layers).some(linked)) return patch;
  return { ...patch, layers: asList(ch.layers).map((l) => (linked(l) ? { ...l, features: asList(l.features).filter((f) => f?.link?.item !== id) } : l)) };
};

// A catalogue item: a copy with a row id. Plain gear you already carry
// gets its count raised instead (magic items stay one row each).
export function addFromCatalogue(ch, entry) {
  const items = inventoryOf(ch).items;
  const same = items.find((i) => i.item === entry.id && !isMagic(entry));
  if (same) return { patch: patchItem(ch, same.id, { qty: num(same.qty, 1) + 1 }), id: same.id };
  const copy = JSON.parse(JSON.stringify(entry));
  delete copy.visibility;
  const row = { ...copy, id: newId(), item: entry.id, from: "manual", qty: 1, equipped: false };
  return { patch: withItems(ch, (list) => [...list, row]), id: row.id };
}

/* A variant ("Frost Brand", "+1 Weapon") on one of the base items it
   applies to: the base's numbers (damage, weight, armour) with the
   variant's magic on top (rarity, attunement, text, grants, modifiers,
   charges), its weapon bonus merged in, its added properties appended.
   `item` is the variant's id; `base_item` the base's. */
export function variantItem(v, base) {
  const { id, kind, applies_to, name_format, name_remove, weapon, armor_overrides, properties_add, item_types, ...magic } = JSON.parse(JSON.stringify(v));
  const b = JSON.parse(JSON.stringify(base));
  const name = String(name_format || `${v.name} {base}`).replace("{base}", b.name);
  const out = { ...b, ...magic, kind: "item", id: v.id, name, base_item: b.id };
  delete out.base;
  if (weapon || b.weapon) out.weapon = { ...(b.weapon || {}), ...(weapon || {}), bonus: { ...(b.weapon?.bonus || {}), ...(weapon?.bonus || {}) } };
  if (armor_overrides && b.armor) out.armor = { ...b.armor, ...armor_overrides };
  if (asList(properties_add).length && out.weapon) out.weapon.properties = [...new Set([...asList(out.weapon.properties), ...asList(properties_add)])];
  out.item_types = [...new Set([...asList(b.item_types), ...asList(item_types)])];
  return out;
}

export const newOwnItem = () => ({ id: newId(), item: null, from: "manual", name: "", qty: 1, notes: "" });
export const addOwnItem = (ch, row) => withItems(ch, (items) => [...items, row]);

export const duplicateItem = (ch, it) => {
  const copy = { ...JSON.parse(JSON.stringify(it)), id: newId(), equipped: false, attuned: false, charges_used: 0 };
  return withItems(ch, (items) => {
    const i = items.findIndex((x) => x.id === it.id);
    return [...items.slice(0, i + 1), copy, ...items.slice(i + 1)];
  });
};

export const setCoin = (ch, coin, value) => {
  const inv = inventoryOf(ch);
  return { inventory: { ...(ch?.inventory || {}), items: inv.items, currency: { ...inv.currency, [coin]: Math.max(0, Math.trunc(num(value))) } } };
};

export const setMaxAttunement = (ch, n) => ({ inventory: { ...(ch?.inventory || {}), max_attunement: Math.max(0, Math.trunc(num(n, 3))) } });

export const matchesQuery = (it, q) => !q || String(it?.name || "").toLowerCase().includes(q) || String(it?.notes || "").toLowerCase().includes(q);

export { stateOf };
