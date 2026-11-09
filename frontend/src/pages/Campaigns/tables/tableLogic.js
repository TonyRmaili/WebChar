import { idGen } from "../../Characters/sheet/define/effectEditor";

/* ═══════════════════════════════════════════════════════════════════
   tableLogic.js — tables to roll on with real dice (no rolling here).
   Shape: claude/tables-contract.md in the project.

     { id, scope, name, category, die, notes,
       rows: [{ id, from, to, text, link }] }

   die     4, 6, 8, 10, 12, 20 or 100. A row covers from–to of it.
   text    what happens, in the DM's words ("2d6 goblins", "a storm").
           Nothing in it is rolled or checked.
   link    optional, a pointer — never a copy:
             { kind: "item", name, source }   a catalogue item
             { kind: "encounter", id }        one of this campaign's encounters
             { kind: "table", id }            roll on another table

   Ranges: each row starts where the one before it ended; changing where
   a row ends moves the next one along. Gaps, overlaps and numbers past
   the die are allowed while you write, and shown as warnings.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const toInt = (v, fallback) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

export const DICE = [4, 6, 8, 10, 12, 20, 100];
export const CATEGORIES = ["Encounters", "Loot", "Events", "Weather", "Rumours", "Names", "Other"];

export const newTable = () => ({ name: "", category: "", die: 20, notes: "", rows: [] });

export const dieOf = (table) => (DICE.includes(Number(table?.die)) ? Number(table.die) : 20);
export const rowsOf = (table) => asList(table?.rows);

/* ─── numbers as you'd read them off the die ─────────────────────── */

// d100: 01 … 99, 00 (= 100). Every other die: plain numbers.
export const dieNumber = (n, die) => (die === 100 ? (n === 100 ? "00" : String(n).padStart(2, "0")) : String(n));

export const rangeLabel = (row, die) => (row.from === row.to ? dieNumber(row.from, die) : `${dieNumber(row.from, die)}–${dieNumber(row.to, die)}`);

// What you typed after rolling: on a d100, "00" (or 0) is 100.
export const readRoll = (n, die) => (die === 100 && n === 0 ? 100 : n);

/* ─── rows ───────────────────────────────────────────────────────── */

// The row a roll lands on (the first, if rows overlap).
export const rowAt = (table, n) => rowsOf(table).find((r) => n >= r.from && n <= r.to) || null;

// A new row starts right after the last one ends (one number wide).
export function addRow(table) {
  const die = dieOf(table);
  const last = Math.max(0, ...rowsOf(table).map((r) => toInt(r.to, 0)));
  const at = Math.min(last + 1, die);
  return { ...table, rows: [...rowsOf(table), { id: idGen(), from: at, to: at, text: "", link: null }] };
}

export const removeRow = (table, id) => ({ ...table, rows: rowsOf(table).filter((r) => r.id !== id) });

export const changeRow = (table, id, patch) => ({ ...table, rows: rowsOf(table).map((r) => (r.id === id ? { ...r, ...patch } : r)) });

/* A row's range changed. Keep it sane (1 or more, `to` not below `from`),
   then keep its neighbours in step:
     the next row starts after it (shrinking; a row squeezed to nothing
     moves on and squeezes the next);
     the row before it ends where this one starts when they would overlap;
     a neighbour that touched it before still touches it (shrink 1–7 to
     1–5 and the row that started at 8 now starts at 6).
   Nothing is ever deleted; what can't fit shows up as a warning. */
export function setRange(table, id, from, to) {
  const rows = rowsOf(table).map((r) => ({ ...r }));
  const at = rows.findIndex((r) => r.id === id);
  if (at < 0) return table;
  const row = rows[at];
  const was = { from: row.from, to: row.to };
  row.from = Math.max(1, toInt(from, row.from));
  row.to = Math.max(row.from, toInt(to, row.to));

  const next = rows[at + 1];
  if (next && next.from === was.to + 1 && row.to < was.to) next.from = row.to + 1;
  const before = rows[at - 1];
  if (before && before.to === was.from - 1 && row.from > was.from) before.to = row.from - 1;

  // The next row gives up its start; only a row left with nothing moves on
  // (one number wide) and pushes the one after it in turn.
  for (let i = at + 1; i < rows.length; i += 1) {
    const before = rows[i - 1];
    const r = rows[i];
    if (r.from > before.to) break;
    r.from = before.to + 1;
    if (r.to >= r.from) break;
    r.to = r.from;
  }
  const prev = rows[at - 1];
  if (prev && prev.to >= row.from) prev.to = Math.max(prev.from, row.from - 1);

  return { ...table, rows };
}

// Share the die out over the rows, in their order (4 rows on a d20 →
// 1–5, 6–10, 11–15, 16–20; leftovers go to the first rows).
export function spreadEvenly(table) {
  const rows = rowsOf(table);
  const die = dieOf(table);
  if (!rows.length) return table;
  const each = Math.floor(die / rows.length);
  const extra = die % rows.length;
  let next = 1;
  return {
    ...table,
    rows: rows.map((r, i) => {
      const width = Math.max(1, each + (i < extra ? 1 : 0));
      const out = { ...r, from: next, to: next + width - 1 };
      next += width;
      return out;
    }),
  };
}

/* ─── warnings ───────────────────────────────────────────────────── */

// Turns a sorted list of numbers into [from, to] runs: 3,4,5,9 → [3,5],[9,9].
function runs(numbers) {
  const out = [];
  for (const n of numbers) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out;
}

/* What's not right yet (none of it stops you saving):
     gaps      [[from, to], …]  numbers no row covers — a roll there gives nothing
     overlaps  [[from, to], …]  numbers more than one row covers
     past      [[from, to], …]  numbers above the die */
export function checkRows(table) {
  const die = dieOf(table);
  const count = new Map();
  for (const r of rowsOf(table)) {
    for (let n = toInt(r.from, 1); n <= toInt(r.to, 0); n += 1) count.set(n, (count.get(n) || 0) + 1);
  }
  const gaps = [];
  const overlaps = [];
  const past = [];
  for (let n = 1; n <= die; n += 1) {
    if (!count.get(n)) gaps.push(n);
    else if (count.get(n) > 1) overlaps.push(n);
  }
  for (const n of [...count.keys()].sort((a, b) => a - b)) if (n > die) past.push(n);
  return { gaps: runs(gaps), overlaps: runs(overlaps), past: runs(past) };
}

export const hasProblems = (check) => check.gaps.length > 0 || check.overlaps.length > 0 || check.past.length > 0;

// "17–20" / "4 and 9–10"
export const runsLabel = (list, die) => {
  const parts = list.map(([a, b]) => (a === b ? dieNumber(a, die) : `${dieNumber(a, die)}–${dieNumber(b, die)}`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] || "";
};

/* ─── tables inside tables ───────────────────────────────────────── */

// Every table `id` leads to through its rows (itself not included).
export function reachableFrom(id, all) {
  const seen = new Set();
  const walk = (tid) => {
    const t = asList(all).find((x) => x.id === tid);
    for (const r of rowsOf(t)) {
      if (r.link?.kind !== "table" || seen.has(r.link.id)) continue;
      seen.add(r.link.id);
      walk(r.link.id);
    }
  };
  walk(id);
  return seen;
}

// Tables a row of `table` may point at: not itself, and none that leads
// back to it (that would loop forever). A table for all campaigns can
// only point at other tables for all campaigns.
export const linkableTables = (table, all) =>
  asList(all).filter((t) => t.id !== table.id && !reachableFrom(t.id, all).has(table.id) && (table.scope !== "all" || t.scope === "all"));

/* ─── words ──────────────────────────────────────────────────────── */

// What a link points at, by name. `encounters` and `tables` are this
// campaign's lists; what's gone (or kept in another campaign) says so.
export function linkName(link, { encounters, tables }) {
  if (!link) return "";
  if (link.kind === "item") return link.name || "an item";
  if (link.kind === "encounter") return asList(encounters).find((e) => e.id === link.id)?.name || "an encounter not in this campaign";
  if (link.kind === "table") return asList(tables).find((t) => t.id === link.id)?.name || "a table not in this campaign";
  return "";
}

// "d20 · 6 rows"
export const tableSummary = (table) => {
  const n = rowsOf(table).length;
  return `d${dieOf(table)} · ${n} ${n === 1 ? "row" : "rows"}`;
};

// Everything a search can match: name, category, notes and every row.
export const searchText = (table, names) =>
  [table.name, table.category, table.notes, ...rowsOf(table).flatMap((r) => [r.text, linkName(r.link, names)])].join(" ").toLowerCase();