import { abilitiesOf, pbOf, saveTotal } from "../../Characters/sheet/define/abilityHelpers";
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
  return saveTotal(abilitiesOf(c.data)[ability], pbOf(c.data)) ?? 0;
}

export function defensesOf(c) {
  const d = c.data || {};
  if (c.kind === "monster") {
    return { resistances: words(d.resistances?.types), immunities: words(d.immunities?.types), vulnerabilities: words(d.vulnerabilities?.types) };
  }
  const def = d.defenses || {};
  return { resistances: words(def.resistances), immunities: words(def.immunities), vulnerabilities: words(def.vulnerabilities) };
}

// Monsters with the Magic Resistance trait save against spells with advantage.
export function hasMagicResistance(c) {
  const d = c.data || {};
  const names = c.kind === "monster" ? Object.values(d.effects || {}).flatMap((s) => asList(s?.items)).map((x) => x?.name) : asList(d.effects).map((x) => x?.name);
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