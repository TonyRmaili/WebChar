/* Pure logic for the Inventory Define tab.

   Data shape (unchanged, a few optional fields added for catalogue items):
     inventory: {
       magic:   [{ id, name, amount, attuned, notes, charges, source?, rarity?, req_attune? }],
       mundane: [{ id, name, amount, notes, consumed, source? }],
       currency: { pp, gp, ep, sp, cp },
       max_attunment,            // (sic) kept as-is, other files read this key
     }
   charges: { has, max_charges, reset_amount ("full" or a number), current_charges }

   Note: on gear, `consumed: true` means "this is a consumable" — Play lists
   those under Consumables with a −1 button. The tab now calls it that. */

export const asList = (v) => (Array.isArray(v) ? v : []);

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

export const coinLabel = (key) => COINS.find((c) => c.key === key)?.label ?? key;

// Total worth in gold, rounded to copper.
export const totalInGp = (currency) => {
  const cp = COINS.reduce((sum, c) => sum + num(currency?.[c.key]) * Math.round(c.gp * 100), 0);
  return cp / 100;
};

export const formatGp = (gp) =>
  `${gp.toLocaleString(undefined, { maximumFractionDigits: 2 })} gp`;

/* ─── Whole inventory ────────────────────────────────────────────── */

const EMPTY_CURRENCY = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

// Fills in missing parts for reading. Nothing is saved from this alone.
export const normalizeInventory = (raw) => {
  const inv = raw && typeof raw === "object" ? raw : {};
  return {
    ...inv,
    magic: asList(inv.magic),
    mundane: asList(inv.mundane),
    currency: { ...EMPTY_CURRENCY, ...(inv.currency || {}) },
    max_attunment: num(inv.max_attunment, 0),
  };
};

export const attunedCount = (inv) => asList(inv?.magic).filter((m) => m?.attuned).length;

/* ─── Rows ───────────────────────────────────────────────────────── */

export const NO_CHARGES = { has: false, max_charges: 0, reset_amount: "full", current_charges: 0 };

// Items added from the catalogue carry their source; those are read-only
// here (their card opens instead). Items without a source are the
// player's own — a glowing rock, a letter — and can be edited and noted.
export const isCatalogueItem = (row) => !!row?.source;

export const newMagicItem = () => ({
  id: newId(),
  name: "",
  amount: 1,
  attuned: false,
  notes: "",
  charges: { ...NO_CHARGES },
});

export const newGearItem = (consumable = false) => ({
  id: newId(),
  name: "",
  amount: 1,
  notes: "",
  consumed: consumable,
});

// Turning charges on starts full; turning them off clears them.
export const toggleCharges = (charges, on) => {
  if (!on) return { ...NO_CHARGES };
  const max = Math.max(1, num(charges?.max_charges, 1));
  return { has: true, max_charges: max, reset_amount: charges?.reset_amount ?? "full", current_charges: max };
};

export const duplicateRow = (row) => ({
  ...structuredClone(row),
  id: newId(),
  name: row.name ? `${row.name} (copy)` : "",
});

/* ─── Catalogue items ────────────────────────────────────────────── */

export const catalogueKey = (e) => `${e?.name}|${e?.source}`;

// Types that get used up — these go to gear as consumables so Play shows
// them with a −1 button, even when they're magical (potions, scrolls).
const CONSUMABLE_TYPES = new Set(["Potion", "Scroll", "Ammunition", "Poison", "Explosive"]);

const isMagicRarity = (r) => {
  const rarity = String(r || "").toLowerCase();
  return rarity !== "" && rarity !== "none" && rarity !== "unknown";
};

// Charge value from the catalogue: a number, { fixed }, or { roll }.
const chargeNumber = (val) => {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && val.fixed != null) return num(val.fixed, null);
  return null;
};

// Average of a { roll: { dice_amount, die_type, mod } }, rounded down.
const rollAverage = (val) => {
  const roll = val && typeof val === "object" ? val.roll : null;
  if (!roll) return null;
  const sides = num(String(roll.die_type || "").replace(/\D/g, ""), 0);
  if (!sides) return null;
  return Math.floor(num(roll.dice_amount, 1) * ((sides + 1) / 2) + num(roll.mod, 0));
};

// Which list a catalogue item lands in.
export const catalogueTarget = (entry) => {
  const types = asList(entry?.types);
  if (types.some((t) => CONSUMABLE_TYPES.has(t))) return "consumable";
  if (entry?.charged || entry?.reqAttune || isMagicRarity(entry?.rarity)) return "magic";
  return "gear";
};

// Charges from the catalogue's `charged` block. A rolled regain
// ("1d6+1 at dawn") is stored as its average.
const chargesFromCatalogue = (charged) => {
  const max = chargeNumber(charged?.max_charges);
  if (!charged || !max) return { ...NO_CHARGES };

  const fixedRegain = chargeNumber(charged.amount);
  const avg = rollAverage(charged.amount);
  let reset = "full";
  if (fixedRegain != null && fixedRegain < max) reset = fixedRegain;
  else if (avg != null && avg < max) reset = Math.max(1, avg);

  return { has: true, max_charges: max, reset_amount: reset, current_charges: max };
};

// New row for a catalogue entry, plus which list it belongs in.
export const rowFromCatalogue = (entry) => {
  const target = catalogueTarget(entry);
  const base = { id: newId(), name: entry.name, amount: 1, source: entry.source || "" };

  if (target === "magic") {
    return {
      list: "magic",
      row: {
        ...base,
        attuned: false,
        charges: chargesFromCatalogue(entry.charged),
        rarity: entry.rarity || "",
        req_attune: entry.reqAttune || false,
      },
    };
  }
  return { list: "mundane", row: { ...base, consumed: target === "consumable" } };
};

// The same item: same name, and the same source — or a hand-typed row
// with no source, which then picks up the catalogue's source.
const sameItem = (row, entry) =>
  String(row?.name || "").trim().toLowerCase() === String(entry?.name || "").trim().toLowerCase() &&
  (!row.source || row.source === entry.source);

// Adding something you already carry bumps its amount instead of a new row.
export const addFromCatalogue = (inv, entry) => {
  const { list, row } = rowFromCatalogue(entry);
  const rows = asList(inv[list]);
  const existing = rows.find((r) => sameItem(r, entry));
  if (existing) {
    const bumped = { ...existing, amount: num(existing.amount, 1) + 1, source: existing.source || entry.source || "" };
    return { inv: { ...inv, [list]: rows.map((r) => (r === existing ? bumped : r)) }, id: existing.id, list };
  }
  return { inv: { ...inv, [list]: [...rows, row] }, id: row.id, list };
};

// How many of a catalogue entry the character already has (any list).
export const ownedCount = (inv, entry) =>
  [...asList(inv?.magic), ...asList(inv?.mundane)]
    .filter((r) => sameItem(r, entry))
    .reduce((sum, r) => sum + num(r.amount, 1), 0);

export const matchesQuery = (row, q) =>
  !q || String(row?.name || "").toLowerCase().includes(q) || String(row?.notes || "").toLowerCase().includes(q);