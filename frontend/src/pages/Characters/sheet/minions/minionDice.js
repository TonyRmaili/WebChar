import { selKey } from "../../../../store/MinionStore";
import { saveOf } from "../../../Campaigns/statblock/monsterStatblock";
import { canRoll, rollOf } from "../../../../utils/featureRuntime";
import { chargeKey, changeHp, changeUse, displayName, hpMaxOf, itemMaxUses, monsterAc } from "./minionHelpers";

/* ═══════════════════════════════════════════════════════════════════
   minionDice.js — minions' bridge to the dice tower.

   Two directions, like at the table:
     they attack   every attack and save effect in a group's statblock,
                   ready to roll (to-hit / DC, damage dice, uses)
     they're hit   selected units as plain targets for GroupRoll (AC,
                   HP, save bonuses, defenses), and the damage back onto
                   the units afterwards

   Effects come from the features of the minion's copy of its monster
   (`minion.monster.features`); nothing here rolls or saves anything.
   A number still in words (a summon's "3 + spell level") can't be
   rolled: that damage is left out, and an attack or save without a real
   to-hit or DC isn't offered until it has one.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const toInt = (v, fallback = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};
const lower = (s) => String(s || "").toLowerCase();
const words = (list) => asList(list).map((x) => lower(typeof x === "string" ? x : x?.name || x?.type)).filter(Boolean);
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

/* ─── what a group can roll ──────────────────────────────────────── */

/* Every switched-on feature with an attack roll or a save:
   [{ id, section, name, kind: "attack" | "save", toHit, dc, ability, half,
      damage: [{ dice, type }], usesKey, maxUses }] */
export function rollingEffects(minion) {
  const out = [];
  for (const f of asList(minion?.monster?.features)) {
    if (!f || f.active === false) continue;
    const r = rollOf(f);
    if (!canRoll(r) || r.kind === "damage") continue;
    out.push({
      id: chargeKey(f),
      section: f.category || "traits",
      name: f.name || "Unnamed",
      usesKey: chargeKey(f),
      maxUses: itemMaxUses(f),
      kind: r.kind,
      toHit: r.toHit,
      dc: r.dc,
      ability: r.ability,
      half: r.half,
      damage: r.damage,
    });
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
  const d = monster?.defenses || {};
  return { resistances: words(d.resist?.types), immunities: words(d.immune?.types), vulnerabilities: words(d.vulnerable?.types) };
}

const hasMagicResistance = (monster) =>
  asList(monster?.features).some((f) => f?.active !== false && /magic resistance/i.test(String(f?.name || "")));

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