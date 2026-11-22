import { currentHp } from "../../../../utils/derive";

/* Pure logic for the Health section of the Play panel (version-2 file).

   The numbers come from utils/derive.js; the live values sit in `state`,
   which counts what is USED, so nothing here needs saving on its own:

     hp_current       null = at max          hp_temp, hp_barrier
     hit_dice_used    { d10: 2 }             death_saves { ok, fail }
     conditions       ["Poisoned"]           exhaustion 0–6
     concentration    true / false (or the spell's name)
     reaction, heroic_inspiration, bardic_inspiration    on / off */

export const asList = (v) => (Array.isArray(v) ? v : []);
const toInt = (v, fallback = 0) => {
  const n = Math.trunc(Number(v));
  return v === "" || v == null || !Number.isFinite(n) ? fallback : n;
};
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
export const signedNum = (n) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n}`);

export const healthOf = (ch, d) => {
  const st = ch?.state || {};
  const max = d?.hp_max ?? 0;
  return {
    max,
    cur: currentHp(ch, max),
    temp: Math.max(0, toInt(st.hp_temp)),
    barrier: Math.max(0, toInt(st.hp_barrier)),
  };
};

// The current HP to store: null when it's back at the max.
export const hpToStore = (value, max) => (value >= max ? null : Math.max(0, value));

export const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible",
  "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
];

export const conditionsOf = (ch) => asList(ch?.state?.conditions).filter((c) => typeof c === "string");

export const exhaustionOf = (ch) => clamp(toInt(ch?.state?.exhaustion), 0, 6);

// The file says { ok, fail }; the section reads success / fail.
export const deathSavesOf = (ch) => {
  const ds = ch?.state?.death_saves || {};
  return { success: clamp(toInt(ds.ok), 0, 3), fail: clamp(toInt(ds.fail), 0, 3) };
};
export const toStoredSaves = (s) => ({ ok: s.success, fail: s.fail });
export const NO_DEATH_SAVES = { success: 0, fail: 0 };

// Constitution save DC to keep concentrating: half the damage, at least 10
// (2024 rules also cap it at 30).
export const concentrationDc = (damage) => Math.min(30, Math.max(10, Math.floor(Math.abs(damage) / 2)));

const DIE_SORT = ["d4", "d6", "d8", "d10", "d12", "d20"];

// [{ die, max, cur }] from derive's hit_dice and state.hit_dice_used.
export const hitDiceList = (d, ch) => {
  const used = ch?.state?.hit_dice_used || {};
  return Object.entries(d?.hit_dice || {})
    .map(([die, max]) => ({ die, max, cur: clamp(max - toInt(used[die]), 0, max) }))
    .filter((x) => x.max > 0)
    .sort((a, b) => DIE_SORT.indexOf(a.die) - DIE_SORT.indexOf(b.die));
};

// Walking speed first, other movement listed for the tooltip.
export const speedSummary = (d) => {
  const sp = d?.speed || {};
  const others = Object.entries(sp)
    .filter(([k, v]) => k !== "walk" && typeof v === "number" && v > 0)
    .map(([k, v]) => `${cap(k)} ${v} ft${k === "fly" && sp.hover ? " (hover)" : ""}`);
  return { walk: typeof sp.walk === "number" ? sp.walk : 0, others };
};

export const hpTone = (cur, max) => {
  if (max <= 0) return "slate";
  if (cur <= 0) return "slate";
  const pct = cur / max;
  if (pct <= 0.25) return "red";
  if (pct <= 0.5) return "amber";
  return "emerald";
};
