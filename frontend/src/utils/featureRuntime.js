import { ABILITY_SHORT, formatValue, titleCase } from "../pages/Catalogues/catalogueHelpers";

/* ═══════════════════════════════════════════════════════════════════
   featureRuntime — a feature's numbers at the table.

   Monster features, template rows and minion features all share the
   catalogue's feature layout (data-model):
     { id, name, category, text, uses { max, reset, recharge, max_in_lair },
       cost, action { range, area, attack { kind, bonus, damage[] },
                      save { ability, dc, on_success, conditions, damage[] },
                      damage[] } }
   a damage part being { dice: "2d6", bonus: 4, type, condition, per_slot }.

   A copy in play adds `uses_left` (and `active`) on each feature. Some
   numbers are still words ("3 + spell_level" on a summon) until the DM
   or player writes real ones on their copy: they are shown as words and
   the dice tower leaves them out.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);

// A fresh id for a row on a copy (a feature, a spell list, a piece of gear).
export const newId = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const signed = (n) => `${n >= 0 ? "+" : ""}${n}`;

/* ─── damage ─────────────────────────────────────────────────────── */

const DICE_RE = /^\s*\d*\s*d\s*\d+\s*$/i;

// A part's dice for the dice tower: "2d6+4", "1d4", "3" — or null when
// any of it is still words (a formula or a level table).
export function partDice(p) {
  const dice = p?.dice;
  const bonus = p?.bonus;
  if (dice != null && !(typeof dice === "string" && DICE_RE.test(dice))) return null;
  if (bonus != null && !isNumber(bonus)) return null;
  const d = dice ? String(dice).replace(/\s+/g, "").toLowerCase() : "";
  const b = isNumber(bonus) ? bonus : 0;
  if (!d) return b > 0 ? String(b) : null;
  return b ? `${d}${b > 0 ? "+" : ""}${b}` : d;
}

// The same part in words, whatever it holds: "1d10 + 8 slashing", "1d8 + 3 + spell level force".
export function partWords(p) {
  const dice = formatValue(p?.dice);
  const bonus = p?.bonus == null ? "" : isNumber(p.bonus) ? String(Math.abs(p.bonus)) : formatValue(p.bonus);
  const sign = isNumber(p?.bonus) && p.bonus < 0 ? " − " : " + ";
  const amount = dice && bonus ? `${dice}${sign}${bonus}` : dice || bonus;
  return [amount, p?.type && p.type !== "untyped" ? p.type : ""].filter(Boolean).join(" ");
}

// Every damage part an action deals: the attack's, the save's, then plain damage.
export const actionDamage = (a) => [...asList(a?.attack?.damage), ...asList(a?.save?.damage), ...asList(a?.damage)];

// The parts the dice tower rolls: only plain numbers, never a rider
// that needs a condition ("if the attack roll had Advantage") or a
// spell's extra dice per slot level.
export const rollableParts = (parts) =>
  asList(parts)
    .filter((p) => !p?.condition && !p?.per_slot)
    .map((p) => ({ dice: partDice(p), type: String(p?.type || "untyped").toLowerCase() }))
    .filter((p) => p.dice);

/* ─── what a feature rolls ───────────────────────────────────────── */

/* null when it rolls nothing, otherwise
     { kind: "attack", toHit, damage }        toHit null = still words
     { kind: "save", ability, dc, half, conditions, damage }
     { kind: "damage", damage }               damage with no roll first
   `damage` is [{ dice, type }], rollable parts only. */
export function rollOf(feature) {
  const a = feature?.action;
  if (!a) return null;
  if (a.attack) {
    return { kind: "attack", toHit: isNumber(a.attack.bonus) ? a.attack.bonus : null, damage: rollableParts([...asList(a.attack.damage), ...asList(a.damage)]) };
  }
  if (a.save) {
    return {
      kind: "save",
      ability: String(a.save.ability || "").toLowerCase().slice(0, 3),
      dc: isNumber(a.save.dc) ? a.save.dc : null,
      half: a.save.on_success === "half",
      conditions: asList(a.save.conditions),
      damage: rollableParts([...asList(a.save.damage), ...asList(a.damage)]),
    };
  }
  const damage = rollableParts(a.damage);
  return damage.length ? { kind: "damage", damage } : null;
}

// Can the dice tower roll it? (Its deciding number is a real number.)
export const canRoll = (r) =>
  !!r && (r.kind === "attack" ? r.toHit != null : r.kind === "save" ? r.dc != null && !!r.ability : r.damage.length > 0);

const ATTACK_WORDS = { melee: "Melee", ranged: "Ranged", melee_or_ranged: "Melee or ranged" };

// "Melee +14 · reach 10 ft. · 1d10 + 8 slashing + 2d4 fire"
// "DEX DC 21 · half on a success · 60-foot cone · 17d6 fire"
export function actionWords(a) {
  if (!a) return "";
  const bits = [];
  if (a.attack) {
    const b = a.attack.bonus;
    const hit = b == null ? "" : isNumber(b) ? signed(b) : `+${formatValue(b)}`;
    bits.push([ATTACK_WORDS[a.attack.kind] || "", hit ? `${hit} to hit` : ""].filter(Boolean).join(" "));
  }
  if (a.save) {
    const ab = ABILITY_SHORT[a.save.ability]?.toUpperCase() || String(a.save.ability || "").toUpperCase();
    const dc = a.save.dc == null ? "save" : `DC ${isNumber(a.save.dc) ? a.save.dc : formatValue(a.save.dc)}`;
    bits.push(`${ab} ${dc}`.trim());
    if (a.save.on_success === "half") bits.push("half on a success");
    if (asList(a.save.conditions).length) bits.push(a.save.conditions.map(titleCase).join(", "));
  }
  if (a.range) bits.push(a.range);
  if (a.area) bits.push(a.area);
  const dmg = actionDamage(a).map((p) => partWords(p) + (p.condition ? ` (${p.condition})` : "")).filter(Boolean).join(" + ");
  if (dmg) bits.push(dmg);
  return bits.filter(Boolean).join(" · ");
}

/* ─── limited uses ───────────────────────────────────────────────── */

// How many uses it has (null = unlimited, or a number still in words).
export const usesMax = (uses, { lair = false } = {}) => {
  if (!uses) return null;
  const max = lair && isNumber(uses.max_in_lair) ? uses.max_in_lair : uses.reset === "recharge" && uses.max == null ? 1 : uses.max;
  return isNumber(max) && max > 0 ? max : null;
};

// { max, cur } for the dots, or null.
export const usesOf = (feature, opts) => {
  const max = usesMax(feature?.uses, opts);
  if (max == null) return null;
  return { max, cur: clamp(isNumber(feature?.uses_left) ? feature.uses_left : max, 0, max) };
};

// "Recharge 5–6" · "per day" · "per short rest" · "per turn"
export const regainWords = (uses) => {
  if (!uses) return "";
  if (uses.reset === "recharge") return isNumber(uses.recharge) && uses.recharge < 6 ? `Recharge ${uses.recharge}–6` : "Recharge 6";
  return { long: "per day", short: "per short rest", turn: "per turn" }[uses.reset] || "";
};

export const RESETS = [
  { value: "long", label: "per day" },
  { value: "short", label: "per short rest" },
  { value: "recharge", label: "recharge" },
  { value: "turn", label: "per turn" },
];

// A spent "Recharge 5–6" rolls a d6 at the start of its turn: does it come back?
export const recharges = (uses, roll) => roll >= (isNumber(uses?.recharge) ? uses.recharge : 6);
