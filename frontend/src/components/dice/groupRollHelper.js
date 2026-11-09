/* ═══════════════════════════════════════════════════════════════════
   groupRollHelper.js — saves and attacks against many targets at once, for
   any kind of creature. The bridges (tracker, minions) turn their own
   creatures into plain *targets* first:

     { key, name, group,                  group: shown above it ("Skeleton")
       ac, hp: { cur, max, temp },
       saves: { str, dex, con, int, wis, cha },   save bonuses
       defenses: { resistances, immunities, vulnerabilities },
       magicResistance }                  advantage on saves against spells

   and this file builds the request for the dice engine and turns its
   answer into a plan: what each target would take, HP before → after.
   Nothing is changed here; the bridge applies the plan.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);

export const ABILITIES = [
  { key: "str", label: "STR", name: "Strength" },
  { key: "dex", label: "DEX", name: "Dexterity" },
  { key: "con", label: "CON", name: "Constitution" },
  { key: "int", label: "INT", name: "Intelligence" },
  { key: "wis", label: "WIS", name: "Wisdom" },
  { key: "cha", label: "CHA", name: "Charisma" },
];

const NO_DEFENSES = { resistances: [], immunities: [], vulnerabilities: [] };

// "resists fire · immune to poison"
export function defenseWords(defenses) {
  const d = defenses || NO_DEFENSES;
  return [
    d.resistances?.length ? `resists ${d.resistances.join(", ")}` : "",
    d.immunities?.length ? `immune to ${d.immunities.join(", ")}` : "",
    d.vulnerabilities?.length ? `vulnerable to ${d.vulnerabilities.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

// HP after `amount` damage: temporary HP go first. { cur, max, temp } → the same.
export function afterDamage(hp, amount) {
  const fromTemp = Math.min(hp.temp || 0, amount);
  return { ...hp, cur: Math.max(0, hp.cur - (amount - fromTemp)), temp: (hp.temp || 0) - fromTemp };
}

/* ─── requests ───────────────────────────────────────────────────── */

// Damage rows from a form: [{ dice, type, given }] — rows with nothing to roll are left out.
export const partsOf = (rows) =>
  asList(rows)
    .filter((r) => String(r.dice || "").trim() || r.given != null)
    .map((r) => ({ dice: String(r.dice || "").trim() || "0", type: (r.type || "untyped").toLowerCase(), given: r.given ?? null }));

/* list: [{ t, mode, given }] */
export const saveRequest = ({ ability, dc, onSuccess, damage, damageRoll, list }) => ({
  dc,
  on_success: onSuccess,
  damage: partsOf(damage),
  damage_roll: damageRoll,
  targets: list.map(({ t, mode, given }) => ({
    key: t.key,
    name: t.name,
    save_bonus: t.saves?.[ability] ?? 0,
    mode,
    given: given ?? null,
    defenses: t.defenses || NO_DEFENSES,
  })),
});

/* Each target gets `count` attacks. list: [{ t, mode }] */
export const attackRequest = ({ name, count, toHit, critOn, damage, critRule, list }) => ({
  crit_rule: critRule,
  volleys: list.map(({ t, mode }) => ({
    key: t.key,
    name: t.name || name,
    count,
    to_hit: toHit,
    mode,
    crit_on: critOn,
    damage: partsOf(damage),
    ac: t.ac ?? 10,
    defenses: t.defenses || NO_DEFENSES,
  })),
});

/* ─── answers → plans ────────────────────────────────────────────── */

// One line of the preview: who, how much, and their HP before → after.
const planLine = (t, amount, extra) => ({ key: t.key, t, amount, before: t.hp, after: afterDamage(t.hp, amount), apply: true, ...extra });

/* Saves: the DM may overturn a result (`passedOverride[key]`), so the
   engine works out both outcomes and we pick one. */
export function savePlan(result, targets, passedOverride = {}) {
  return asList(result?.targets)
    .map((r) => {
      const t = targets.find((x) => x.key === r.key);
      if (!t) return null;
      const passed = r.key in passedOverride ? passedOverride[r.key] : r.passed;
      const took = passed ? r.if_passed : r.if_failed;
      return planLine(t, took.total, { roll: r, passed, overturned: passed !== r.passed, notes: took.notes, byType: took.by_type });
    })
    .filter(Boolean);
}

export function attackPlan(result, targets) {
  return asList(result?.volleys)
    .map((v) => {
      const t = targets.find((x) => x.key === v.key);
      if (!t) return null;
      const notes = [...new Set(v.attacks.flatMap((a) => a.taken?.notes || []))];
      return planLine(t, v.total, { volley: v, notes, byType: v.taken });
    })
    .filter(Boolean);
}