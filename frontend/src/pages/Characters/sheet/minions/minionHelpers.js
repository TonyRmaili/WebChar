// Pure logic for minions. Shape: claude/minion-contract.md in the project.
import { EFFECT_SECTIONS, formatCR, formatSource, titleCase } from "../../../Catalogues/Monsters/monsterHelpers";

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

// The catalogue keeps monsters grouped by source file; the picker wants
// one flat list.
export const flattenCatalogue = (monstersData) => {
  const root = monstersData?.monsters;
  if (!root || typeof root !== "object") return [];
  const out = [];
  for (const list of Object.values(root)) if (Array.isArray(list)) out.push(...list);
  return out;
};

export const monsterKey = (m) => `${m?.name}|${m?.source}`;

export const monsterHpAverage = (m) => Math.max(1, toInt(m?.hp?.average, 1));

export const monsterAc = (m) => {
  const first = Array.isArray(m?.ac) ? m.ac[0] : null;
  const v = toInt(first?.value, NaN);
  return Number.isFinite(v) ? v : null;
};

export const monsterSubtitle = (m) => {
  const size = (m?.size || []).join("/");
  const type = typeof m?.type === "string" ? m.type : m?.type?.type || "";
  return [formatCR(m?.cr), [size, type].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
};

export { formatSource };

/* ─── Effects with limited uses ──────────────────────────────────── */

export const chargeKey = (sectionKey, item) => `${sectionKey}:${item?.name}`;

// Uses an item starts with, or null if it isn't limited per unit.
export const itemMaxUses = (item) => {
  const c = item?.charges;
  if (!c) return null;
  const max = toInt(c.max_charges ?? c.per_rest_count, NaN);
  return Number.isFinite(max) && max > 0 ? max : null;
};

export const chargedItems = (monster) => {
  const out = [];
  for (const { key } of EFFECT_SECTIONS) {
    for (const item of monster?.effects?.[key]?.items || []) {
      const max = itemMaxUses(item);
      if (max != null) out.push({ key: chargeKey(key, item), max });
    }
  }
  return out;
};

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
  // The visibility flag is a catalogue concern, not part of the copy.
  const { visibility, ...copy } = monster || {};
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

/* ─── Effect summaries for the Play cards ────────────────────────── */

// Sections shown at the table. Traits, lair and regional effects stay in
// the statblock popup.
export const PLAY_SECTIONS = EFFECT_SECTIONS.filter(({ key }) =>
  ["actions", "bonus_actions", "reactions", "legendary_actions", "mythic_actions"].includes(key)
);

const signed = (n) => `${n >= 0 ? "+" : ""}${n}`;

export const formatDamages = (damages) =>
  (damages || [])
    .map((d) => {
      const dice = d?.dice_count && d?.dice_size ? `${d.dice_count}${d.dice_size}` : d?.dice_size || "";
      const mod = toInt(d?.mod, 0);
      const base = `${dice}${mod ? signed(mod) : ""}` || (mod ? String(mod) : "");
      return [base, d?.damage_type ? titleCase(d.damage_type) : ""].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(" + ");

// Short chips for one effect item: to-hit, save DC, range, damage.
export const effectChips = (item) => {
  const chips = [];
  if (item?.attack) {
    chips.push({ kind: "hit", text: `${signed(toInt(item.attack.hit_bonus, 0))} to hit` });
  }
  if (item?.save?.target) {
    const dc = toInt(item.save.dc_bonus, 0);
    chips.push({
      kind: "save",
      text: `${String(item.save.target).toUpperCase()}${dc ? ` DC ${dc}` : " save"}${
        item.save.half_damage ? " · half" : ""
      }`,
    });
  }
  if (item?.range) chips.push({ kind: "range", text: `${item.range} ft` });

  const dmg = formatDamages([...(item?.attack?.damages || []), ...(item?.save?.damages || [])]);
  if (dmg) chips.push({ kind: "damage", text: dmg });
  return chips;
};

export const rechargeLabel = (charges) => {
  if (!charges) return "";
  if (charges.reset_type === "recharge_dice") {
    const d = String(charges.recharge_dice || "6");
    return d === "6" ? "Recharge 6" : `Recharge ${d}–6`;
  }
  if (charges.reset_type === "long_rest") return "per day";
  if (charges.reset_type === "short_rest") return "per short rest";
  return "";
};