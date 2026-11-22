import { derivedOf } from "../../../utils/derive";
import { saveOf } from "../statblock/monsterStatblock";
import { acOf, hpOf } from "./trackerLogic";

/* ═══════════════════════════════════════════════════════════════════
   trackerDice.js — the tracker's bridge to the dice tower.

   The dice engine knows nothing about creatures; GroupRoll (components/
   dice) works on plain *targets*. This turns tracker combatants into
   targets — save bonuses, AC, HP, defenses, all read from `data`, so
   templates count. TrackerWindow applies what comes back.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const words = (list) => asList(list).map((x) => String(typeof x === "string" ? x : x?.name || x?.type || "").toLowerCase()).filter(Boolean);
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

export function saveBonusOf(c, ability) {
  if (!c.data) return 0;
  if (c.kind === "monster") return saveOf(c.data, ability);
  return derivedOf(c.data)?.abilities?.[ability]?.save ?? 0;
}

export function defensesOf(c) {
  const d = c.data || {};
  if (c.kind === "monster") {
    const def = d.defenses || {};
    return { resistances: words(def.resist?.types), immunities: words(def.immune?.types), vulnerabilities: words(def.vulnerable?.types) };
  }
  const def = derivedOf(d)?.defenses || {};
  return { resistances: words(def.resist), immunities: words(def.immune), vulnerabilities: words(def.vulnerable) };
}

// Monsters with the Magic Resistance trait save against spells with advantage.
export function hasMagicResistance(c) {
  const d = c.data || {};
  const own = c.kind === "monster" ? d.features : asList(d.layers).flatMap((l) => asList(l?.features));
  const names = asList(own).filter((x) => x?.active !== false).map((x) => x?.name);
  return names.some((n) => /magic resistance/i.test(String(n || "")));
}

// Combatants → targets for GroupRoll.
export const toTargets = (combatants) =>
  combatants.map((c) => ({
    key: c.key,
    name: c.name,
    ac: acOf(c),
    hp: hpOf(c),
    saves: Object.fromEntries(ABILITY_KEYS.map((a) => [a, saveBonusOf(c, a)])),
    defenses: defensesOf(c),
    magicResistance: hasMagicResistance(c),
  }));