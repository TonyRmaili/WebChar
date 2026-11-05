// Pure logic for the "Actions & Charges" play section.
// Reads the shapes written by the Effects, Spellbook and Inventory tabs.

export const asList = (v) => (Array.isArray(v) ? v : []);

const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const signed = (n) => `${n >= 0 ? "+" : ""}${n}`;
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const ORDINALS = ["0", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
export const ordinal = (lvl) => ORDINALS[toInt(lvl, 0)] || `${lvl}th`;

/* ─── Uses ───────────────────────────────────────────────────────────
   A missing "current" means full. That is read here, not written back,
   so opening the sheet never saves anything by itself. */

export const usesFromCharges = (charges) => {
  if (!charges?.has) return null;
  const max = Math.max(0, toInt(charges.max_charges, 0));
  if (max <= 0) return null;
  return { cur: clamp(toInt(charges.current_charges, max), 0, max), max };
};

export const withChargesCurrent = (row, value) => ({
  ...row,
  charges: { ...row.charges, current_charges: value },
});

export const regainLabel = (resetAmount, max) => {
  if (resetAmount === "full" || (max && toInt(resetAmount, -1) >= max)) return "regains all on rest";
  const n = toInt(resetAmount, 0);
  return n > 0 ? `regains ${n} on rest` : "";
};

/* ─── Effects (Effects tab) ──────────────────────────────────────── */

export const ACTION_GROUPS = [
  { key: "action", title: "Actions" },
  { key: "bonus_action", title: "Bonus Actions" },
  { key: "reaction", title: "Reactions" },
  { key: "passive", title: "Passives" },
];

export const groupEffects = (effects) => {
  const out = { action: [], bonus_action: [], reaction: [], passive: [] };
  for (const e of asList(effects)) {
    if (e?.active !== true) continue;
    const key = out[e.action_type] ? e.action_type : "action";
    out[key].push(e);
  }
  return out;
};

const DEFAULT_ATTACK_BASE = { melee: "str", ranged: "dex", spell: "cha" };

const abilityMod = (charData, ability) =>
  toInt(charData?.ability_scores?.[String(ability || "").toLowerCase()]?.mod, 0);

const pbOf = (charData) => toInt(charData?.pb?.total, 0);

// Same rule as the Offense card: PB + ability mod + offense mod,
// plus the effect's own hit bonus.
export const attackBonus = (charData, effect) => {
  const type = String(effect?.attack?.attack_type || "").toLowerCase();
  if (!type) return null;
  const row = charData?.offense?.[type] || {};
  const base = row.base || DEFAULT_ATTACK_BASE[type] || "str";
  return pbOf(charData) + abilityMod(charData, base) + toInt(row.mod, 0) + toInt(effect.attack.hit_bonus, 0);
};

// DC from the caster ability (save.ability, falling back to the target),
// like the Offense card's save rows, plus the effect's DC bonus.
export const saveDc = (charData, effect) => {
  const save = effect?.save || {};
  const calc = String(save.ability || save.target || "").toLowerCase();
  if (!calc) return null;
  const row = charData?.offense?.save_dcs?.[`save_${calc}`] || {};
  return 8 + pbOf(charData) + abilityMod(charData, calc) + toInt(row.mod, 0) + toInt(save.dc_bonus, 0);
};

// Damage list, with the attack's ability mod added to the first entry.
export const effectDamage = (charData, effect) => {
  const type = String(effect?.attack?.attack_type || "").toLowerCase();
  const row = charData?.offense?.[type] || {};
  const bonus = type ? abilityMod(charData, row.base || DEFAULT_ATTACK_BASE[type] || "str") : 0;

  return asList(effect?.damages)
    .map((d, i) => {
      const dice = d?.dice_count && d?.dice_size ? `${d.dice_count}${d.dice_size}` : d?.dice_size || "";
      const mod = toInt(d?.mod, 0) + (i === 0 ? bonus : 0);
      const base = `${dice}${mod ? signed(mod) : ""}` || (mod ? String(mod) : "");
      return [base, d?.damage_type ? cap(d.damage_type) : ""].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(" + ");
};

export const effectChips = (charData, effect) => {
  const chips = [];
  const kind = effect?.kind || "none";
  const atk = effect?.attack || {};

  if ((kind === "attack" || kind === "attack_and_save") && atk.attack_type) {
    chips.push({ tone: "plain", text: cap(atk.attack_type) });
    const bonus = attackBonus(charData, effect);
    if (bonus != null) chips.push({ tone: "hit", text: `${signed(bonus)} to hit` });
  }
  if (atk.range_ft) chips.push({ tone: "plain", text: `${atk.range_ft} ft` });

  if (kind === "save" || kind === "attack_and_save") {
    const target = String(effect?.save?.target || effect?.save?.ability || "").toUpperCase();
    const dc = saveDc(charData, effect);
    if (target) chips.push({ tone: "save", text: dc != null ? `${target} DC ${dc}` : `${target} save` });
  }
  return chips;
};

/* ─── Spellbook ──────────────────────────────────────────────────── */

export const slotUses = (row) => {
  const max = Math.max(0, toInt(row?.slots_max, 0));
  if (max <= 0) return null;
  return { cur: clamp(toInt(row?.slots_current, max), 0, max), max };
};

export const innateUses = (spell) => {
  if (!spell?.innate) return null;
  const max = Math.max(0, toInt(spell?.uses?.max, 0));
  if (max <= 0) return null;
  return { cur: clamp(toInt(spell.uses.current, max), 0, max), max };
};

export const sorceryUses = (sp) => {
  const max = Math.max(0, toInt(sp?.max_charges, 0));
  if (max <= 0) return null;
  return { cur: clamp(toInt(sp.current_charges, max), 0, max), max };
};

export const sortSlots = (rows) =>
  asList(rows).filter((r) => slotUses(r)).sort((a, b) => toInt(a.level) - toInt(b.level));

export const INNATE_RESET = { short: "per short rest", long: "per long rest" };

export const spellMeta = (s) =>
  [
    toInt(s?.level, 0) === 0 ? "Cantrip" : `Level ${s.level}`,
    cap(s?.school),
    s?.granted_by,
  ]
    .filter(Boolean)
    .join(" · ");

export const spellComponents = (s) => {
  const c = s?.components || {};
  return [c.v && "V", c.s && "S", c.m && "M", s?.concentration && "C", s?.ritual && "R"].filter(Boolean);
};

/* ─── Inventory ──────────────────────────────────────────────────── */

export const chargedMagicItems = (inventory) =>
  asList(inventory?.magic).filter((m) => usesFromCharges(m?.charges));

export const consumables = (inventory) => asList(inventory?.mundane).filter((m) => m?.consumed === true);

/* ─── Health & core numbers (HealthPlay) ─────────────────────────── */

export const HEALTH_DEFAULTS = { current_hp: 0, max_hp: 0, temp_hp: 0, barrier: 0, max_hp_mod: 0 };

export const healthOf = (charData) => ({ ...HEALTH_DEFAULTS, ...(charData?.health || {}) });

export const effectiveMaxHp = (health) => Math.max(0, toInt(health.max_hp, 0) + toInt(health.max_hp_mod, 0));

export const signedNum = signed;

// Same rule as General → Initiative: DEX mod + initiative modifier.
export const initiativeTotal = (charData) =>
  abilityMod(charData, "dex") + toInt(charData?.initiative?.mod, 0);

// Same rule as the Offense card: PB + ability mod + offense mod.
export const attackTotals = (charData) =>
  ["melee", "ranged", "spell"].map((type) => {
    const row = charData?.offense?.[type] || {};
    const base = row.base || DEFAULT_ATTACK_BASE[type];
    return { type, base, total: pbOf(charData) + abilityMod(charData, base) + toInt(row.mod, 0) };
  });

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

// Save DCs switched on in the Offense card, in ability order.
export const activeSaveDcs = (charData) =>
  ABILITIES.map((ab) => {
    const row = charData?.offense?.save_dcs?.[`save_${ab}`];
    if (!row?.active) return null;
    const base = String(row.base || ab).toLowerCase();
    return { base, dc: 8 + pbOf(charData) + abilityMod(charData, base) + toInt(row.mod, 0) };
  }).filter(Boolean);

// Same rule as the skill cards: ability mod + offset + PB (×2 with expertise).
export const skillTotal = (charData, key, ability) => {
  const row = charData?.skills?.[key] || {};
  const pb = pbOf(charData);
  const prof = row.expertise ? 2 * pb : row.proficient ? pb : 0;
  return abilityMod(charData, row.ability ? ABILITY_KEY[row.ability] || ability : ability) + toInt(row.value, 0) + prof;
};
const ABILITY_KEY = {
  Strength: "str", Dexterity: "dex", Constitution: "con",
  Intelligence: "int", Wisdom: "wis", Charisma: "cha",
};

export const passivePerception = (charData) => 10 + skillTotal(charData, "perception", "wis");

// Walking speed first, other movement listed for the tooltip.
export const speedSummary = (charData) => {
  const sp = charData?.speed && typeof charData.speed === "object" ? charData.speed : {};
  const walk = toInt(sp.walk, 0);
  const others = Object.entries(sp)
    .filter(([k, v]) => k !== "walk" && k !== "hover" && toInt(v, 0) > 0)
    .map(([k, v]) => `${cap(k)} ${toInt(v, 0)} ft${k === "fly" && sp.hover ? " (hover)" : ""}`);
  return { walk, others };
};

/* ─── Conditions, exhaustion, death saves, concentration ─────────── */

export const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible",
  "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
];

export const conditionsOf = (charData) => asList(charData?.conditions).filter((c) => typeof c === "string");

export const exhaustionOf = (charData) => clamp(toInt(charData?.exhaustion, 0), 0, 6);

export const deathSavesOf = (charData) => {
  const d = charData?.death_saves || {};
  return { success: clamp(toInt(d.success, 0), 0, 3), fail: clamp(toInt(d.fail, 0), 0, 3) };
};

export const NO_DEATH_SAVES = { success: 0, fail: 0 };

// Constitution save DC to keep concentrating: half the damage, at least 10
// (2024 rules also cap it at 30).
export const concentrationDc = (damage) => Math.min(30, Math.max(10, Math.floor(Math.abs(damage) / 2)));

const DIE_SORT = ["d4", "d6", "d8", "d10", "d12", "d20"];

export const hitDiceList = (hitDice) =>
  Object.entries(hitDice && typeof hitDice === "object" ? hitDice : {})
    .map(([die, v]) => {
      const max = Math.max(0, toInt(v?.max, 0));
      return { die, max, cur: clamp(toInt(v?.current, max), 0, max) };
    })
    .filter((d) => d.max > 0)
    .sort((a, b) => DIE_SORT.indexOf(a.die) - DIE_SORT.indexOf(b.die));

export const hpTone = (cur, max) => {
  if (max <= 0) return "slate";
  if (cur <= 0) return "slate";
  const pct = cur / max;
  if (pct <= 0.25) return "red";
  if (pct <= 0.5) return "amber";
  return "emerald";
};

/* ─── Replace one row in a list by id ────────────────────────────── */

export const replaceById = (list, id, next) => asList(list).map((x) => (x?.id === id ? next : x));