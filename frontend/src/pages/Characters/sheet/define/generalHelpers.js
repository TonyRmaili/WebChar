import { XP_BY_LEVEL } from "../../../../utils/Constants";

/* Pure logic for the General Define tab. The numbers themselves come from
   utils/derive.js; this only has what the tab needs on top of that. */

export const SPEED_TYPES = ["walk", "fly", "swim", "climb", "burrow"];
export const SENSE_TYPES = ["darkvision", "blindsight", "tremorsense", "truesight"];

// The flag that rides with a speed or sense, shown beside it.
export const FLAGS = { fly: { key: "hover", label: "hover" }, darkvision: { key: "devils_sight", label: "devil's sight" } };
const FLAG_KEYS = new Set(Object.values(FLAGS).map((f) => f.key));

// Distances to list: numbers (and "walk"-style values), never the flags.
export const distanceEntries = (obj, order) => {
  const keys = Object.keys(obj || {}).filter((k) => !FLAG_KEYS.has(k) && typeof obj[k] !== "boolean");
  return [...order.filter((k) => keys.includes(k)), ...keys.filter((k) => !order.includes(k))];
};

export const DEFENSE_KINDS = [
  { key: "resist", label: "Resistances" },
  { key: "immune", label: "Immunities" },
  { key: "vulnerable", label: "Vulnerabilities" },
  { key: "condition_immune", label: "Condition immunities" },
];

export const PROFICIENCY_KINDS = [
  { key: "armor", label: "Armour" },
  { key: "weapons", label: "Weapons" },
  { key: "tools", label: "Tools" },
  { key: "languages", label: "Languages" },
  { key: "weapon_masteries", label: "Weapon masteries" },
];

// "light_crossbow" → "light_crossbow" from what a player types ("Light Crossbow").
export const toId = (text) =>
  String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

// "5d10 + 2d6", biggest die first.
export const hitDiceLabel = (hd) =>
  Object.entries(hd || {})
    .sort(([a], [b]) => Number(b.slice(1)) - Number(a.slice(1)))
    .map(([die, n]) => `${n}${die}`)
    .join(" + ");

/* ─── Experience ─────────────────────────────────────────────────── */

export const expOf = (ch) => Math.max(0, Math.trunc(Number(ch?.exp) || 0));

// Level the XP alone would give, and what the next one needs.
export const xpProgress = (xp) => {
  let level = 1;
  for (let l = 1; l <= 20; l++) if (xp >= (XP_BY_LEVEL[l] ?? Infinity)) level = l;
  const floor = XP_BY_LEVEL[level] ?? 0;
  const next = level < 20 ? XP_BY_LEVEL[level + 1] : null;
  return { level, floor, next, fraction: next ? Math.min(1, (xp - floor) / (next - floor)) : 1 };
};

export const formatNumber = (n) => Number(n || 0).toLocaleString();

/* ─── Leveling ───────────────────────────────────────────────────── */

const ABILITY_WORD = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };

/* A class's multiclass requirement the scores don't meet, in words
   ("Needs Int 13."), or null. Only a warning: nothing is blocked.
   scores: { str: 15, … } */
export function requirementProblem(cls, scores) {
  const groups = cls?.multiclass?.requires || [];
  if (!groups.length) return null;
  const met = groups.some((g) => Object.entries(g).every(([a, n]) => (scores?.[a] ?? 0) >= n));
  if (met) return null;
  const need = groups.map((g) => Object.entries(g).map(([a, n]) => `${ABILITY_WORD[a] || a} ${n}`).join(" and ")).join(" or ");
  return `Needs ${need} to multiclass.`;
}
