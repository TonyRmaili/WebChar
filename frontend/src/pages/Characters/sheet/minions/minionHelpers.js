// Pure logic for minions. Shape: claude/minion-contract.md in the project.
import { SECTION_TITLES } from "../../../Catalogues/Monsters/monsterHelpers";
import { actionWords, isNumber, regainWords, usesMax } from "../../../../utils/featureRuntime";

export const newId = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const toInt = (v, fallback = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* ─── Catalogue side ─────────────────────────────────────────────── */
// Finding monsters in the catalogue lives with the catalogue:
// pages/Catalogues/Monsters/catalogueMonsters.js (and its picker).

export const monsterHpAverage = (m) => Math.max(1, toInt(m?.hp?.average, 1));

export const monsterAc = (m) => {
  const first = Array.isArray(m?.ac) ? m.ac[0] : null;
  const v = toInt(first?.value, NaN);
  return Number.isFinite(v) ? v : null;
};

// "CR 1/4 · M undead" under a minion's name.
export { monsterSummary as monsterSubtitle } from "../../../Catalogues/Monsters/catalogueMonsters";

/* ─── Features with limited uses ─────────────────────────────────── */
// Every unit keeps its own uses: unit.charges[<feature id>] = uses left.

export const chargeKey = (feature) => feature?.id;

// Uses a feature starts with, or null if it isn't limited per unit.
export const itemMaxUses = (feature) => usesMax(feature?.uses);

const featuresOf = (monster) => (Array.isArray(monster?.features) ? monster.features : []);

export const chargedItems = (monster) =>
  featuresOf(monster)
    .filter((f) => f?.active !== false && itemMaxUses(f) != null)
    .map((f) => ({ key: chargeKey(f), max: itemMaxUses(f) }));

const freshCharges = (monster) =>
  Object.fromEntries(chargedItems(monster).map(({ key, max }) => [key, max]));

/* ─── Building and changing minions ──────────────────────────────── */

export const makeUnit = (monster, hp) => ({
  id: newId(),
  hp,
  charges: freshCharges(monster),
});

// A new minion group, ready to POST. The server adds id and created_at.
export const buildMinion = (monster, count = 1) => {
  // The catalogue's own bookkeeping is not part of the copy. A variant's
  // features start switched off (as on a campaign's copy).
  const { visibility, filters, srd, ...rest } = structuredClone(monster || {});
  const copy = { ...rest, features: featuresOf(rest).map((f) => ({ ...f, active: !f.variant })) };
  const hpMax = monsterHpAverage(copy);
  return {
    nickname: "",
    hp_max: hpMax,
    monster: copy,
    units: Array.from({ length: Math.max(1, toInt(count, 1)) }, () => makeUnit(copy, hpMax)),
  };
};

export const displayName = (minion) =>
  (minion?.nickname || "").trim() || minion?.monster?.name || "Minion";

export const hpMaxOf = (minion) => Math.max(1, toInt(minion?.hp_max, monsterHpAverage(minion?.monster)));

// Grow or shrink the group. New units start at full HP and full uses.
// Shrinking removes downed units first (last ones first), then standing
// units from the end. The rest keep their order, so numbers can shift.
export const resizeUnits = (minion, count) => {
  const n = clamp(toInt(count, 1), 1, 99);
  let units = [...(minion.units || [])];
  const hpMax = hpMaxOf(minion);

  while (units.length < n) units.push(makeUnit(minion.monster, hpMax));

  const toRemove = units.length - n;
  if (toRemove > 0) {
    const drop = new Set();
    for (let i = units.length - 1; i >= 0 && drop.size < toRemove; i--) {
      if (units[i].hp <= 0) drop.add(units[i].id);
    }
    for (let i = units.length - 1; i >= 0 && drop.size < toRemove; i--) {
      drop.add(units[i].id); // already-picked ids don't count twice
    }
    units = units.filter((u) => !drop.has(u.id));
  }

  return { ...minion, units };
};

// Change max HP. Units that were at full stay at full; damaged units keep
// their HP unless it is now above the new max.
export const setHpMax = (minion, value) => {
  const oldMax = hpMaxOf(minion);
  const newMax = clamp(toInt(value, oldMax), 1, 9999);
  const units = (minion.units || []).map((u) => ({
    ...u,
    hp: u.hp >= oldMax ? newMax : Math.min(u.hp, newMax),
  }));
  return { ...minion, hp_max: newMax, units };
};

// Add (heal) or subtract (damage) HP for the given unit ids.
export const changeHp = (minion, unitIds, delta) => {
  const hpMax = hpMaxOf(minion);
  const ids = new Set(unitIds);
  return {
    ...minion,
    units: (minion.units || []).map((u) =>
      ids.has(u.id) ? { ...u, hp: clamp(toInt(u.hp) + delta, 0, hpMax) } : u
    ),
  };
};

export const setUnitHp = (minion, unitId, value) => {
  const hpMax = hpMaxOf(minion);
  return {
    ...minion,
    units: (minion.units || []).map((u) =>
      u.id === unitId ? { ...u, hp: clamp(toInt(value, u.hp), 0, hpMax) } : u
    ),
  };
};

// Spend (-1) or restore (+1) one use of an effect for one unit.
export const changeUse = (minion, unitId, key, max, delta) => ({
  ...minion,
  units: (minion.units || []).map((u) => {
    if (u.id !== unitId) return u;
    const cur = toInt(u.charges?.[key], max);
    return { ...u, charges: { ...(u.charges || {}), [key]: clamp(cur + delta, 0, max) } };
  }),
});

// Full HP and all uses back, for every unit in the group.
export const restoreAll = (minion) => {
  const hpMax = hpMaxOf(minion);
  const charges = freshCharges(minion.monster);
  return {
    ...minion,
    units: (minion.units || []).map((u) => ({ ...u, hp: hpMax, charges: { ...charges } })),
  };
};

/* ─── Feature summaries for the Play cards ───────────────────────── */

// Sections shown at the table. Traits, lair and regional effects stay in
// the statblock popup.
export const PLAY_SECTIONS = ["actions", "bonus_actions", "reactions", "legendary_actions", "mythic_actions"].map((key) => ({
  key,
  title: SECTION_TITLES[key],
}));

// The features of one section that are switched on.
export const sectionFeatures = (monster, key) => featuresOf(monster).filter((f) => f && f.active !== false && (f.category || "traits") === key);

// Short chips for one feature: to-hit, save DC, range, damage (numbers still
// in words are shown as words).
export const effectChips = (feature) => {
  const a = feature?.action;
  if (!a) return [];
  const chips = [];
  if (a.attack) {
    const b = a.attack.bonus;
    if (b != null) chips.push({ kind: "hit", text: `${isNumber(b) ? `${b >= 0 ? "+" : ""}${b}` : `+${b}`} to hit` });
  }
  if (a.save) chips.push({ kind: "save", text: actionWords({ save: { ...a.save, damage: [] } }) });
  if (a.range || a.area) chips.push({ kind: "range", text: [a.range, a.area].filter(Boolean).join(" · ") });
  const dmg = actionWords({ damage: [...(a.attack?.damage || []), ...(a.save?.damage || []), ...(a.damage || [])] });
  if (dmg) chips.push({ kind: "damage", text: dmg });
  return chips;
};

// "Recharge 5–6" · "per day" · "per short rest"
export const rechargeLabel = (uses) => regainWords(uses);
