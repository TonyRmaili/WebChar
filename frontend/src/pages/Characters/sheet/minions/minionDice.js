import { selKey } from "../../../../store/MinionStore";
import { EFFECT_SECTIONS } from "../../../Catalogues/Monsters/monsterHelpers";
import { saveOf } from "../../../Campaigns/statblock/monsterStatblock";
import { chargeKey, changeHp, changeUse, displayName, hpMaxOf, itemMaxUses, monsterAc } from "./minionHelpers";

/* ═══════════════════════════════════════════════════════════════════
   minionDice.js — minions' bridge to the dice tower.

   Two directions, like at the table:
     they attack   every attack and save effect in a group's statblock,
                   ready to roll (to-hit / DC, damage dice, uses)
     they're hit   selected units as plain targets for GroupRoll (AC,
                   HP, save bonuses, defenses), and the damage back onto
                   the units afterwards

   Effects come from the minion's copy of its monster
   (`minion.monster.effects`); nothing here rolls or saves anything.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const toInt = (v, fallback = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};
const lower = (s) => String(s || "").toLowerCase();
const words = (list) => asList(list).map((x) => lower(typeof x === "string" ? x : x?.name || x?.type)).filter(Boolean);
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

/* ─── damage, as the engine reads it ─────────────────────────────── */

// { dice_count: 2, dice_size: "d6", mod: 3 } → "2d6+3" (only a number when there are no dice)
export function diceOf(d) {
  const count = toInt(d?.dice_count, 0);
  const size = String(d?.dice_size || "").toLowerCase().replace(/^d?/, "d");
  const mod = toInt(d?.mod, 0);
  const dice = count > 0 && size !== "d" ? `${count}${size}` : "";
  if (!dice) return String(Math.max(0, mod));
  return mod ? `${dice}${mod > 0 ? "+" : ""}${mod}` : dice;
}

export const damagePartsOf = (damages) => asList(damages).map((d) => ({ dice: diceOf(d), type: lower(d?.damage_type) || "untyped" }));

/* ─── what a group can roll ──────────────────────────────────────── */

/* Every effect with an attack roll or a save, from every section:
   [{ id, section, name, kind: "attack" | "save", toHit, dc, ability, half,
      damage: [{ dice, type }], usesKey, maxUses }] */
export function rollingEffects(minion) {
  const out = [];
  for (const { key } of EFFECT_SECTIONS) {
    for (const item of asList(minion?.monster?.effects?.[key]?.items)) {
      if (!item || item.active === false) continue;
      const base = { id: chargeKey(key, item), section: key, name: item.name || "Unnamed", usesKey: chargeKey(key, item), maxUses: itemMaxUses(item) };
      if (item.attack) {
        out.push({ ...base, kind: "attack", toHit: toInt(item.attack.hit_bonus, 0), damage: damagePartsOf(item.attack.damages) });
      } else if (item.save?.target) {
        out.push({
          ...base,
          kind: "save",
          dc: toInt(item.save.dc_bonus, 10),
          ability: lower(item.save.target).slice(0, 3),
          half: Boolean(item.save.half_damage),
          damage: damagePartsOf(item.save.damages),
        });
      }
    }
  }
  return out;
}

// "+5 · 1d6+3 piercing" / "DEX DC 15 · half · 8d6 fire"
export function effectLine(e) {
  const dmg = e.damage.map((p) => `${p.dice} ${p.type === "untyped" ? "" : p.type}`.trim()).join(" + ");
  const head = e.kind === "attack" ? `${e.toHit >= 0 ? "+" : ""}${e.toHit} to hit` : `${e.ability.toUpperCase()} DC ${e.dc}${e.half ? " · half" : ""}`;
  return [head, dmg].filter(Boolean).join(" · ");
}

export const usesLeft = (unit, effect) => (effect.maxUses == null ? Infinity : Math.max(0, Math.min(effect.maxUses, toInt(unit.charges?.[effect.usesKey], effect.maxUses))));

// `times` uses spent by each of these units (never below 0).
export const spendUses = (minion, unitIds, effect, times = 1) =>
  effect.maxUses == null ? minion : unitIds.reduce((m, id) => changeUse(m, id, effect.usesKey, effect.maxUses, -times), minion);

/* ─── selected units ─────────────────────────────────────────────── */

// [{ minion, units: [{ unit, index }] }] — only groups with a selected unit.
export function selectedByGroup(minions, selected) {
  const keys = new Set(selected);
  return asList(minions)
    .map((m) => ({
      minion: m,
      units: asList(m.units)
        .map((unit, index) => ({ unit, index }))
        .filter(({ unit }) => keys.has(selKey(m.id, unit.id))),
    }))
    .filter((g) => g.units.length > 0);
}

/* ─── units as targets (they're hit) ─────────────────────────────── */

function defensesOf(monster) {
  return {
    resistances: words(monster?.resistances?.types),
    immunities: words(monster?.immunities?.types),
    vulnerabilities: words(monster?.vulnerabilities?.types),
  };
}

const hasMagicResistance = (monster) =>
  Object.values(monster?.effects || {})
    .flatMap((s) => asList(s?.items))
    .some((x) => /magic resistance/i.test(String(x?.name || "")));

// Selected units → targets for GroupRoll. Key: "<minion id>:<unit id>".
export function unitTargets(minions, selected) {
  return selectedByGroup(minions, selected).flatMap(({ minion, units }) => {
    const m = minion.monster || {};
    const saves = Object.fromEntries(ABILITY_KEYS.map((a) => [a, saveOf(m, a)]));
    const shared = { group: displayName(minion), ac: monsterAc(m), saves, defenses: defensesOf(m), magicResistance: hasMagicResistance(m) };
    return units.map(({ unit, index }) => ({
      ...shared,
      key: selKey(minion.id, unit.id),
      name: `${displayName(minion)} ${index + 1}`,
      hp: { cur: toInt(unit.hp, 0), max: hpMaxOf(minion), temp: 0 },
    }));
  });
}

// The damage from GroupRoll ([{ key, amount }]) onto the units → the changed groups.
export function applyToUnits(minions, lines) {
  const byGroup = new Map();
  for (const { key, amount } of lines) {
    const [minionId, unitId] = key.split(":");
    if (!byGroup.has(minionId)) byGroup.set(minionId, []);
    byGroup.get(minionId).push({ unitId, amount });
  }
  return asList(minions)
    .filter((m) => byGroup.has(m.id))
    .map((m) => byGroup.get(m.id).reduce((acc, { unitId, amount }) => changeHp(acc, [unitId], -amount), m));
}